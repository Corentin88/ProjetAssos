import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  ForbiddenException,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  StreamableFile,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import sharp from 'sharp';
import { presentAvatar, profileFields } from './profile-avatar.js';
import { AuthModule } from '../auth/auth.module.js';
import {
  AccessGuard,
  AuthRateGuard,
  BrowserOriginGuard,
  CurrentUser,
} from '../auth/access.guard.js';
import { AvatarDto, NamesDto, PublicNameDto } from '../auth/auth.dto.js';
import { formatPublicName } from './public-name.js';
import { lockUser, SessionService } from '../auth/session.service.js';
import type { Principal } from '../auth/session.service.js';
import { imageFormat } from '../content/image-format.js';
import { RuntimeConfig } from '../config/runtime.module.js';
import { PrismaService } from '../prisma/prisma.module.js';
import {
  avatarPath,
  readAvatarFile,
  removeAvatarFile,
  removeAvatarRecord,
  writeAvatarFile,
} from './avatar-files.js';

@Injectable()
class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: RuntimeConfig,
    private readonly sessions: SessionService,
  ) {}

  async own(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        lastActiveAt: true,
        passwordHash: true,
        googleId: true,
        profile: { select: { ...profileFields, publicNameFormat: true } },
        accountTokens: {
          where: {
            purpose: 'EMAIL_CHANGE',
            expiresAt: { gt: new Date() },
            consumedAt: null,
            revokedAt: null,
          },
          select: { newEmail: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!user.profile) throw new NotFoundException();
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
      firstName: user.profile.firstName,
      lastName: user.profile.lastName,
      avatar: presentAvatar(user.id, user.profile),
      publicNameFormat: user.role === 'ADMIN' || user.profile.publicNameFormat !== 'ADMIN'
        ? user.profile.publicNameFormat : 'INITIAL',
      hasPersonalAvatar: Boolean(user.profile.avatarMediaId),
      googleAvatar: user.googleId ? user.profile.googleAvatar : null,
      pendingEmail: user.accountTokens[0]?.newEmail ?? null,
      authMethods: [
        ...(user.passwordHash ? ['password'] : []),
        ...(user.googleId ? ['google'] : []),
      ],
    };
  }

  async publicProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, passwordSetupPending: false },
      select: { createdAt: true, role: true, profile: { select: { ...profileFields, publicNameFormat: true } } },
    });
    if (!user?.profile) throw new NotFoundException();
    const format = user.role !== 'ADMIN' && user.profile.publicNameFormat === 'ADMIN'
      ? 'INITIAL' : user.profile.publicNameFormat;
    return {
      id: userId,
      firstName: format === 'ADMIN' ? 'Admin' : user.profile.firstName,
      lastInitial: format === 'ADMIN' ? '' : Array.from(user.profile.lastName)[0] ?? '',
      publicName: formatPublicName(user.profile, format),
      createdAt: user.createdAt,
      avatar: presentAvatar(userId, user.profile),
      commentCount: await this.prisma.comment.count({
        where: {
          userId,
          status: 'PUBLISHED',
          article: { status: 'PUBLISHED' },
          OR: [{ publicNameFormat: null }, { publicNameFormat: { not: 'ADMIN' } }],
        },
      }),
    };
  }

  async changeNames(principal: Principal, dto: NamesDto) {
    await this.prisma.$transaction(async (tx) => {
      await lockUser(tx, principal.userId);
      await this.sessions.assertLive(tx, principal.userId, principal.sessionId);
      await tx.profile.update({
        where: { userId: principal.userId },
        data: { firstName: dto.firstName, lastName: dto.lastName },
      });
    });
    return this.own(principal.userId);
  }

  async changePublicName(principal: Principal, dto: PublicNameDto) {
    await this.prisma.$transaction(async tx => {
      await lockUser(tx, principal.userId);
      const actor = await this.sessions.assertLive(tx, principal.userId, principal.sessionId);
      if (dto.publicNameFormat === 'ADMIN' && actor.role !== 'ADMIN')
        throw new ForbiddenException();
      await tx.profile.update({ where: { userId: principal.userId }, data: { publicNameFormat: dto.publicNameFormat } });
    });
    return this.own(principal.userId);
  }

  async chooseAvatar(principal: Principal, dto: AvatarDto) {
    if (dto.kind !== 'PRESET' && dto.preset !== undefined)
      throw new BadRequestException();
    await this.prisma.$transaction(async (tx) => {
      await lockUser(tx, principal.userId);
      await this.sessions.assertLive(tx, principal.userId, principal.sessionId);
      const profile = await tx.profile.findUniqueOrThrow({
        where: { userId: principal.userId },
        select: {
          avatarMediaId: true,
          googleAvatar: true,
          user: { select: { googleId: true } },
        },
      });
      if (dto.kind === 'PERSONAL' && !profile.avatarMediaId)
        throw new BadRequestException('Aucune photo personnelle enregistrée.');
      if (dto.kind === 'GOOGLE' && (!profile.googleAvatar || !profile.user.googleId))
        throw new BadRequestException('La photo Google est indisponible.');

      await tx.profile.update({
        where: { userId: principal.userId },
        data: {
          avatarKind: dto.kind,
          avatarPreset: dto.kind === 'PRESET' ? String(dto.preset) : null,
        },
      });
    });
    return this.own(principal.userId);
  }

  async upload(principal: Principal, input: Buffer | undefined) {
    if (!input?.length) throw new BadRequestException();
    const image = await this.prepareImage(input);
    const id = randomUUID();
    const path = avatarPath(id);
    await writeAvatarFile(this.config.avatarDirectory, path, image);
    let previousPath: string | undefined;
    try {
      previousPath = await this.prisma.$transaction(async (tx) => {
        await lockUser(tx, principal.userId);
        await this.sessions.assertLive(
          tx,
          principal.userId,
          principal.sessionId,
        );
        const profile = await tx.profile.findUniqueOrThrow({
          where: { userId: principal.userId },
        });
        await tx.media.create({
          data: {
            id,
            path,
            name: 'Avatar',
            type: 'IMAGE',
            format: 'WEBP',
            sizeBytes: BigInt(image.length),
          },
        });
        await tx.profile.update({
          where: { userId: principal.userId },
          data: {
            avatarKind: 'PERSONAL',
            avatarPreset: null,
            avatarMediaId: id,
          },
        });
        return removeAvatarRecord(tx, profile.avatarMediaId);
      });
    } catch (error) {
      // Conserver le fichier si l’état du commit ne peut pas être vérifié.
      const committed = await this.prisma.media
        .findUnique({ where: { id }, select: { id: true } })
        .catch(() => undefined);
      if (committed === null)
        await removeAvatarFile(this.config.avatarDirectory, path);
      throw error;
    }
    await removeAvatarFile(this.config.avatarDirectory, previousPath);
    return this.own(principal.userId);
  }

  async image(userId: string) {
    const profile = await this.prisma.profile.findFirst({
      where: {
        userId,
        avatarKind: 'PERSONAL',
        user: { passwordSetupPending: false },
      },
      select: { avatarMedia: { select: { path: true } } },
    });
    if (!profile?.avatarMedia) throw new NotFoundException();
    const image = await readAvatarFile(
      this.config.avatarDirectory,
      profile.avatarMedia.path,
    ).catch((error) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (!image) throw new NotFoundException();
    return image;
  }

  private async prepareImage(input: Buffer) {
    const format = imageFormat(input);
    if (!format) throw new UnsupportedMediaTypeException();
    try {
      const image = sharp(input, {
        limitInputPixels: 16_000_000,
        failOn: 'warning',
      });
      const metadata = await image.metadata();
      if (metadata.format !== format || (metadata.pages ?? 1) > 1) {
        throw new UnsupportedMediaTypeException();
      }
      return await image
        .autoOrient()
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .webp()
        .toBuffer();
    } catch {
      throw new UnsupportedMediaTypeException();
    }
  }
}

@Controller('profiles')
@UseGuards(AccessGuard, BrowserOriginGuard)
class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('me')
  own(@CurrentUser() user: Principal) {
    return this.profiles.own(user.userId);
  }

  @Patch('me')
  names(@CurrentUser() user: Principal, @Body() dto: NamesDto) {
    return this.profiles.changeNames(user, dto);
  }

  @Patch('me/avatar')
  avatar(@CurrentUser() user: Principal, @Body() dto: AvatarDto) {
    return this.profiles.chooseAvatar(user, dto);
  }

  @Patch('me/public-name')
  publicName(@CurrentUser() user: Principal, @Body() dto: PublicNameDto) {
    return this.profiles.changePublicName(user, dto);
  }

  @Post('me/avatar')
  @HttpCode(200)
  @UseGuards(AuthRateGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 2 },
    }),
  )
  upload(
    @CurrentUser() user: Principal,
    @UploadedFile() file?: { buffer: Buffer },
  ) {
    return this.profiles.upload(user, file?.buffer);
  }

  @Get(':id/avatar')
  async image(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(await this.profiles.image(id), {
      type: 'image/webp',
    });
  }

  @Get(':id')
  publicProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.profiles.publicProfile(id);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
})
export class ProfilesModule {}
