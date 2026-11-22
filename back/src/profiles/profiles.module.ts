import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
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
import type { AvatarKind } from '../../generated/prisma/client.js';
import { AuthModule } from '../auth/auth.module.js';
import {
  AccessGuard,
  AuthRateGuard,
  BrowserOriginGuard,
  CurrentUser,
} from '../auth/access.guard.js';
import { AvatarDto, NamesDto } from '../auth/auth.dto.js';
import { lockUser, SessionService } from '../auth/session.service.js';
import type { Principal } from '../auth/session.service.js';
import { RuntimeConfig } from '../config/runtime.module.js';
import { PrismaService } from '../prisma/prisma.module.js';
import {
  avatarPath,
  readAvatarFile,
  removeAvatarFile,
  removeAvatarRecord,
  writeAvatarFile,
} from './avatar-files.js';

const profileFields = {
  firstName: true,
  lastName: true,
  avatarKind: true,
  avatarPreset: true,
  googleAvatar: true,
} as const;

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
        profile: { select: profileFields },
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
      avatar: this.presentAvatar(user.id, user.profile),
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
      select: { createdAt: true, profile: { select: profileFields } },
    });
    if (!user?.profile) throw new NotFoundException();
    return {
      id: userId,
      firstName: user.profile.firstName,
      lastInitial: Array.from(user.profile.lastName)[0] ?? '',
      createdAt: user.createdAt,
      avatar: this.presentAvatar(userId, user.profile),
      commentCount: await this.prisma.comment.count({
        where: {
          userId,
          status: 'PUBLISHED',
          article: { status: 'PUBLISHED' },
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

  async chooseAvatar(principal: Principal, dto: AvatarDto) {
    if (dto.kind !== 'PRESET' && dto.preset !== undefined)
      throw new BadRequestException();
    const path = await this.prisma.$transaction(async (tx) => {
      await lockUser(tx, principal.userId);
      await this.sessions.assertLive(tx, principal.userId, principal.sessionId);
      const profile = await tx.profile.findUniqueOrThrow({
        where: { userId: principal.userId },
      });
      if (dto.kind === 'GOOGLE' && !profile.googleAvatar)
        throw new BadRequestException();

      await tx.profile.update({
        where: { userId: principal.userId },
        data: {
          avatarKind: dto.kind,
          avatarPreset: dto.kind === 'PRESET' ? String(dto.preset) : null,
          avatarMediaId: null,
        },
      });
      return removeAvatarRecord(tx, profile.avatarMediaId);
    });
    await removeAvatarFile(this.config.avatarDirectory, path);
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

  private presentAvatar(
    userId: string,
    profile: {
      avatarKind: AvatarKind;
      avatarPreset: string | null;
      googleAvatar: string | null;
    },
  ) {
    const kind = profile.avatarKind;
    if (kind === 'PERSONAL')
      return { kind, url: `/api/v1/profiles/${userId}/avatar` };
    if (kind === 'PRESET')
      return { kind, preset: Number(profile.avatarPreset) };
    if (kind === 'GOOGLE' && profile.googleAvatar)
      return { kind, url: profile.googleAvatar };
    return { kind: 'DEFAULT' };
  }

  private async prepareImage(input: Buffer) {
    try {
      const image = sharp(input, {
        limitInputPixels: 16_000_000,
        failOn: 'warning',
      });
      const metadata = await image.metadata();
      if (
        !['jpeg', 'png', 'webp'].includes(metadata.format ?? '') ||
        (metadata.pages ?? 1) > 1
      ) {
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

  @Post('me/avatar')
  @HttpCode(200)
  @UseGuards(AuthRateGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
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
