import { randomBytes } from 'node:crypto';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
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

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  mkdir: vi.fn(),
  open: vi.fn(),
  writeFile: vi.fn(),
}));

function uuid(value: number) {
  return `00000000-0000-4000-a000-${String(value).padStart(12, '0')}`;
}

const adminUrl = '/api/v1/admin/content';
const mediaId = uuid(1);
const folderId = uuid(2);
const publishedArticle = uuid(3);
const otherArticle = uuid(4);
const draftArticle = uuid(5);
const actor = { userId: uuid(6), sessionId: uuid(7), role: 'ADMIN' };
const token = 'Bearer test-admin';
const header = '%PDF-1.7\n';
const document = Buffer.from(
  `${header}xref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 >>\nstartxref\n${header.length}\n%%EOF\n`,
);

function fixtures() {
  const media = {
    id: mediaId,
    name: 'Programme',
    originalName: 'programme.pdf',
    path: `content/${mediaId}.pdf`,
    type: 'PDF',
    format: 'PDF',
    sizeBytes: BigInt(document.length),
    createdAt: new Date(),
    folderId: null,
  };
  const blocks = [
    {
      id: uuid(11),
      articleId: publishedArticle,
      kind: 'PUBLISHED',
      status: 'PUBLISHED',
      display: true,
      download: false,
    },
    {
      id: uuid(12),
      articleId: otherArticle,
      kind: 'PUBLISHED',
      status: 'PUBLISHED',
      display: false,
      download: true,
    },
    {
      id: uuid(13),
      articleId: draftArticle,
      kind: 'WORKING',
      status: 'DRAFT',
      display: true,
      download: true,
    },
    {
      id: uuid(14),
      articleId: publishedArticle,
      kind: 'WORKING',
      status: 'PUBLISHED',
      display: true,
      download: true,
    },
  ];
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: folderId }]),
    media: {
      create: vi.fn(({ data }) => ({ ...media, ...data })),
      count: vi.fn(({ where }) =>
        where.id
          ? where.type === 'PDF' && where.id.in.includes(mediaId)
            ? 1
            : 0
          : 1,
      ),
      findMany: vi.fn().mockResolvedValue([media]),
      findFirst: vi.fn(({ where }) => (where.id === mediaId ? media : null)),
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ _count: { articleBlocks: 1 } }),
      delete: vi.fn(),
    },
    articleBlock: {
      findFirst: vi.fn(({ where }) => {
        const item = blocks.find(
          (block) =>
            block.id === where.id &&
            block.articleId === where.version.articleId &&
            (!where.version.kind || block.kind === where.version.kind) &&
            (!where.version.article ||
              block.status === where.version.article.status),
        );
        return (
          item && {
            media,
            data: { pdf: { display: item.display, download: item.download } },
          }
        );
      }),
    },
    profile: {
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ publicNameFormat: 'INITIAL' }),
    },
    article: {
      create: vi.fn(({ data }) => ({
        id: draftArticle,
        status: 'DRAFT',
        versions: [
          {
            ...data.versions.create,
            categories: [],
            tags: [],
            blocks: data.versions.create.blocks.create.map((block: object) => ({
              ...block,
              id: uuid(13),
            })),
          },
        ],
      })),
    },
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

