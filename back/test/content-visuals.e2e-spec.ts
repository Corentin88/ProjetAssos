import { randomBytes } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { SessionService } from '../src/auth/session.service.js';
import { RuntimeConfig } from '../src/config/runtime.module.js';
import { configureHttp } from '../src/http.js';
import { PrismaService } from '../src/prisma/prisma.module.js';

const adminUrl = '/api/v1/admin/content';
const mediaOne = '00000000-0000-4000-a000-000000000001';
const mediaTwo = '00000000-0000-4000-a000-000000000002';
const categoryId = '00000000-0000-4000-a000-000000000003';
const articleId = '00000000-0000-4000-a000-000000000004';
const actor = { userId: mediaOne, sessionId: mediaTwo, role: 'ADMIN' };
type Slide = {
  mediaId: string;
  position: number;
  alt: string;
  caption: string | null;
};
type StoredBlockInput = {
  type: string;
  position: number;
  data?: object;
  mediaId?: string;
  slides?: { create: Slide[] };
};

function storage() {
  const category = {
    id: categoryId,
    slug: 'cat',
    name: 'Catégorie',
    icon: null as string | null,
    visualMediaId: null as string | null,
    articles: [],
    _count: { media: 0 },
  };
  const version = {
    id: mediaOne,
    kind: 'WORKING',
    coverMediaId: mediaOne,
    title: 'Fête',
    authorNameFormat: 'INITIAL',
    updatedAt: new Date(),
    categories: [{ categoryId }],
    tags: [],
    trail: null,
    blocks: [] as (Omit<StoredBlockInput, 'slides'> & {
      id: string;
      slides: Slide[];
    })[],
  };
  const article = {
    id: articleId,
    status: 'DRAFT',
    userId: actor.userId,
    slug: 'fete',
    carouselPosition: null,
    createdAt: new Date(),
    publishedAt: null as Date | null,
    versions: [version],
  };
  const storeBlocks = (blocks: StoredBlockInput[]) => {
    version.blocks = blocks.map((block, index) => ({
      ...block,
      id: `bloc-${index}`,
      data: block.data ?? {},
      slides: block.slides?.create ?? [],
    }));
  };
  const tx = {
    $queryRaw: vi.fn(),
    category: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(({ data }) => Object.assign(category, data)),
      update: vi.fn(({ data }) => Object.assign(category, data)),
      findMany: vi.fn(() => [category]),
    },
    tag: { findMany: vi.fn().mockResolvedValue([]) },
    media: {
      count: vi.fn(
        ({ where }) =>
          where.id.in.filter((id: string) => [mediaOne, mediaTwo].includes(id))
            .length,
      ),
      findFirst: vi.fn(({ where }) =>
        [mediaOne, mediaTwo].includes(where.id)
          ? { id: where.id, type: 'IMAGE' }
          : null,
      ),
      findMany: vi.fn().mockResolvedValue([]),
      findUniqueOrThrow: vi.fn(({ where }) => ({
        _count: {
          articleBlockImages: version.blocks
            .flatMap((block) => block.slides)
            .filter((image) => image.mediaId === where.id).length,
          categoryVisuals: Number(category.visualMediaId === where.id),
        },
      })),
      delete: vi.fn(),
      update: vi.fn(),
    },
    mediaFolder: { create: vi.fn(({ data }) => ({ id: categoryId, ...data })) },
    profile: {
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ publicNameFormat: 'INITIAL' }),
    },
    article: {
      create: vi.fn(({ data }) => {
        storeBlocks(data.versions.create.blocks.create);
        return article;
      }),
      findUnique: vi.fn(() => article),
      findMany: vi.fn(({ where }) =>
        where && article.status !== 'PUBLISHED' ? [] : [article],
      ),
      update: vi.fn(({ data }) => Object.assign(article, data)),
    },
    articleVersion: {
      update: vi.fn(({ data }) => {
        if (data.blocks) storeBlocks(data.blocks.create);
        if (data.kind) version.kind = data.kind;
        return version;
      }),
    },
    articleBlock: { deleteMany: vi.fn() },
    articleCategory: { deleteMany: vi.fn() },
    articleTag: { deleteMany: vi.fn() },
    activityLog: { create: vi.fn() },
  };
  return {
    tx,
    prisma: {
      ...tx,
      $transaction: (run: (db: typeof tx) => unknown) => run(tx),
    },
  };
}

