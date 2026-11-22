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
import type { Media, Prisma } from '../../generated/prisma/client.js';
import { SessionService } from '../auth/session.service.js';
import type { Principal } from '../auth/session.service.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { MediaDto } from './content.dto.js';
import { contentLog, lockAdmin } from './content.shared.js';

const library = {
  type: 'IMAGE',
  path: { startsWith: 'content/' },
} satisfies Prisma.MediaWhereInput;
const published = {
  kind: 'PUBLISHED',
  article: { status: 'PUBLISHED' },
} satisfies Prisma.ArticleVersionWhereInput;
const publiclyUsed = {
  OR: [
    { articleCovers: { some: published } },
    { articleBlocks: { some: { version: published } } },
  ],
} satisfies Prisma.MediaWhereInput;
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
    if (!admin) {
      const items = await db.media.findMany({
        where: { ...library, ...publiclyUsed },
      });
      return Promise.all(items.map((item) => this.present(item, false)));
    }
    const items = await db.media.findMany({
      where: library,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: {
        _count: { select: { profiles: true, associationBlocks: true } },
        articleCovers: { select: { articleId: true, title: true } },
        articleBlocks: {
          select: { version: { select: { articleId: true, title: true } } },
        },
      },
    });
    return Promise.all(
      items.map(async (item) => {
        const base = await this.present(item, true);
        const versions = [
          ...item.articleCovers,
          ...item.articleBlocks.map((block) => block.version),
        ];
        return {
          ...base,
          usage: {
            articles: [
              ...new Map(
                versions.map((version) => [version.articleId, version.title]),
              ).values(),
            ],
            avatars: item._count.profiles,
            association: Boolean(item._count.associationBlocks),
          },
        };
      }),
    );
  }

  async file(id: string, admin: boolean) {
    const item = await this.prisma.media.findFirst({
      where: admin ? { ...library, id } : { ...library, ...publiclyUsed, id },
    });
    if (!item) throw new NotFoundException();
    const type = Object.values(formats).find(
      (format) => format.db === item.format,
    );
    if (!type) throw new NotFoundException();
    try {
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
          const item = await tx.media.create({
            data: {
              ...data,
              type: 'IMAGE',
              name: dto!.nom.trim(),
              altText: dto!.alt.trim(),
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
    if (!dto.nom.trim() || !dto.alt.trim()) throw new BadRequestException();
    return this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      await this.lock(tx, id);
      await tx.media.update({
        where: { id },
        data: { name: dto.nom.trim(), altText: dto.alt.trim() },
      });
      await contentLog(
        tx,
        actor.userId,
        'MEDIA',
        id,
        'UPDATE',
        'Métadonnées de l’image modifiées.',
      );
    });
  }

  async delete(actor: Principal, id: string) {
    const path = await this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      const item = await this.lock(tx, id);
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
        throw new ConflictException();
      await tx.media.delete({ where: { id } });
      await contentLog(
        tx,
        actor.userId,
        'MEDIA',
        id,
        'DELETE',
        'Image supprimée.',
      );
      return item.path;
    });
    await this.remove(path);
  }

  private async lock(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM media WHERE id = ${id}::uuid FOR UPDATE`;
    const item = await tx.media.findFirst({ where: { ...library, id } });
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
      await unlink(this.resolve(path));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        this.logger.warn('Un fichier image doit être purgé.');
    }
  }

  private async decode(buffer?: Buffer) {
    if (!buffer?.length) throw new BadRequestException();
    const jpeg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
    const png = buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const webp =
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';
    if (!jpeg && !png && !webp) throw new UnsupportedMediaTypeException();
    try {
      const image = sharp(buffer, {
        limitInputPixels: 24_000_000,
        failOn: 'warning',
      });
      const metadata = await image.metadata();
      const extension = metadata.format as keyof typeof formats;
      if (!Object.hasOwn(formats, extension) || (metadata.pages ?? 1) !== 1)
        throw new UnsupportedMediaTypeException();
      const data = await image.autoOrient().toFormat(extension).toBuffer();
      if (data.length > 10 * 1024 * 1024) throw new BadRequestException();
      return { data, extension, format: formats[extension].db };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new UnsupportedMediaTypeException();
    }
  }

  private async present(item: Media, admin: boolean) {
    const metadata = admin
      ? await sharp(this.resolve(item.path))
          .metadata()
          .catch(() => null)
      : null;
    return {
      id: item.id,
      nom: item.name,
      alt: item.altText ?? '',
      format: Object.values(formats).find((format) => format.db === item.format)
        ?.display,
      tailleKo: Math.max(1, Math.round(Number(item.sizeBytes) / 1024)),
      largeur: metadata?.width ?? 0,
      hauteur: metadata?.height ?? 0,
      createdAt: item.createdAt,
      file: admin
        ? `/admin/content/media/${item.id}/file?v=${item.updatedAt.getTime()}`
        : `/media/${item.id}?v=${item.updatedAt.getTime()}`,
    };
  }
}
