import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
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
import { pdfMaxBytes } from '../config/runtime.module.js';
import type {
  MediaDto,
  MediaClassificationDto,
  MediaFolderDto,
  MediaLibraryQuery,
  MoveMediaDto,
  NamedDto,
} from './content.dto.js';
import { contentLog, lockAdmin, lockMediaFolder } from './content.shared.js';
import { imageFormat } from './image-format.js';
import { pdfDisposition, validatePdfUpload } from './pdf-document.js';
import type { PdfUpload } from './pdf-document.js';
import { pdfPageCount, renderPdfPage } from './pdf-render.js';
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
    { articleBlockImages: { some: { block: { version: published } } } },
    { categoryVisuals: { some: { articles: { some: { version: published } } } } },
    { associationBlocks: { some: {} } },
  ],
} satisfies Prisma.MediaWhereInput;
const adminUsed = {
  OR: [
    { articleCovers: { some: {} } },
    { articleBlocks: { some: {} } },
    { articleBlockImages: { some: {} } },
    { categoryVisuals: { some: {} } },
    { associationBlocks: { some: {} } },
  ],
} satisfies Prisma.MediaWhereInput;
const pdfLibrary = { type: 'PDF', path: { startsWith: 'content/' } } satisfies Prisma.MediaWhereInput;
const libraryByType = { IMAGE: { ...library, previewOfId: null }, GPX: gpxLibrary, PDF: pdfLibrary };
const libraryTypes = Object.values(libraryByType);
const articleUsage = {
  articleCovers: { select: { articleId: true, title: true } },
  articleBlocks: { select: { version: { select: { articleId: true, title: true } } } },
  articleBlockImages: { select: { block: { select: { version: { select: { articleId: true, title: true } } } } } },
} satisfies Prisma.MediaInclude;
type LibraryMedia = Omit<Media, 'gpxElevations'>;
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
  private readonly previews = new Map<string, Promise<ReturnType<MediaService['present']>>>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  async list(admin: boolean, db: Prisma.TransactionClient) {
    const items = await db.media.findMany({
      omit: { gpxElevations: true },
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
          OR: query.type === 'VISUAL' ? [libraryByType.IMAGE, pdfLibrary] : query.type ? [libraryByType[query.type]] : libraryTypes,
        },
        ...(search ? [{ OR: [
          { name: matches }, { altText: matches }, { originalName: matches },
          { categories: { some: { name: matches } } }, { tags: { some: { name: matches } } },
        ] }] : []),
        ...(query.category ? [{ categories: { some: { id: query.category } } }] : []),
        ...(query.tag ? [{ tags: { some: { id: query.tag } } }] : []),
        ...(query.folder
          ? [{ folderId: query.folder === 'unfiled' ? null : query.folder }]
          : []),
      ],
    };
    return this.prisma.$transaction(
      async (tx) => {
        const total = await tx.media.count({ where });
        const items = await tx.media.findMany({
          omit: { gpxElevations: true },
          where,
          orderBy: [sortOrder[query.sort ?? 'date'], { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        });
        return {
          total,
          pageSize,
          pdfMaxBytes,
          items: items.map((item) => this.presentLibraryItem(item)),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async details(id: string) {
    const item = await this.prisma.media.findFirst({
      where: { id, OR: libraryTypes },
      omit: { gpxElevations: true },
      include: {
        categories: { select: { id: true } },
        tags: { select: { id: true } },
        _count: {
          select: { profiles: true, associationBlocks: true, trails: true },
        },
        ...articleUsage,
        preview: { select: { ...articleUsage, _count: { select: { profiles: true, associationBlocks: true } }, categoryVisuals: { select: { name: true } } } },
        categoryVisuals: { select: { name: true }, orderBy: { name: 'asc' } },
      },
    });
    if (!item) throw new NotFoundException();
    const references = item.preview ? [item, item.preview] : [item];
    const versions = references.flatMap(source => [
      ...source.articleCovers, ...source.articleBlocks.map(block => block.version),
      ...source.articleBlockImages.map(({ block }) => block.version),
    ]);
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
      categorieIds: item.categories.map(category => category.id),
      tagIds: item.tags.map(tag => tag.id),
      largeur: metadata?.width ?? 0,
      hauteur: metadata?.height ?? 0,
      usage: {
        articles: [
          ...new Map(
            versions.map((version) => [version.articleId, version.title]),
          ).values(),
        ],
        avatars: item._count.profiles + (item.preview?._count.profiles ?? 0),
        association: Boolean(item._count.associationBlocks || item.preview?._count.associationBlocks),
        trails,
        categoryVisuals: references.flatMap(source => source.categoryVisuals.map(category => category.name)),
      },
    };
  }

  classify(actor: Principal, id: string, dto: MediaClassificationDto) {
    return this.prisma.$transaction(async tx => {
      await lockAdmin(tx, this.sessions, actor);
      await this.lock(tx, id, true);
      const categories = dto.categorieIds.map(id => ({ id }));
      const tags = dto.tagIds.map(id => ({ id }));
      if (await tx.category.count({ where: { id: { in: dto.categorieIds } } }) !== categories.length ||
          await tx.tag.count({ where: { id: { in: dto.tagIds } } }) !== tags.length)
        throw new BadRequestException();
      await tx.media.update({
        where: { id },
        data: { categories: { set: categories }, tags: { set: tags } },
      });
      await contentLog(tx, actor.userId, 'MEDIA', id, 'UPDATE', 'Catégories et tags du média mis à jour.');
    });
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
    if (!id && (!dto?.nom.trim() || (!dto.decorative && !dto.alt.trim())))
      throw new BadRequestException();
    const image = await this.decode(buffer);
    return this.storeContent(actor, image, dto && {
      type: 'IMAGE', name: dto.nom.trim(), altText: dto.decorative ? '' : dto.alt.trim(), folderId,
    }, id);
  }

  uploadPdf(actor: Principal, file: PdfUpload | undefined, dto: NamedDto, folderId?: string) {
    const { originalName, data } = validatePdfUpload(file);
    return this.storeContent(actor, { data, extension: 'pdf', format: 'PDF' }, {
      type: 'PDF', name: dto.nom.trim() || originalName, originalName, folderId,
    });
  }

  pdfVisual(actor: Principal, id: string) {
    const pending = this.previews.get(id);
    if (pending) return pending;
    const creation = this.ensurePdfVisual(actor, id).finally(() => this.previews.delete(id));
    this.previews.set(id, creation);
    return creation;
  }

  private async ensurePdfVisual(actor: Principal, id: string) {
    const source = await this.prisma.media.findFirst({ where: { id, ...pdfLibrary }, include: { preview: true } });
    if (!source) throw new NotFoundException();
    if (source.preview) return this.present(source.preview, true);
    const data = await renderPdfPage(this.resolve(source.path), 1, true);
    try {
      const preview = await this.storeContent(actor, { data, extension: 'png', format: 'PNG' }, {
        type: 'IMAGE', name: source.name, altText: source.name, previewOfId: id,
      });
      if (preview?.type === 'IMAGE') return preview;
      throw new NotFoundException();
    } catch (error) {
      // L’index unique protège aussi deux instances qui génèrent le même aperçu.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const preview = await this.prisma.media.findUnique({ where: { previewOfId: id } });
      if (!preview) throw error;
      return this.present(preview, true);
    }
  }

  async articlePdf(articleId: string, blockId: string, download: boolean, admin = false, slide?: number) {
    return this.openPdf(await this.articlePdfSource(articleId, blockId, download, admin, slide), download);
  }

  async articlePdfRaster(articleId: string, blockId: string, admin: boolean, page?: number, slide?: number) {
    const media = await this.articlePdfSource(articleId, blockId, false, admin, slide);
    const path = this.resolve(media.path);
    return page === undefined ? { pages: await pdfPageCount(path) } : renderPdfPage(path, page);
  }

  private async articlePdfSource(articleId: string, blockId: string, download: boolean, admin: boolean, slide?: number) {
    // L’autorisation porte sur le bloc et sa version, même si le fichier est réutilisé ailleurs.
    const version = { articleId, ...(admin ? {} : published) };
    const sourceFields = { path: true, originalName: true } as const;
    if (slide !== undefined) {
      if (slide < 0 || slide >= 24) throw new NotFoundException();
      const image = await this.prisma.articleBlockImage.findFirst({
        where: { position: slide, block: { id: blockId, type: 'CAROUSEL', version }, media: { previewOf: pdfLibrary } },
        select: { viewPdf: true, downloadPdf: true, media: { select: { previewOf: { select: sourceFields } } } },
      });
      if (!image?.media.previewOf || !(download ? image.downloadPdf : image.viewPdf)) throw new NotFoundException();
      return image.media.previewOf;
    }
    const block = await this.prisma.articleBlock.findFirst({
      where: {
        id: blockId, version,
        OR: [{ type: 'PDF', media: pdfLibrary }, { type: 'IMAGE', media: { previewOf: pdfLibrary } }],
      },
      select: { type: true, data: true, media: { select: { ...sourceFields, previewOf: { select: sourceFields } } } },
    });
    const data = block?.data as { pdf?: { display?: boolean; download?: boolean }; viewPdf?: boolean; downloadPdf?: boolean } | null | undefined;
    if (block?.type === 'IMAGE') {
      if (!block.media?.previewOf || (download ? data?.downloadPdf : data?.viewPdf) !== true) throw new NotFoundException();
      return block.media.previewOf;
    }
    const settings = data?.pdf;
    if (!block?.media || (download ? settings?.download : settings?.display) !== true) throw new NotFoundException();
    return block.media;
  }

  async libraryPdf(id: string) {
    const media = await this.prisma.media.findFirst({
      where: { id, ...pdfLibrary }, select: { path: true, originalName: true },
    });
    if (!media) throw new NotFoundException();
    return this.openPdf(media, false);
  }

  private async openPdf(media: Pick<Media, 'path' | 'originalName'>, download: boolean) {
    const file = await open(this.resolve(media.path), 'r').catch(() => null);
    if (!file) throw new NotFoundException();
    try {
      const stats = await file.stat();
      if (!stats.isFile() || !stats.size) throw new NotFoundException();
      return {
        stream: file.createReadStream(), length: stats.size,
        disposition: pdfDisposition(media.originalName ?? 'document.pdf', download),
      };
    } catch {
      await file.close();
      throw new NotFoundException();
    }
  }

  private async storeContent(
    actor: Principal,
    file: { data: Buffer; extension: string; format: Media['format'] },
    creation?: Pick<Media, 'type' | 'name'> & { altText?: string; originalName?: string; folderId?: string; previewOfId?: string },
    id?: string,
  ) {
    const path = `content/${randomUUID()}.${file.extension}`;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(this.resolve(path), file.data, {
      flag: 'wx',
      mode: 0o600,
    });
    let result;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        await lockAdmin(tx, this.sessions, actor);
        const data = {
          path,
          format: file.format,
          sizeBytes: BigInt(file.data.length),
        };
        if (!id) {
          if (!creation) throw new BadRequestException();
          await lockMediaFolder(tx, creation.folderId);
          const item = await tx.media.create({
            data: {
              ...data,
              ...creation,
            },
          });
          await contentLog(
            tx,
            actor.userId,
            'MEDIA',
            item.id,
            'CREATE',
            creation.type === 'PDF' ? 'Document PDF importé.' : 'Image importée.',
          );
          return { imported: this.presentLibraryItem(item) };
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
        return { previous: item.path };
      });
    } catch (error) {
      // Une réponse de commit perdue ne doit pas faire supprimer un fichier référencé.
      const stored = await this.prisma.media
        .findUnique({ where: { path } })
        .catch(() => undefined);
      if (stored === null) await this.remove(path);
      throw error;
    }
    if (result.previous) await this.remove(result.previous);
    return result.imported;
  }

  update(actor: Principal, id: string, dto: MediaDto) {
    if (!dto.nom.trim()) throw new BadRequestException();
    return this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      const item = await this.lock(tx, id, true);
      if (item.type === 'IMAGE' && !dto.decorative && !dto.alt.trim())
        throw new BadRequestException('Le texte alternatif est obligatoire.');
      await tx.media.update({
        where: { id },
        data: {
          name: dto.nom.trim(),
          altText: item.type === 'IMAGE' ? (dto.decorative ? '' : dto.alt.trim()) : null,
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
    const paths = await this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      const item = await this.lock(tx, id, true);
      const usage = await tx.media.findUniqueOrThrow({
        where: { id },
        select: {
          preview: {
            select: {
              path: true,
              _count: { select: { profiles: true, articleCovers: true, articleBlocks: true, articleBlockImages: true, categoryVisuals: true, associationBlocks: true } },
            },
          },
          _count: {
            select: {
              profiles: true,
              articleCovers: true,
              articleBlocks: true,
              articleBlockImages: true,
              categoryVisuals: true,
              associationBlocks: true,
              trails: true,
            },
          },
        },
      });
      // L’aperçu d’un PDF est supprimé avec lui : ses usages bloquent donc aussi la suppression du PDF.
      const counts = [usage._count, ...(usage.preview ? [usage.preview._count] : [])];
      if (counts.some(count => Object.values(count).some(value => value > 0)))
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
        item.type === 'IMAGE' ? 'Image supprimée.' : `Fichier ${item.type} supprimé.`,
      );
      return [item.path, ...(usage.preview ? [usage.preview.path] : [])];
    });
    for (const path of paths) await this.remove(path);
  }

  private async lock(
    tx: Prisma.TransactionClient,
    id: string,
    includeLibrary = false,
  ) {
    await tx.$queryRaw`SELECT id FROM media WHERE id = ${id}::uuid FOR UPDATE`;
    const item = await tx.media.findFirst({
      where: { id, OR: includeLibrary ? libraryTypes : [libraryByType.IMAGE] },
    });
    if (!item) throw new NotFoundException();
    return item;
  }

  private resolve(path: string) {
    const filename = /^content\/([a-f0-9-]{36}\.(?:jpeg|png|webp|pdf))$/i.exec(
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

  private presentLibraryItem(item: LibraryMedia) {
    const common = {
      type: item.type,
      folderId: item.folderId,
      id: item.id,
      nom: item.name,
      createdAt: item.createdAt,
      tailleKo: Math.max(1, Math.round(Number(item.sizeBytes) / 1024)),
    };
    if (item.type === 'GPX') return { ...common, type: 'GPX' as const };
    if (item.type === 'PDF') return { ...common, type: 'PDF' as const, originalName: item.originalName ?? item.name };
    return {
      ...this.present(item, true),
      ...common,
      type: 'IMAGE' as const,
      thumbnail: `/admin/content/media/${item.id}/thumbnail?v=${item.updatedAt.getTime()}`,
    };
  }

  private present(item: LibraryMedia, admin: boolean) {
    return {
      id: item.id,
      nom: item.name,
      alt: item.altText ?? '',
      ...(item.previewOfId ? { fromPdf: true, ...(admin ? { sourcePdfId: item.previewOfId } : {}) } : {}),
      ...(item.altText === '' ? { decorative: true } : {}),
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
