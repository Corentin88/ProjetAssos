import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { ArticleStatus, PublicNameFormat } from '../../generated/prisma/client.js';
import { formatPublicName } from '../profiles/public-name.js';
import { SessionService } from '../auth/session.service.js';
import type { Principal } from '../auth/session.service.js';
import { PrismaService } from '../prisma/prisma.module.js';
import {
  ArticleActionDto,
  ArticleDto,
  BlockDto,
  blockTypes,
} from './content.dto.js';
import { contentLog, contentSlug, lockAdmin } from './content.shared.js';
import { ContentInputError } from './content-input.error.js';
import { mapBlockInput, presentMapBlock, storedMapBlock } from './map-blocks.js';
import { TrailsService } from './trails.js';
import type { TrailDto } from './trails.js';

const articleInclude = {
  user: {
    select: { profile: { select: { firstName: true, lastName: true } } },
  },
  versions: {
    include: {
      blocks: { orderBy: { position: 'asc' } },
      categories: {
        orderBy: [{ category: { name: 'asc' } }, { categoryId: 'asc' }],
      },
      tags: { orderBy: [{ tag: { name: 'asc' } }, { tagId: 'asc' }] },
      trail: true,
    },
  },
} satisfies Prisma.ArticleInclude;

type StoredArticle = Prisma.ArticleGetPayload<{
  include: typeof articleInclude;
}>;
type Version = StoredArticle['versions'][number];
const states = {
  DRAFT: 'brouillon',
  SCHEDULED: 'programme',
  PUBLISHED: 'publie',
  TRASHED: 'corbeille',
} as const;
const frontendType = Object.fromEntries(
  Object.entries(blockTypes).map(([key, value]) => [value, key]),
);

export function presentBlocks(version: { blocks: Pick<Version['blocks'][number], 'id' | 'type' | 'data' | 'mediaId'>[] }, admin = false) {
  return version.blocks.map((block) => {
    const mapBlock = storedMapBlock(block.type, block.data);
    if (mapBlock) return presentMapBlock(mapBlock, block.id, admin);
    return {
      ...(block.data as {
        text?: string;
        alt?: string;
        url?: string;
        items?: string[];
      }),
      id: block.id,
      type: frontendType[block.type],
      mediaId: block.mediaId ?? undefined,
    };
  });
}

function present(article: StoredArticle, admin: boolean) {
  const published = article.versions.find(
    (version) => version.kind === 'PUBLISHED',
  );
  const working = article.versions.find(
    (version) => version.kind === 'WORKING',
  );
  const version = (admin ? (working ?? published) : published)!;
  const profile = article.user?.profile;
  const authorNameFormat = version.authorNameFormat ?? 'FULL';
  const auteurLabel = formatPublicName(profile, authorNameFormat);
  return {
    id: article.id,
    slug: article.slug,
    statut: states[article.status],
    auteurId: admin || authorNameFormat !== 'ADMIN' ? article.userId ?? '' : '',
    auteurLabel,
    auteurNom: authorNameFormat === 'FULL' ? profile?.lastName ?? '' : auteurLabel,
    ...(admin ? {
      authorNameFormat,
      authorNameOptions: {
        FULL: formatPublicName(profile, 'FULL'),
        INITIAL: formatPublicName(profile, 'INITIAL'),
        ADMIN: 'Admin',
      },
    } : {}),
    createdAt: article.createdAt,
    updatedAt: version.updatedAt,
    publishedAt: article.publishedAt,
    programmeAt: admin ? article.scheduledAt : null,
    titre: version.title,
    blocks: presentBlocks(version, admin),
    coverMediaId: version.coverMediaId,
    categorieIds: version.categories.map((link) => link.categoryId),
    tagIds: version.tags.map((link) => link.tagId),
    publicSnapshot:
      admin && working && published && article.status === 'PUBLISHED'
        ? presentBlocks(published)
        : null,
    misEnAvant: article.carouselPosition !== null,
    positionCarrousel: article.carouselPosition,
    trail: version.trail ? {
      name: version.trail.name, description: version.trail.description,
      distance: version.trail.distance, elevationGain: version.trail.elevationGain,
      elevationLoss: version.trail.elevationLoss, duration: version.trail.duration,
      difficulty: version.trail.difficulty, mapPreview: version.trail.mapPreview,
      ...(admin ? { gpxMediaId: version.trail.gpxMediaId } : {}),
    } : null,
  };
}

