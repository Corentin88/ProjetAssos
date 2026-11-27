import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  INestApplication,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { randomBytes } from 'node:crypto';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { RuntimeConfig } from '../src/config/runtime.module.js';
import { configureHttp } from '../src/http.js';
import { GoogleAccountAlreadyLinkedError } from '../src/auth/google-account-already-linked.error.js';
import { GoogleService } from '../src/auth/google.service.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const finishGoogle = vi.fn();
  const callback = '/api/v1/auth/google/callback';
  const frontOrigin = 'http://localhost:5173';

  beforeEach(async () => {
    finishGoogle.mockReset();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RuntimeConfig)
      .useValue({
        databaseUrl: new URL('postgresql://127.0.0.1/projetassos'),
        jwtSecret: randomBytes(32).toString('base64url'),
        apiOrigin: 'http://localhost:3000',
        frontOrigin,
      })
      .overrideProvider(GoogleService)
      .useValue({ finish: finishGoogle })
      .compile();

    app = moduleFixture.createNestApplication();
    configureHttp(app);
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('refuse le téléchargement GPX à un visiteur anonyme', () => {
    const id = '00000000-0000-4000-a000-000000000000';
    return request(app.getHttpServer())
      .get(`/api/v1/articles/${id}/blocks/${id}/gpx`)
      .expect(401);
  });

  it('redirige une association Google réussie vers la sécurité du compte', () => {
    finishGoogle.mockResolvedValue(null);
    return request(app.getHttpServer())
      .get(callback)
      .set('Accept', 'text/html')
      .expect(303)
      .expect('Location', `${frontOrigin}/#/mon-compte/securite?google=ok`);
  });

  it('redirige un conflit Google confirmé avec le seul motif public', async () => {
    finishGoogle.mockRejectedValue(new GoogleAccountAlreadyLinkedError());
    await request(app.getHttpServer())
      .get(
        `${callback}?code=code-fictif&state=etat-fictif&next=https://example.test`,
      )
      .set('Cookie', 'projetassos_google=cookie-fictif')
      .set(
        'Accept',
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      )
      .expect(303)
      .expect(
        'Location',
        `${frontOrigin}/#/erreur/409?motif=GOOGLE_ACCOUNT_ALREADY_LINKED`,
      )
      .expect('Content-Type', /text\/html/)
      .expect('Referrer-Policy', 'no-referrer')
      .expect('Set-Cookie', /^projetassos_google=;/);
    expect(finishGoogle).toHaveBeenCalledWith(
      'cookie-fictif',
      'code-fictif',
      'etat-fictif',
    );
  });

  it.each(['application/json', '*/*'])(
    'conserve le statut 409 JSON avec Accept %s',
    async (accept) => {
      finishGoogle.mockRejectedValue(new GoogleAccountAlreadyLinkedError());
      await request(app.getHttpServer())
        .get(callback)
        .set('Accept', accept)
        .expect(409, {
          statusCode: 409,
          message: 'Opération incompatible avec l’état actuel.',
          code: 'GOOGLE_ACCOUNT_ALREADY_LINKED',
        });
    },
  );

  it('redirige un autre conflit vers la page 409 générique', () => {
    finishGoogle.mockRejectedValue(new ConflictException());
    return request(app.getHttpServer())
      .get(callback)
      .set('Accept', 'text/html')
      .expect(303)
      .expect('Location', `${frontOrigin}/#/erreur/409`);
  });

  it.each([
    [new ForbiddenException(), 403],
    [new Error('Détail interne'), 500],
  ] as const)('conserve le statut hors conflit %s', async (error, status) => {
    finishGoogle.mockRejectedValue(error);
    await request(app.getHttpServer())
      .get(callback)
      .set('Accept', 'text/html')
      .expect(status)
      .expect('Content-Type', /application\/json/);
  });

  afterEach(async () => {
    await app.close();
  });
});
