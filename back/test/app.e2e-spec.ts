import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { randomBytes } from 'node:crypto';
import { AppModule } from './../src/app.module.js';
import { RuntimeConfig } from '../src/config/runtime.module.js';
import { configureHttp } from '../src/http.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RuntimeConfig)
      .useValue({
        databaseUrl: new URL('postgresql://127.0.0.1/projetassos'),
        jwtSecret: randomBytes(32).toString('base64url'),
        apiOrigin: 'http://localhost:3000',
        frontOrigin: 'http://localhost:5173',
      })
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

  afterEach(async () => {
    await app.close();
  });
});