describe('Médiathèque PDF et droits du bloc (e2e)', () => {
  let app: INestApplication<App>;
  let db: ReturnType<typeof fixtures>;
  const api = () => request(app.getHttpServer());
  const pdf = (article: string, block: number, mode: string) =>
    `/articles/${article}/blocks/${uuid(block)}/pdf/${mode}`;

  beforeEach(async () => {
    vi.clearAllMocks();
    db = fixtures();
    vi.mocked(open).mockResolvedValue({
      stat: async () => ({ size: document.length, isFile: () => true }),
      createReadStream: () => Readable.from([document]),
      close: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof open>>);
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
          if (!header) throw new UnauthorizedException();
          return { ...actor, role: header === token ? 'ADMIN' : 'USER' };
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

  it('importe un document autorisé dans le dossier choisi et permet de retrouver son nom original', async () => {
    const route = `${adminUrl}/media/pdf?folderId=${folderId}`;
    const upload = (authorization: string, buffer = document) =>
      api()
        .post(route)
        .set('Authorization', authorization)
        .field('nom', 'Programme')
        .attach('file', buffer, {
          filename: 'programme.pdf',
          contentType: 'application/pdf',
        });
    await upload('Bearer membre').expect(403);
    await upload(token, Buffer.from('Faux PDF')).expect(415);
    expect(writeFile).not.toHaveBeenCalled();
    const result = await upload(token).expect(201);
    expect(result.body).toMatchObject({
      id: mediaId,
      nom: 'Programme',
      originalName: 'programme.pdf',
      folderId,
      type: 'PDF',
    });
    expect(result.body).not.toHaveProperty('path');
    expect(mkdir).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/content-images[/\\][a-f0-9-]{36}\.pdf$/),
      document,
      expect.objectContaining({ flag: 'wx' }),
    );
    await api()
      .get(`${adminUrl}/media?type=PDF&q=programme.pdf`)
      .set('Authorization', token)
      .expect(200);
    expect(db.tx.media.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            { OR: [{ type: 'PDF', path: { startsWith: 'content/' } }] },
            {
              OR: expect.arrayContaining([
                {
                  originalName: {
                    contains: 'programme.pdf',
                    mode: 'insensitive',
                  },
                },
              ]),
            },
          ]),
        },
      }),
    );
    await api()
      .delete(`${adminUrl}/media/${mediaId}`)
      .set('Authorization', token)
      .expect(409);
    expect(db.tx.media.delete).not.toHaveBeenCalled();
  });

  it('applique la version et l’action du bloc, même lorsque les fichiers sont identiques', async () => {
    const get = (article: string, block: number, mode: string) =>
      api().get('/api/v1' + pdf(article, block, mode));
    await get(publishedArticle, 11, 'view')
      .expect(200)
      .expect('Content-Type', 'application/pdf')
      .expect('Content-Disposition', /^inline;/)
      .expect('X-Content-Type-Options', 'nosniff')
      .expect('X-Frame-Options', 'DENY');
    await get(publishedArticle, 11, 'download').expect(404);
    await get(otherArticle, 12, 'download')
      .expect(200)
      .expect('Content-Disposition', /^attachment;/);
    await get(otherArticle, 12, 'view').expect(404);
    await get(otherArticle, 11, 'view').expect(404);
    await get(draftArticle, 13, 'view').expect(404);
    await get(publishedArticle, 14, 'download').expect(404);
    await api()
      .get(`${adminUrl}${pdf(draftArticle, 13, 'view')}`)
      .expect(401);
    await api()
      .get(`${adminUrl}${pdf(draftArticle, 13, 'view')}`)
      .set('Authorization', 'Bearer membre')
      .expect(403);
    await api()
      .get(`${adminUrl}${pdf(draftArticle, 13, 'view')}`)
      .set('Authorization', token)
      .expect(200);
    await api().get(`/api/v1/media/${mediaId}`).expect(404);
    await api().get(`${adminUrl}/media/${mediaId}/pdf`).expect(401);
    await api()
      .get(`${adminUrl}/media/${mediaId}/pdf`)
      .set('Authorization', token)
      .expect(200);
  });

  it('enregistre un bloc PDF et ses réglages dans la version de travail', async () => {
    const create = (
      flags: { display: boolean; download: boolean },
      reference = mediaId,
    ) =>
      api()
        .post(`${adminUrl}/articles`)
        .set('Authorization', token)
        .send({
          titre: 'Activités',
          coverMediaId: null,
          categorieIds: [],
          tagIds: [],
          blocks: [
            {
              type: 'pdf',
              mediaId: reference,
              text: ' Programme ',
              pdf: { ...flags, description: ' Saison ' },
            },
          ],
        });
    await create({ display: false, download: false }).expect(400);
    await create({ display: true, download: false }, uuid(99)).expect(400);
    const result = await create({ display: true, download: false }).expect(201);
    expect(result.body.blocks[0]).toMatchObject({
      type: 'pdf',
      mediaId,
      text: 'Programme',
      pdf: { display: true, download: false, description: 'Saison' },
    });
  });
});
