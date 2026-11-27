import { randomBytes, randomUUID } from 'node:crypto';
import { open, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { SessionService } from '../src/auth/session.service.js';
import { RuntimeConfig } from '../src/config/runtime.module.js';
import { renderPdfPage } from '../src/content/pdf-render.js';
import { configureHttp } from '../src/http.js';
import { PrismaService } from '../src/prisma/prisma.module.js';

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  open: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
}));

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=', 'base64');
vi.mock('../src/content/pdf-render.js', () => ({
  pdfPageCount: vi.fn().mockResolvedValue(2),
  renderPdfPage: vi.fn().mockImplementation(async () => png),
}));

const databaseUrl = process.env.PROJETASSOS_PDF_TEST_DATABASE_URL;
const document = Buffer.from('%PDF-1.7\n');
const admin = '/api/v1/admin/content';

describe.skipIf(!databaseUrl)('Bloc PDF sur PostgreSQL réel (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userId: string;
  let mediaId: string;
  let token: string;

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const database = new URL(databaseUrl!);
    if (
      database.pathname !== '/projetassos_pdf_diagnostic' ||
      database.hostname !== '127.0.0.1'
    )
      throw new Error(
        'Ce test exige la base PostgreSQL locale et jetable projetassos_pdf_diagnostic.',
      );
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RuntimeConfig)
      .useValue({
        databaseUrl: database,
        jwtSecret: randomBytes(32).toString('base64url'),
        apiOrigin: 'http://localhost:3000',
        frontOrigin: 'http://localhost:5173',
      })
      .compile();
    app = module.createNestApplication();
    configureHttp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const user = await prisma.user.create({
      data: {
        email: `${randomUUID()}@example.test`,
        googleId: randomUUID(),
        role: 'ADMIN',
        profile: { create: { firstName: 'Admin', lastName: 'Diagnostic' } },
      },
    });
    userId = user.id;
    const media = await prisma.media.create({
      data: {
        name: 'Programme',
        originalName: 'programme.pdf',
        type: 'PDF',
        format: 'PDF',
        path: `content/${randomUUID()}.pdf`,
        sizeBytes: document.length,
      },
    });
    mediaId = media.id;
    const sessions = app.get(SessionService);
    const created = await prisma.$transaction((tx) =>
      sessions.create(tx, userId),
    );
    token = (await sessions.access(userId, created.session.id)).accessToken;
    vi.mocked(open).mockResolvedValue({
      stat: async () => ({ size: document.length, isFile: () => true }),
      createReadStream: () => Readable.from([document]),
      close: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof open>>);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('enregistre le bloc PDF et contrôle les accès de sa version', async () => {
    const payload = {
      titre: 'Programme PDF',
      coverMediaId: null,
      categorieIds: [],
      tagIds: [],
      blocks: [
        {
          type: 'pdf',
          mediaId,
          text: 'Programme PDF',
          pdf: { display: true, download: false },
        },
      ],
    };
    const response = await api()
      .post(`${admin}/articles`)
      .auth(token, { type: 'bearer' })
      .send(payload)
      .expect(201);
    const {
      id,
      blocks: [block],
    } = response.body;
    const draftUrl = `/articles/${id}/blocks/${block.id}/pdf`;
    await api().get(`/api/v1${draftUrl}/view`).expect(404);
    await api()
      .get(`${admin}${draftUrl}/view`)
      .auth(token, { type: 'bearer' })
      .expect(200)
      .expect('Content-Type', 'application/pdf');
    await api()
      .get(`${admin}${draftUrl}/download`)
      .auth(token, { type: 'bearer' })
      .expect(404);
    const publicArticle = await api()
      .post(`${admin}/articles/${id}/actions`)
      .auth(token, { type: 'bearer' })
      .send({ action: 'publish' })
      .expect(200);
    expect(publicArticle.body.statut).toBe('publie');
    await api().get(`/api/v1${draftUrl}/view`).expect(200);
    await api().get(`/api/v1${draftUrl}/download`).expect(404);

    const updated = await api()
      .patch(`${admin}/articles/${id}`)
      .auth(token, { type: 'bearer' })
      .send({
        ...payload,
        blocks: [
          { ...payload.blocks[0], pdf: { display: true, download: true } },
        ],
      })
      .expect(200);
    const workingUrl = `/articles/${id}/blocks/${updated.body.blocks[0].id}/pdf`;
    await api().get(`/api/v1${workingUrl}/download`).expect(404);
    await api()
      .get(`${admin}${workingUrl}/download`)
      .auth(token, { type: 'bearer' })
      .expect(200)
      .expect('Content-Disposition', /^attachment;/);
    await api()
      .post(`${admin}/articles/${id}/actions`)
      .auth(token, { type: 'bearer' })
      .send({ action: 'publish' })
      .expect(200);
    await api()
      .get(`/api/v1${workingUrl}/download`)
      .expect(200)
      .expect('Content-Disposition', /^attachment;/);
    await api()
      .delete(`${admin}/media/${mediaId}`)
      .auth(token, { type: 'bearer' })
      .expect(409);
  });

  it('impose un média du bon type au niveau PostgreSQL', async () => {
    const article = await prisma.article.create({
      data: {
        slug: randomUUID(),
        userId,
        versions: { create: { kind: 'WORKING', title: 'Contraintes médias' } },
      },
      include: { versions: true },
    });
    const versionId = article.versions[0].id;
    const image = await prisma.media.create({
      data: {
        name: 'Image de test',
        type: 'IMAGE',
        format: 'PNG',
        path: `content/${randomUUID()}.png`,
        sizeBytes: 1,
      },
    });
    const insert = (
      type: 'IMAGE' | 'PDF' | 'CAROUSEL',
      media: string | null,
    ) => prisma.$executeRaw`
      INSERT INTO article_blocks (version_id, position, type, media_id)
      VALUES (${versionId}::uuid, 0, ${type}::block_type, ${media}::uuid)
    `;
    const failedCheck = {
      code: 'P2010',
      meta: { driverAdapterError: { cause: { originalCode: '23514' } } },
    };
    await expect(insert('IMAGE', mediaId)).rejects.toMatchObject(failedCheck);
    await expect(insert('PDF', image.id)).rejects.toMatchObject(failedCheck);
    await expect(insert('PDF', null)).rejects.toMatchObject(failedCheck);
    await expect(insert('CAROUSEL', image.id)).rejects.toMatchObject(
      failedCheck,
    );
    await expect(insert('IMAGE', image.id)).resolves.toBe(1);
    await expect(
      prisma.$executeRaw`UPDATE article_blocks SET type = 'PDF' WHERE version_id = ${versionId}::uuid`,
    ).rejects.toMatchObject(failedCheck);
  });

  it('conserve le PDF source des visuels et contrôle les accès de chaque bloc publié', async () => {
    const makeMedia = (type: 'IMAGE' | 'PDF', previewOfId?: string) => prisma.media.create({
      data: {
        name: 'Visuel de recette', type, format: type === 'PDF' ? 'PDF' : 'PNG',
        path: `content/${randomUUID()}.${type === 'PDF' ? 'pdf' : 'png'}`,
        sizeBytes: 1, previewOfId,
      },
    });
    const source = await makeMedia('PDF');
    const image = await makeMedia('IMAGE');
    await expect(makeMedia('IMAGE', image.id)).rejects.toBeDefined();
    const preview = await makeMedia('IMAGE', source.id);
    await expect(makeMedia('IMAGE', source.id)).rejects.toMatchObject({ code: 'P2002' });

    const payload = {
      titre: 'Illustrations de recette',
      coverMediaId: preview.id, categorieIds: [], tagIds: [],
      blocks: [
        { type: 'image', mediaId: preview.id, alt: 'Première page', text: 'Légende', viewPdf: true },
        { type: 'image', mediaId: preview.id, alt: 'Illustration seule' },
        { type: 'carrousel', slides: [
          { mediaId: image.id, alt: 'Image classique' },
          { mediaId: preview.id, alt: 'Aperçu PDF', downloadPdf: true },
        ] },
      ],
    };
    const draft = await api().post(`${admin}/articles`).auth(token, { type: 'bearer' }).send(payload).expect(201);
    const { id, blocks: [first, second, carousel] } = draft.body;
    const path = (blockId: string, action: string) => `/articles/${id}/blocks/${blockId}/pdf/${action}`;
    expect(draft.body.coverMediaId).toBe(preview.id);
    expect(first).toMatchObject({ mediaId: preview.id, viewPdf: true, text: 'Légende' });
    expect(carousel.slides[1]).toMatchObject({ mediaId: preview.id, downloadPdf: true });

    await api().get(`/api/v1${path(first.id, 'view')}`).expect(404);
    await api().get(`/api/v1${path(first.id, 'info')}`).expect(404);
    await api().get(`${admin}${path(first.id, 'view')}`).expect(401);
    await api().get(`${admin}${path(first.id, 'view')}`).auth(token, { type: 'bearer' }).expect(200);
    await api().delete(`${admin}/media/${source.id}`).auth(token, { type: 'bearer' }).expect(409);
    await api().post(`${admin}/articles/${id}/actions`).auth(token, { type: 'bearer' }).send({ action: 'publish' }).expect(200);

    await api().get(`/api/v1${path(first.id, 'view')}`).expect(200);
    await api().get(`/api/v1${path(first.id, 'info')}`).expect(200, { pages: 2 });
    const page = await api().get(`/api/v1${path(first.id, 'page?page=2')}`).expect(200).expect('Content-Type', 'image/png');
    expect(page.body).toEqual(png);
    expect(renderPdfPage).toHaveBeenCalledWith(expect.any(String), 2);
    await api().get(`/api/v1${path(first.id, 'download')}`).expect(404);
    await api().get(`/api/v1${path(second.id, 'view')}`).expect(404);
    await api().get(`/api/v1${path(second.id, 'page?page=1')}`).expect(404);
    await api().get(`/api/v1${path(carousel.id, 'download?slide=0')}`).expect(404);
    await api().get(`/api/v1${path(carousel.id, 'view?slide=1')}`).expect(404);
    await api().get(`/api/v1${path(carousel.id, 'download?slide=1')}`).expect(200);
    await api().get(`/api/v1/media/${source.id}`).expect(404);
    const published = await api().get('/api/v1/content').expect(200);
    const visual = published.body.medias.find(({ id }: { id: string }) => id === preview.id);
    expect(visual).toMatchObject({ fromPdf: true });
    expect(visual).not.toHaveProperty('sourcePdfId');
    await api().delete(`${admin}/media/${source.id}`).auth(token, { type: 'bearer' }).expect(409);
    expect(await prisma.media.findUnique({ where: { previewOfId: source.id } })).toMatchObject({ id: preview.id });

    const updated = await api().patch(`${admin}/articles/${id}`).auth(token, { type: 'bearer' })
      .send({ ...payload, coverMediaId: image.id, blocks: [] }).expect(200);
    expect(updated.body.coverMediaId).toBe(image.id);
    const removed = await api().patch(`${admin}/articles/${id}`).auth(token, { type: 'bearer' })
      .send({ ...payload, coverMediaId: null, blocks: [] }).expect(200);
    expect(removed.body.coverMediaId).toBeNull();
    await api().delete(`${admin}/media/${source.id}`).auth(token, { type: 'bearer' }).expect(409);
  });

  it('crée une seule image par PDF, la masque du sélecteur et la retire avec sa source inutilisée', async () => {
    const name = `Conversion ${randomUUID()}`;
    const source = await prisma.media.create({
      data: { name, type: 'PDF', format: 'PDF', path: `content/${randomUUID()}.pdf`, sizeBytes: 1 },
    });
    const path = `${admin}/media/${source.id}/pdf-visual`;
    const writes = vi.mocked(writeFile).mock.calls.length;
    await api().post(path).expect(401);
    const first = await api().post(path).auth(token, { type: 'bearer' }).expect(201);
    const second = await api().post(path).auth(token, { type: 'bearer' }).expect(201);
    expect(second.body).toMatchObject({ id: first.body.id, fromPdf: true, sourcePdfId: source.id, format: 'PNG' });
    expect(vi.mocked(writeFile).mock.calls).toHaveLength(writes + 1);
    const browse = await api().get(`${admin}/media?type=VISUAL`).query({ q: name }).auth(token, { type: 'bearer' }).expect(200);
    expect(browse.body.items.map(({ id }: { id: string }) => id)).toEqual([source.id]);
    await api().delete(`${admin}/media/${source.id}`).auth(token, { type: 'bearer' }).expect(204);
    expect(await prisma.media.findUnique({ where: { id: first.body.id } })).toBeNull();
  });

  it('distingue cookie absent, rotation valide et réutilisation sur auth/refresh', async () => {
    const path = '/api/v1/auth/refresh';
    const sessions = app.get(SessionService);
    const created = await prisma.$transaction((tx) =>
      sessions.create(tx, userId),
    );
    const cookie = `projetassos_refresh=${created.refreshToken}`;
    await api().post(path).expect(401);
    await api()
      .post(path)
      .set('Cookie', cookie)
      .expect(200)
      .expect('Set-Cookie', /^projetassos_refresh=/);
    await api().post(path).set('Cookie', cookie).expect(401);
    expect(
      (
        await prisma.session.findUniqueOrThrow({
          where: { id: created.session.id },
        })
      ).revokedAt,
    ).not.toBeNull();
  });
});
