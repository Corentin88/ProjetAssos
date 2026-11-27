import {
  Body,
  Controller,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { RuntimeConfig } from '../src/config/runtime.module.js';
import { configureHttp } from '../src/http.js';

const privateData = 'donnee-confidentielle-de-test';

@Controller('fixtures')
class LoggingFixtureController {
  @Post(':id/echec')
  fails(@Body() body: { value: string }) {
    throw new Prisma.PrismaClientKnownRequestError(body.value, {
      code: 'P2039',
      clientVersion: 'test',
      meta: {
        driverAdapterError: {
          cause: { originalCode: '23514', originalMessage: body.value },
        },
      },
    });
  }

  @Post('session')
  unauthorized() {
    throw new UnauthorizedException();
  }
}

describe('Journal des erreurs serveur (e2e)', () => {
  it('journalise uniquement les métadonnées sûres d’un 500', async () => {
    const logger = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const module = await Test.createTestingModule({
      controllers: [LoggingFixtureController],
      providers: [
        {
          provide: RuntimeConfig,
          useValue: { frontOrigin: 'http://localhost:5173' },
        },
      ],
    }).compile();
    const app = module.createNestApplication();
    try {
      configureHttp(app);
      await app.init();
      await request(app.getHttpServer())
        .post(`/api/v1/fixtures/${privateData}/echec`)
        .query({ token: privateData })
        .set('Cookie', `test=${privateData}`)
        .send({ value: privateData })
        .expect(500, { statusCode: 500, message: 'Erreur interne.' });
      expect(logger).toHaveBeenCalledOnce();
      expect(logger).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          route: '/api/v1/fixtures/:id/echec',
          status: 500,
          errorType: 'PrismaClientKnownRequestError',
          prismaCode: 'P2039',
          sqlState: '23514',
        }),
      );
      expect(JSON.stringify(logger.mock.calls)).not.toContain(privateData);
      await request(app.getHttpServer())
        .post('/api/v1/fixtures/session')
        .expect(401);
      expect(logger).toHaveBeenCalledOnce();
    } finally {
      await app.close();
      logger.mockRestore();
    }
  });
});