describe('Visuels de catégories et blocs article (e2e)', () => {
  let app: INestApplication<App>;
  let db: ReturnType<typeof storage>;
  const api = () => request(app.getHttpServer());
  const authorization = 'Bearer test-admin';

  beforeEach(async () => {
    db = storage();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RuntimeConfig)
      .useValue({
        databaseUrl: new URL('postgresql://127.0.0.1/projetassos'),
        jwtSecret: randomBytes(32).toString('base64url'),
        apiOrigin: 'http://localhost:3000',
        frontOrigin: 'http://localhost:5173',
      })
      .overrideProvider(PrismaService)
      .useValue(db.prisma)
      .overrideProvider(SessionService)
      .useValue({
        authenticate: (header?: string) => {
          if (header !== authorization) throw new UnauthorizedException();
          return actor;
        },
        assertLive: () => actor,
      })
      .compile();
    app = module.createNestApplication();
    configureHttp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepte les icônes de randonnée et de jeux de cartes et crée un dossier enfant', async () => {
    for (const icon of ['footprints', 'spade']) {
      const response = await api()
        .post(`${adminUrl}/classification/categories`)
        .set('Authorization', authorization)
        .send({ nom: 'Activité', visual: { icon } })
        .expect(201);
      expect(response.body.visual).toEqual({ icon });
    }
    db.tx.$queryRaw.mockResolvedValue([{ id: mediaOne }]);
    const folder = await api()
      .post(`${adminUrl}/media-folders`)
      .set('Authorization', authorization)
      .send({ nom: ' Photos ', parentId: mediaOne })
      .expect(201);
    expect(folder.body).toMatchObject({
      id: categoryId,
      name: 'Photos',
      parentId: mediaOne,
    });
  });

  it('conserve une alternative décorative vide et exige une description pour les autres images', async () => {
    const draft = (decorative?: boolean, alt = '') => ({
      titre: 'Images',
      coverMediaId: null,
      categorieIds: [],
      tagIds: [],
      blocks: [
        { type: 'image', mediaId: mediaOne, alt, decorative },
        {
          type: 'carrousel',
          slides: [{ mediaId: mediaTwo, alt: '', decorative: true }],
        },
      ],
    });
    const create = (data: object) =>
      api()
        .post(`${adminUrl}/articles`)
        .set('Authorization', authorization)
        .send(data);
    await create(draft()).expect(400);
    await create(draft(true, 'x'.repeat(1001))).expect(400);
    const result = await create(draft(true)).expect(201);
    expect(result.body.blocks).toMatchObject([
      { type: 'image', alt: '', decorative: true },
      { type: 'carrousel', slides: [{ alt: '', decorative: true }] },
    ]);
    const metadata = () =>
      api()
        .patch(`${adminUrl}/media/${mediaOne}`)
        .set('Authorization', authorization);
    await metadata().send({ nom: 'Image', alt: '' }).expect(400);
    await metadata()
      .send({ nom: 'Image', alt: '', decorative: true })
      .expect(204);
    expect(db.tx.media.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Image', altText: '' } }),
    );

    // Un fichier invalide s’arrête à la validation de son format, avant toute écriture.
    const upload = (decorative: string) =>
      api()
        .post(`${adminUrl}/media`)
        .set('Authorization', authorization)
        .field('nom', 'Image')
        .field('alt', '')
        .field('decorative', decorative)
        .attach('image', Buffer.from('format invalide'), {
          filename: 'image.png',
          contentType: 'image/png',
        });
    await upload('oui').expect(400);
    await upload('true').expect(415);
  });

  it('crée, remplace et retire un visuel unique avec protection du média', async () => {
    const route = `${adminUrl}/classification/categories`;
    const change = (visual: unknown) =>
      api()
        .patch(`${route}/${categoryId}`)
        .set('Authorization', authorization)
        .send({ nom: 'Catégorie', visual });
    const created = await api()
      .post(route)
      .set('Authorization', authorization)
      .send({ nom: 'Catégorie' })
      .expect(201);
    expect(created.body.visual).toBeNull();
    await change({ icon: 'leaf', mediaId: mediaOne }).expect(400);
    await change({ icon: 'inconnue' }).expect(400);
    expect((await change({ icon: 'leaf' }).expect(200)).body.visual).toEqual({
      icon: 'leaf',
    });
    expect(
      (await change({ mediaId: mediaTwo }).expect(200)).body.visual,
    ).toEqual({ mediaId: mediaTwo });
    expect(db.tx.category.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { name: 'Catégorie', icon: null, visualMediaId: mediaTwo },
      }),
    );
    await api()
      .delete(`${adminUrl}/media/${mediaTwo}`)
      .set('Authorization', authorization)
      .expect(409);
    expect(db.tx.media.delete).not.toHaveBeenCalled();
    expect((await change(null).expect(200)).body.visual).toBeNull();
    await api().get(adminUrl).expect(401);
  });

  it('conserve les références, les légendes et l’ordre du brouillon à la publication', async () => {
    const route = `${adminUrl}/articles`;
    const slides = [
      { mediaId: mediaOne, alt: 'Place', caption: 'La place' },
      { mediaId: mediaTwo, alt: 'Forêt' },
    ];
    const article = (images: unknown[]) => ({
      titre: 'Fête',
      coverMediaId: mediaOne,
      categorieIds: [categoryId],
      tagIds: [],
      blocks: [
        { type: 'image', alt: 'Vue historique', mediaId: mediaOne },
        { type: 'carrousel', slides: images },
      ],
    });
    await api()
      .post(`${adminUrl}/classification/categories`)
      .set('Authorization', authorization)
      .send({ nom: 'Catégorie', visual: { mediaId: mediaTwo } })
      .expect(201);
    const invalid = await api()
      .post(route)
      .set('Authorization', authorization)
      .send(article([slides[0], { ...slides[1], alt: ' ' }]))
      .expect(400);
    expect(invalid.body.message).toContain('image 2');
    await api()
      .post(route)
      .set('Authorization', authorization)
      .send(article([slides[0]]))
      .expect(201);
    await api()
      .post(`${route}/${articleId}/actions`)
      .set('Authorization', authorization)
      .send({ action: 'publish' })
      .expect(400);
    const schedule = () =>
      api()
        .post(`${route}/${articleId}/actions`)
        .set('Authorization', authorization)
        .send({
          action: 'schedule',
          at: new Date(Date.now() + 3_600_000).toISOString(),
        });
    await schedule().expect(400);
    await api()
      .patch(`${route}/${articleId}`)
      .set('Authorization', authorization)
      .send(article(slides.toReversed()))
      .expect(200);
    const draft = await api()
      .get(adminUrl)
      .set('Authorization', authorization)
      .expect(200);
    expect(draft.body.articles[0]).toMatchObject({
      coverMediaId: mediaOne,
      statut: 'brouillon',
      blocks: [
        { type: 'image', alt: 'Vue historique' },
        { type: 'carrousel', slides: slides.toReversed() },
      ],
    });
    expect((await schedule().expect(200)).body.statut).toBe('programme');
    await api()
      .post(`${route}/${articleId}/actions`)
      .set('Authorization', authorization)
      .send({ action: 'cancel-schedule' })
      .expect(200);
    const hidden = await api().get('/api/v1/content').expect(200);
    expect(hidden.body.articles).toEqual([]);
    expect(hidden.body.categories[0].visual).toBeNull();
    await api()
      .delete(`${adminUrl}/media/${mediaOne}`)
      .set('Authorization', authorization)
      .expect(409);
    expect(db.tx.media.delete).not.toHaveBeenCalled();
    await api()
      .post(`${route}/${articleId}/actions`)
      .set('Authorization', authorization)
      .send({ action: 'publish' })
      .expect(200);
    const publicContent = await api().get('/api/v1/content').expect(200);
    expect(publicContent.body.articles[0].blocks[1].slides).toEqual(
      slides.toReversed(),
    );
    expect(publicContent.body.categories[0].visual).toEqual({
      mediaId: mediaTwo,
    });
    expect(db.tx.media.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              articleBlockImages: {
                some: {
                  block: {
                    version: {
                      kind: 'PUBLISHED',
                      article: { status: 'PUBLISHED' },
                    },
                  },
                },
              },
            },
          ]),
        }),
      }),
    );
  });
});