function youtubeLink(value: string) {
  const url = URL.parse(value);
  if (!url || !['https:', 'http:'].includes(url.protocol)) return false;
  const host = url.host.toLowerCase();
  const id =
    host === 'youtu.be'
      ? url.pathname.slice(1)
      : [
            'youtube.com',
            'www.youtube.com',
            'm.youtube.com',
            'www.youtube-nocookie.com',
          ].includes(host)
        ? url.pathname === '/watch'
          ? url.searchParams.get('v')
          : url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1]
        : null;
  return Boolean(
    id && /^[\w-]{11}$/.test(id) && !url.username && !url.password,
  );
}

export function blockInput(block: BlockDto, position: number) {
  if (block.type === 'randonnee' || block.type === 'localisation')
    throw new ContentInputError('Ce bloc est disponible dans les articles.');
  const type = blockTypes[block.type];
  const { text, items, alt, mediaId } = block;
  const url = block.url?.trim();
  if (type === 'IMAGE') {
    if (!mediaId || !alt?.trim())
      throw new ContentInputError(`Bloc ${position + 1} : choisissez une image et renseignez son texte alternatif.`);
    return { type, position, mediaId, data: { alt: alt.trim() } };
  }
  if (type === 'YOUTUBE' && url && !youtubeLink(url))
    throw new ContentInputError(`Bloc ${position + 1} : saisissez une adresse de vidéo YouTube valide.`);
  if (type === 'LINK' && url) {
    const relative = /^\/(?![\/\\])[^\\\r\n\t]*$/.test(url);
    const parsed = URL.parse(url);
    if (
      !relative &&
      (!parsed ||
        !['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password)
    ) {
      throw new ContentInputError(`Bloc ${position + 1} : corrigez l’adresse du lien.`);
    }
  }
  const data: Prisma.InputJsonObject = {
    ...(text !== undefined ? { text } : {}),
    ...(items !== undefined ? { items } : {}),
    ...(url !== undefined ? { url } : {}),
  };
  return { type, position, data };
}

@Injectable()
export class ArticlesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ArticlesService.name);
  private timer?: NodeJS.Timeout;
  private publishing?: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly trails: TrailsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.runScheduler(), 5000);
    this.timer.unref();
  }

  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.publishing;
  }

  private runScheduler() {
    this.publishing ??= this.publishDue()
      .catch(() => this.logger.warn('La publication programmée sera retentée.'))
      .finally(() => {
        this.publishing = undefined;
      });
  }

  async list(admin: boolean, client: Prisma.TransactionClient = this.prisma) {
    const items = await client.article.findMany({
      ...(admin
        ? {}
        : {
            where: {
              status: 'PUBLISHED',
              versions: { some: { kind: 'PUBLISHED' } },
            },
          }),
      include: admin
        ? articleInclude
        : {
            ...articleInclude,
            versions: {
              ...articleInclude.versions,
              where: { kind: 'PUBLISHED' },
            },
          },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    });
    return items
      .filter((article) => article.versions.length)
      .map((article) => present(article, admin));
  }

  create(actor: Principal, dto: ArticleDto) {
    return this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      await this.verifyMedia(tx, dto);
      const profile = await tx.profile.findUniqueOrThrow({ where: { userId: actor.userId }, select: { publicNameFormat: true } });
      const versionData = await this.versionData(tx, dto, dto.authorNameFormat ?? profile.publicNameFormat);
      const article = await tx.article.create({
        data: {
          slug: contentSlug(dto.titre),
          userId: actor.userId,
          versions: { create: {
            kind: 'WORKING', ...versionData,
            ...(dto.trail ? { trail: { create: await this.trails.data(tx, dto.trail) } } : {}),
          } },
        },
        include: articleInclude,
      });
      await contentLog(
        tx,
        actor.userId,
        'ARTICLE',
        article.id,
        'CREATE',
        'Brouillon créé.',
      );
      return present(article, true);
    });
  }

  update(actor: Principal, id: string, dto: ArticleDto) {
    return this.change(actor, id, async (tx, article) => {
      if (article.status === 'TRASHED') throw new ConflictException();
      await this.verifyMedia(tx, dto);
      const working = article.versions.find(
        (version) => version.kind === 'WORKING',
      );
      const previous = working ?? article.versions.find(version => version.kind === 'PUBLISHED');
      const versionData = await this.versionData(tx, dto, dto.authorNameFormat ?? previous?.authorNameFormat ?? 'FULL');
      if (working) {
        await tx.articleBlock.deleteMany({ where: { versionId: working.id } });
        await tx.articleCategory.deleteMany({
          where: { versionId: working.id },
        });
        await tx.articleTag.deleteMany({ where: { versionId: working.id } });
        await tx.articleVersion.update({
          where: { id: working.id },
          data: versionData,
        });
        if (dto.trail !== undefined) await this.saveTrail(tx, working.id, dto.trail);
      } else {
        const version = await tx.articleVersion.create({
          data: { articleId: id, kind: 'WORKING', ...versionData },
        });
        if (dto.trail !== undefined) await this.saveTrail(tx, version.id, dto.trail);
        else await this.copyTrail(tx, article, version.id);
      }
      // Un article déjà programmé doit rester publiable après chaque modification.
      if (article.status === 'SCHEDULED')
        this.validateVersion(
          (await this.find(tx, id)).versions.find((v) => v.kind === 'WORKING'),
        );
      await contentLog(
        tx,
        actor.userId,
        'ARTICLE',
        id,
        'UPDATE',
        'Version de travail enregistrée.',
      );
    });
  }

  updateCarousel(actor: Principal, articleIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      // Sérialiser les remplacements de sélection, y compris lorsque la liste est vide.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(8476103)`;
      const selected = articleIds.length
        ? Prisma.sql`OR id IN (${Prisma.join(articleIds.map((id) => Prisma.sql`${id}::uuid`))})`
        : Prisma.empty;
      await tx.$queryRaw`
        SELECT id FROM articles
        WHERE carousel_position IS NOT NULL ${selected}
        ORDER BY id FOR UPDATE
      `;
      const eligible = await tx.article.count({
        where: { id: { in: articleIds }, status: 'PUBLISHED' },
      });
      if (eligible !== articleIds.length) throw new ConflictException();

      const previous = await tx.article.findMany({
        where: { carouselPosition: { not: null } },
        orderBy: { carouselPosition: 'asc' },
        select: { id: true, carouselPosition: true },
      });
      const positions = new Map(articleIds.map((id, index) => [id, index + 1]));
      const changed = new Set(
        previous
          .filter((entry) => positions.get(entry.id) !== entry.carouselPosition)
          .map((entry) => entry.id),
      );
      for (const id of articleIds) {
        if (!previous.some((entry) => entry.id === id)) changed.add(id);
      }
      if (!changed.size) return;

      // Libérer les places avant de les permuter sous la contrainte d’unicité.
      await tx.article.updateMany({
        where: { id: { in: [...changed] }, carouselPosition: { not: null } },
        data: { carouselPosition: null },
      });
      for (const id of changed) {
        const carouselPosition = positions.get(id);
        if (carouselPosition !== undefined) {
          await tx.article.update({
            where: { id },
            data: { carouselPosition },
          });
        }
        await contentLog(
          tx,
          actor.userId,
          'ARTICLE',
          id,
          'UPDATE',
          'Sélection du carrousel modifiée.',
        );
      }
    });
  }

  action(actor: Principal, id: string, dto: ArticleActionDto) {
    return this.change(actor, id, async (tx, article) => {
      const working = article.versions.find(
        (version) => version.kind === 'WORKING',
      );
      const published = article.versions.find(
        (version) => version.kind === 'PUBLISHED',
      );
      const update = (status: ArticleStatus) =>
        tx.article.update({
          where: { id },
          data: { status, scheduledAt: null, carouselPosition: null },
        });
      const log = (
        action: Prisma.ActivityLogUncheckedCreateInput['action'],
        description: string,
      ) => contentLog(tx, actor.userId, 'ARTICLE', id, action, description);
      switch (dto.action) {
        case 'publish':
          if (
            article.status === 'TRASHED' ||
            (article.status === 'PUBLISHED' && !working)
          )
            throw new ConflictException();
          await this.promote(tx, article, actor.userId);
          break;
        case 'schedule': {
          if (!['DRAFT', 'SCHEDULED'].includes(article.status))
            throw new ConflictException();
          const at = new Date(dto.at!);
          if (
            !Number.isFinite(at.getTime()) ||
            at <= new Date() ||
            !/(?:Z|[+-]\d\d:\d\d)$/i.test(dto.at!)
          ) {
            throw new ContentInputError('Choisissez une date et une heure de publication futures.');
          }
          this.validateVersion(working ?? published);
          await tx.article.update({
            where: { id },
            data: { status: 'SCHEDULED', scheduledAt: at },
          });
          await log('SCHEDULE', 'Publication programmée.');
          break;
        }
        case 'cancel-schedule':
          if (article.status !== 'SCHEDULED') throw new ConflictException();
          await update('DRAFT');
          await log('CANCEL_SCHEDULE', 'Programmation annulée.');
          break;
        case 'unpublish':
          if (article.status !== 'PUBLISHED') throw new ConflictException();
          await tx.article.update({
            where: { id },
            data: {
              status: 'DRAFT',
              publishedAt: null,
              carouselPosition: null,
            },
          });
          await log('UNPUBLISH', 'Article retiré de la publication.');
          break;
        case 'discard-work':
          if (
            article.status !== 'PUBLISHED' ||
            !working ||
            !published ||
            !dto.confirmed
          )
            throw new ConflictException();
          await tx.articleVersion.delete({ where: { id: working.id } });
          await log('UPDATE', 'Version de travail abandonnée.');
          break;
        case 'trash':
          if (
            article.status === 'TRASHED' ||
            (article.status === 'SCHEDULED' && !dto.confirmed)
          )
            throw new ConflictException();
          await update('TRASHED');
          await log('TRASH', 'Article placé dans la corbeille.');
          break;
        case 'restore-draft':
        case 'restore-published':
          if (article.status !== 'TRASHED') throw new ConflictException();
          if (dto.action === 'restore-draft') await update('DRAFT');
          else if (!published)
            await this.promote(tx, article, actor.userId, new Date());
          else
            await tx.article.update({
              where: { id },
              data: {
                status: 'PUBLISHED',
                scheduledAt: null,
                publishedAt: new Date(),
              },
            });
          await log('RESTORE', 'Article restauré.');
          break;
        case 'delete':
          if (article.status !== 'TRASHED' || !dto.confirmed)
            throw new ConflictException();
          await tx.article.delete({ where: { id } });
          await log('DELETE', 'Article supprimé définitivement.');
          return true;
      }
    });
  }

  private async change(
    actor: Principal,
    id: string,
    change: (
      tx: Prisma.TransactionClient,
      article: StoredArticle,
    ) => Promise<true | void>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await lockAdmin(tx, this.sessions, actor);
      await tx.$queryRaw`SELECT id FROM articles WHERE id = ${id}::uuid FOR UPDATE`;
      if (await change(tx, await this.find(tx, id))) return { deleted: true };
      return present(await this.find(tx, id), true);
    });
  }

  private async find(tx: Prisma.TransactionClient, id: string) {
    const article = await tx.article.findUnique({
      where: { id },
      include: articleInclude,
    });
    if (!article) throw new NotFoundException();
    return article;
  }

  private async versionData(tx: Prisma.TransactionClient, dto: ArticleDto, authorNameFormat: PublicNameFormat) {
    const previews = new Map<string, Awaited<ReturnType<TrailsService['blockPreview']>>>();
    const ids = new Set(dto.blocks.flatMap(block => block.type === 'randonnee' && block.mediaId ? [block.mediaId] : []));
    for (const id of [...ids].sort()) previews.set(id, await this.trails.blockPreview(tx, id));
    const blocks = dto.blocks.map((block, position) => {
      if (block.type === 'localisation' || block.type === 'randonnee')
        return mapBlockInput(block, position, previews.get(block.mediaId ?? '') ?? null);
      return blockInput(block, position);
    });
    return {
      title: dto.titre.trim(),
      authorNameFormat,
      coverMediaId: dto.coverMediaId,
      blocks: { create: blocks },
      categories: {
        create: dto.categorieIds.map((categoryId) => ({ categoryId })),
      },
      tags: { create: dto.tagIds.map((tagId) => ({ tagId })) },
    };
  }

  private async verifyMedia(tx: Prisma.TransactionClient, dto: ArticleDto) {
    const ids = [
      ...new Set(
        [dto.coverMediaId, ...dto.blocks.filter(block => block.type !== 'randonnee').map(block => block.mediaId)].filter(
          (id): id is string => Boolean(id),
        ),
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
      throw new ContentInputError('Une image sélectionnée est indisponible. Remplacez-la ou retirez-la.');
    }
  }

  private validateVersion(version?: Version) {
    if (!version) throw new ContentInputError('Enregistrez une version de l’article avant de le publier.');
    if (!version.title.trim()) throw new ContentInputError('Renseignez le titre de l’article.');
    for (const block of version.blocks) {
      const mapBlock = storedMapBlock(block.type, block.data);
      if (mapBlock?.kind === 'randonnee' && (!mapBlock.trail.name || !mapBlock.trail.gpxMediaId || !mapBlock.trail.mapPreview))
        throw new ContentInputError(`Bloc ${block.position + 1} : renseignez le nom du parcours et choisissez son GPX.`);
      if (mapBlock?.kind === 'localisation' && (mapBlock.location.latitude == null || mapBlock.location.longitude == null))
        throw new ContentInputError(`Bloc ${block.position + 1} : placez le marqueur en recherchant l’adresse ou en saisissant les coordonnées.`);
      const data = block.data as { url?: string };
      if (block.type === 'YOUTUBE' && !data.url?.trim())
        throw new ContentInputError(`Bloc ${block.position + 1} : renseignez l’adresse de la vidéo YouTube.`);
      if (block.type === 'LINK' && !data.url?.trim())
        throw new ContentInputError(`Bloc ${block.position + 1} : renseignez l’adresse du lien.`);
    }
  }

  private async promote(
    tx: Prisma.TransactionClient,
    article: StoredArticle,
    actor: string | null,
    date = article.publishedAt ?? new Date(),
  ) {
    const working = article.versions.find(
      (version) => version.kind === 'WORKING',
    );
    const previous = article.versions.find(
      (version) => version.kind === 'PUBLISHED',
    );
    this.validateVersion(working ?? previous);
    if (working) {
      if (previous)
        await tx.articleVersion.delete({ where: { id: previous.id } });
      await tx.articleVersion.update({
        where: { id: working.id },
        data: { kind: 'PUBLISHED' },
      });
    }
    await tx.article.update({
      where: { id: article.id },
      data: { status: 'PUBLISHED', scheduledAt: null, publishedAt: date },
    });
    await contentLog(
      tx,
      actor,
      'ARTICLE',
      article.id,
      'PUBLISH',
      actor ? 'Article publié.' : 'Publication programmée exécutée.',
    );
  }

  private async saveTrail(tx: Prisma.TransactionClient, versionId: string, trail: TrailDto | null) {
    if (trail === null) {
      await tx.trail.deleteMany({ where: { versionId } });
    } else {
      const data = await this.trails.data(tx, trail);
      await tx.trail.upsert({ where: { versionId }, create: { versionId, ...data }, update: data });
    }
  }

  private async copyTrail(
    tx: Prisma.TransactionClient,
    article: StoredArticle,
    versionId: string,
  ) {
    const trail = article.versions.find(
      (version) => version.kind === 'PUBLISHED',
    )?.trail;
    if (!trail) return;
    const {
      name,
      description,
      distance,
      elevationGain,
      elevationLoss,
      duration,
      difficulty,
      gpxMediaId,
      mapPreview,
    } = trail;
    await tx.trail.create({
      data: {
        versionId,
        name,
        description,
        distance,
        elevationGain,
        elevationLoss,
        duration,
        difficulty,
        gpxMediaId,
        mapPreview: mapPreview as Prisma.InputJsonValue,
      },
    });
  }

  private async publishDue() {
    const due = await this.prisma.article.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
      select: { id: true },
      take: 25,
      orderBy: { scheduledAt: 'asc' },
    });
    for (const { id } of due) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const locked = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM articles WHERE id = ${id}::uuid AND status = 'SCHEDULED'
            AND scheduled_at <= statement_timestamp() FOR UPDATE SKIP LOCKED
          `;
          if (locked.length)
            await this.promote(tx, await this.find(tx, id), null, new Date());
        });
      } catch {
        this.logger.warn('Une publication programmée n’a pas abouti.');
      }
    }
  }
}
