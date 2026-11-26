import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import sharp from 'sharp';
import { Prisma } from '../../generated/prisma/client.js';
import type { Media } from '../../generated/prisma/client.js';
import { SessionService } from '../auth/session.service.js';
import type { Principal } from '../auth/session.service.js';
import { PrismaService } from '../prisma/prisma.module.js';
import type {
  MediaDto,
  MediaFolderDto,
  MediaLibraryQuery,
  MoveMediaDto,
  NamedDto,
} from './content.dto.js';
import { contentLog, lockAdmin, lockMediaFolder } from './content.shared.js';
import { imageFormat } from './image-format.js';
import { gpxBlockUsage, gpxLibrary, gpxPath } from './trails.js';

const library = {
  type: 'IMAGE',
  path: { startsWith: 'content/' },
} satisfies Prisma.MediaWhereInput;
const published = {
  kind: 'PUBLISHED',
  article: { status: 'PUBLISHED' },
} satisfies Prisma.ArticleVersionWhereInput;
const publiclyUsed = {
  // Les blocs de la page Association sont directement publiés à l’enregistrement.
  OR: [
    { articleCovers: { some: published } },
    { articleBlocks: { some: { version: published } } },
    { associationBlocks: { some: {} } },
  ],
} satisfies Prisma.MediaWhereInput;
const adminUsed = {
  OR: [
    { articleCovers: { some: {} } },
    { articleBlocks: { some: {} } },
    { associationBlocks: { some: {} } },
  ],
} satisfies Prisma.MediaWhereInput;
const libraryTypes = [library, gpxLibrary];
const pageSize = 24;
const sortOrder = {
  name: { name: 'asc' },
  date: { createdAt: 'desc' },
  size: { sizeBytes: 'desc' },
} satisfies Record<string, Prisma.MediaOrderByWithRelationInput>;
const formats = {
  jpeg: { db: 'JPEG', display: 'JPG', mime: 'image/jpeg' },
  png: { db: 'PNG', display: 'PNG', mime: 'image/png' },
  webp: { db: 'WEBP', display: 'WebP', mime: 'image/webp' },
} as const;
const directory = 'storage/content-images';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  async list(admin: boolean, db: Prisma.TransactionClient) {
    const items = await db.media.findMany({
      // L’instantané de contenu ne transporte que les références utiles au rendu.
      where: { ...library, ...(admin ? adminUsed : publiclyUsed) },
    });
    return items.map((item) => this.present(item, admin));
  }

  async browse(query: MediaLibraryQuery) {
    const page = query.page ?? 1;
    const search = query.q?.trim().replace(/[\\%_]/g, '\\$&');
    const matches = { contains: search, mode: 'insensitive' } as const;
    const where: Prisma.MediaWhereInput = {
      AND: [
        {
          OR:
            query.type === 'IMAGE'
              ? [library]
              : query.type === 'GPX'
                ? [gpxLibrary]
                : libraryTypes,
        },
        ...(search ? [{ OR: [{ name: matches }, { altText: matches }] }] : []),
        ...(query.folder
          ? [{ folderId: query.folder === 'unfiled' ? null : query.folder }]
          : []),
      ],
    };
    return this.prisma.$transaction(
      async (tx) => {
        const total = await tx.media.count({ where });
        const items = await tx.media.findMany({
          where,
          orderBy: [sortOrder[query.sort ?? 'date'], { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        });
        return {
          total,
          pageSize,
          items: items.map((item) => this.presentLibraryItem(item)),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async details(id: string) {
    const item = await this.prisma.media.findFirst({
      where: { id, OR: libraryTypes },
      include: {
        _count: {
          select: { profiles: true, associationBlocks: true, trails: true },
        },
        articleCovers: { select: { articleId: true, title: true } },
        articleBlocks: {
          select: { version: { select: { articleId: true, title: true } } },
        },
      },
    });
    if (!item) throw new NotFoundException();
    const versions = [
      ...item.articleCovers,
      ...item.articleBlocks.map((block) => block.version),
    ];
    const metadata =
      item.type === 'IMAGE'
        ? await sharp(this.resolve(item.path))
            .metadata()
            .catch(() => null)
        : null;
    const trails =
      item.type === 'GPX'
        ? item._count.trails + (await gpxBlockUsage(this.prisma, id))
        : 0;
    return {
      ...this.presentLibraryItem(item),
      largeur: metadata?.width ?? 0,
      hauteur: metadata?.height ?? 0,
      usage: {
        articles: [
          ...new Map(
            versions.map((version) => [version.articleId, version.title]),
          ).values(),
        ],
        avatars: item._count.profiles,
        association: Boolean(item._count.associationBlocks),
        trails,
      },
    };
  }

  folders() {
    return this.prisma.mediaFolder.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  createFolder(actor: Principal, dto: MediaFolderDto) {
    const name = dto.nom.trim();
    if (!name) throw new BadRequestException('Saisissez un nom de dossier.');
    return this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      await lockMediaFolder(tx, dto.parentId);
      return tx.mediaFolder.create({ data: { name, parentId: dto.parentId } });
    });
  }

  renameFolder(actor: Principal, id: string, dto: NamedDto) {
    const name = dto.nom.trim();
    if (!name) throw new BadRequestException('Saisissez un nom de dossier.');
    return this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      await lockMediaFolder(tx, id);
      await tx.mediaFolder.update({ where: { id }, data: { name } });
    });
  }

  deleteFolder(actor: Principal, id: string, confirmed: boolean) {
    if (!confirmed)
      throw new BadRequestException('Confirmez la suppression du dossier.');
    return this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      // Les deux clés étrangères replacent les éléments directs à la racine.
      const deleted = await tx.mediaFolder.deleteMany({ where: { id } });
      if (!deleted.count)
        throw new NotFoundException('Ce dossier n’existe plus.');
    });
  }

  move(actor: Principal, dto: MoveMediaDto) {
    return this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      await lockMediaFolder(tx, dto.folderId);
      const items = await tx.media.findMany({
        where: { id: { in: dto.ids }, OR: libraryTypes },
        select: { id: true },
      });
      if (items.length !== dto.ids.length)
        throw new NotFoundException(
          'Un des médias sélectionnés n’est plus disponible.',
        );
      // Le classement ne modifie pas la version du fichier utilisée dans les URL.
      const ids = Prisma.join(items.map(({ id }) => Prisma.sql`${id}::uuid`));
      const updated = await tx.$executeRaw`
        UPDATE media SET folder_id = ${dto.folderId}::uuid WHERE id IN (${ids})
      `;
      if (updated !== dto.ids.length)
        throw new NotFoundException(
          'Un des médias sélectionnés n’est plus disponible.',
        );
    });
  }

  async file(id: string, admin: boolean, thumbnail = false) {
    const item = await this.prisma.media.findFirst({
      where: admin ? { ...library, id } : { ...library, ...publiclyUsed, id },
    });
    if (!item) throw new NotFoundException();
    const type = Object.values(formats).find(
      (format) => format.db === item.format,
    );
    if (!type) throw new NotFoundException();
    try {
      if (thumbnail) {
        const data = await sharp(this.resolve(item.path))
          .resize(360, 270, { fit: 'inside', withoutEnlargement: true })
          .webp()
          .toBuffer();
        return { data, mime: 'image/webp' };
      }
      return { data: await readFile(this.resolve(item.path)), mime: type.mime };
    } catch {
      throw new NotFoundException();
    }
  }

  async write(
    actor: Principal,
    buffer: Buffer | undefined,
    dto?: MediaDto,
    id?: string,
    folderId?: string,
  ) {
    if (!id && (!dto?.nom.trim() || !dto.alt.trim()))
      throw new BadRequestException();
    const image = await this.decode(buffer);
    const path = `content/${randomUUID()}.${image.extension}`;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(this.resolve(path), image.data, {
      flag: 'wx',
      mode: 0o600,
    });
    let previous: string | undefined;
    try {
      previous = await this.prisma.$transaction(async (tx) => {
        await lockAdmin(tx, this.sessions, actor);
        const data = {
          path,
          format: image.format,
          sizeBytes: BigInt(image.data.length),
        };
        if (!id) {
          await lockMediaFolder(tx, folderId);
          const item = await tx.media.create({
            data: {
              ...data,
              type: 'IMAGE',
              name: dto!.nom.trim(),
              altText: dto!.alt.trim(),
              folderId,
            },
          });
          await contentLog(
            tx,
            actor.userId,
            'MEDIA',
            item.id,
            'CREATE',
            'Image importée.',
          );
          return;
        }
        const item = await this.lock(tx, id);
        await tx.media.update({ where: { id }, data });
        await contentLog(
          tx,
          actor.userId,
          'MEDIA',
          id,
          'UPDATE',
          'Fichier image remplacé.',
        );
        return item.path;
      });
    } catch (error) {
      // Une réponse de commit perdue ne doit pas faire supprimer un fichier référencé.
      const stored = await this.prisma.media
        .findUnique({ where: { path } })
        .catch(() => undefined);
      if (stored === null) await this.remove(path);
      throw error;
    }
    if (previous) await this.remove(previous);
  }

  update(actor: Principal, id: string, dto: MediaDto) {
    if (!dto.nom.trim()) throw new BadRequestException();
    return this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      const item = await this.lock(tx, id, true);
      if (item.type === 'IMAGE' && !dto.alt.trim())
        throw new BadRequestException('Le texte alternatif est obligatoire.');
      await tx.media.update({
        where: { id },
        data: {
          name: dto.nom.trim(),
          altText: item.type === 'IMAGE' ? dto.alt.trim() : null,
        },
      });
      await contentLog(
        tx,
        actor.userId,
        'MEDIA',
        id,
        'UPDATE',
        'Métadonnées du média modifiées.',
      );
    });
  }

  async delete(actor: Principal, id: string) {
    const path = await this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      const item = await this.lock(tx, id, true);
      const usage = await tx.media.findUniqueOrThrow({
        where: { id },
        select: {
          _count: {
            select: {
              profiles: true,
              articleCovers: true,
              articleBlocks: true,
              associationBlocks: true,
              trails: true,
            },
          },
        },
      });
      if (Object.values(usage._count).some((count) => count > 0))
        throw new ConflictException(
          'Ce média est utilisé et ne peut pas être supprimé.',
        );
      if (item.type === 'GPX' && (await gpxBlockUsage(tx, id)))
        throw new ConflictException(
          'Ce GPX est utilisé par un article et ne peut pas être supprimé.',
        );
      await tx.media.delete({ where: { id } });
      await contentLog(
        tx,
        actor.userId,
        'MEDIA',
        id,
        'DELETE',
        item.type === 'GPX' ? 'Fichier GPX supprimé.' : 'Image supprimée.',
      );
      return item.path;
    });
    await this.remove(path);
  }

  private async lock(
    tx: Prisma.TransactionClient,
    id: string,
    includeGpx = false,
  ) {
    await tx.$queryRaw`SELECT id FROM media WHERE id = ${id}::uuid FOR UPDATE`;
    const item = await tx.media.findFirst({
      where: { id, OR: includeGpx ? [library, gpxLibrary] : [library] },
    });
    if (!item) throw new NotFoundException();
    return item;
  }

  private resolve(path: string) {
    const filename = /^content\/([a-f0-9-]{36}\.(?:jpeg|png|webp))$/i.exec(
      path,
    )?.[1];
    if (!filename) throw new NotFoundException();
    return join(directory, filename);
  }

  private async remove(path: string) {
    try {
      await unlink(
        path.startsWith('trails/') ? gpxPath(path) : this.resolve(path),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        this.logger.warn('Un fichier média doit être purgé.');
    }
  }

  private async decode(buffer?: Buffer) {
    if (!buffer?.length) throw new BadRequestException();
    const extension = imageFormat(buffer);
    if (!extension) throw new UnsupportedMediaTypeException();
    try {
      const image = sharp(buffer, {
        limitInputPixels: 24_000_000,
        failOn: 'warning',
      });
      const metadata = await image.metadata();
      if (metadata.format !== extension || (metadata.pages ?? 1) !== 1)
        throw new UnsupportedMediaTypeException();
      const data = await image.autoOrient().toFormat(extension).toBuffer();
      if (data.length > 10 * 1024 * 1024) throw new BadRequestException();
      return { data, extension, format: formats[extension].db };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new UnsupportedMediaTypeException();
    }
  }

  private presentLibraryItem(item: Media) {
    const common = {
      type: item.type,
      folderId: item.folderId,
      id: item.id,
      nom: item.name,
      createdAt: item.createdAt,
      tailleKo: Math.max(1, Math.round(Number(item.sizeBytes) / 1024)),
    };
    if (item.type === 'GPX') return { ...common, type: 'GPX' as const };
    return {
      ...this.present(item, true),
      ...common,
      type: 'IMAGE' as const,
      thumbnail: `/admin/content/media/${item.id}/thumbnail?v=${item.updatedAt.getTime()}`,
    };
  }

  private present(item: Media, admin: boolean) {
    return {
      id: item.id,
      nom: item.name,
      alt: item.altText ?? '',
      format: Object.values(formats).find((format) => format.db === item.format)
        ?.display,
      tailleKo: Math.max(1, Math.round(Number(item.sizeBytes) / 1024)),
      largeur: 0,
      hauteur: 0,
      createdAt: item.createdAt,
      file: admin
        ? `/admin/content/media/${item.id}/file?v=${item.updatedAt.getTime()}`
        : `/media/${item.id}?v=${item.updatedAt.getTime()}`,
    };
  }
}
