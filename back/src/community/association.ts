import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsString,
  MaxLength,
  ValidateNested,
  isEmail,
} from 'class-validator';
import type {
  Association,
  AssociationBlock,
} from '../../generated/prisma/client.js';
import {
  AccessGuard,
  BrowserOriginGuard,
  CurrentUser,
  RoleGuard,
  Roles,
} from '../auth/access.guard.js';
import { SessionService } from '../auth/session.service.js';
import type { Principal } from '../auth/session.service.js';
import { blockInput, presentBlocks } from '../content/articles.service.js';
import { BlockDto } from '../content/content.dto.js';
import { contentLog, lockAdmin } from '../content/content.shared.js';
import { PrismaService } from '../prisma/prisma.module.js';

class CoordinatesDto {
  @IsString() @MaxLength(300) adresse: string;
  @IsString() @MaxLength(25) codePostal: string;
  @IsString() @MaxLength(100) ville: string;
  @IsString() @MaxLength(20) telephone: string;
  @IsString() @MaxLength(254) email: string;
  @IsString() @MaxLength(32) latitude: string;
  @IsString() @MaxLength(32) longitude: string;
  @IsString() @MaxLength(2000) horaires: string;
  @IsString() @MaxLength(2048) facebook: string;
  @IsString() @MaxLength(2048) instagram: string;
  @IsString() @MaxLength(2048) youtube: string;
}

class AssociationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockDto)
  blocks: BlockDto[];
  @ValidateNested() @Type(() => CoordinatesDto) coordonnees: CoordinatesDto;
}

const include = { blocks: { orderBy: { position: 'asc' as const } } };
function represent(
  entity: (Association & { blocks: AssociationBlock[] }) | null,
) {
  const links = (entity?.socialLinks ?? {}) as Record<string, string>;
  return {
    blocks: entity ? presentBlocks(entity) : [],
    updatedAt: entity?.updatedAt ?? null,
    coordonnees: {
      adresse: entity?.address ?? '',
      codePostal: entity?.postalCode ?? '',
      ville: entity?.city ?? '',
      telephone: entity?.phone ?? '',
      email: entity?.email ?? '',
      latitude: entity?.latitude?.toString() ?? '',
      longitude: entity?.longitude?.toString() ?? '',
      horaires: entity?.hours ?? '',
      facebook: links.facebook ?? '',
      instagram: links.instagram ?? '',
      youtube: links.youtube ?? '',
    },
  };
}

@Injectable()
export class AssociationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  async read() {
    return represent(
      await this.prisma.association.findFirst({
        include,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    );
  }

  write(actor: Principal, input: AssociationDto) {
    if (!input.coordonnees) throw new BadRequestException();
    const c = input.coordonnees;
    const lat = c.latitude.trim();
    const lon = c.longitude.trim();
    const latitude = lat ? Number(lat) : null;
    const longitude = lon ? Number(lon) : null;
    if (
      (latitude === null) !== (longitude === null) ||
      (latitude !== null &&
        (!Number.isFinite(latitude) || Math.abs(latitude) > 90)) ||
      (longitude !== null &&
        (!Number.isFinite(longitude) || Math.abs(longitude) > 180)) ||
      (c.email.trim() && !isEmail(c.email.trim()))
    )
      throw new BadRequestException();
    const socialLinks = {
      facebook: safeLink(c.facebook),
      instagram: safeLink(c.instagram),
      youtube: safeLink(c.youtube),
    };
    const blocks = input.blocks.map(blockInput);
    return this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(8476104)`;
      const ids = [
        ...new Set(
          blocks.flatMap((block) => (block.mediaId ? [block.mediaId] : [])),
        ),
      ];
      if (
        ids.length !==
        (await tx.media.count({
          where: {
            id: { in: ids },
            type: 'IMAGE',
            path: { startsWith: 'content/' },
          },
        }))
      ) {
        throw new BadRequestException();
      }
      const current = await tx.association.findFirst({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });
      const data = {
        address: c.adresse.trim() || null,
        postalCode: c.codePostal.trim() || null,
        city: c.ville.trim() || null,
        phone: c.telephone.trim() || null,
        email: c.email.trim() || null,
        latitude,
        longitude,
        hours: c.horaires.trim() || null,
        socialLinks,
      };
      if (current)
        await tx.associationBlock.deleteMany({
          where: { associationId: current.id },
        });
      const entity = current
        ? await tx.association.update({
            where: { id: current.id },
            data: { ...data, blocks: { create: blocks } },
            include,
          })
        : await tx.association.create({
            data: {
              ...data,
              name: 'Foyer rural d’Arches',
              description: '',
              blocks: { create: blocks },
            },
            include,
          });
      await contentLog(
        tx,
        actor.userId,
        'ASSOCIATION',
        entity.id,
        current ? 'UPDATE' : 'CREATE',
        'Contenu et coordonnées de l’association enregistrés.',
      );
      return represent(entity);
    });
  }
}

function safeLink(value: string) {
  if (!value.trim()) return '';
  const url = URL.parse(value.trim());
  if (!url || url.protocol !== 'https:' || url.username || url.password)
    throw new BadRequestException();
  return url.href;
}

@Controller()
export class AssociationController {
  constructor(private readonly association: AssociationService) {}
  @Get('association')
  get() {
    return this.association.read();
  }

  @Patch('admin/association')
  @UseGuards(AccessGuard, BrowserOriginGuard, RoleGuard)
  @Roles('ADMIN')
  update(@CurrentUser() actor: Principal, @Body() dto: AssociationDto) {
    return this.association.write(actor, dto);
  }
}
