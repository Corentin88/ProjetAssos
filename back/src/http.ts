import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import { RuntimeConfig } from './config/runtime.module.js';

@Catch()
class ApiErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const prismaCode =
      error instanceof Prisma.PrismaClientKnownRequestError ? error.code : '';
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : prismaCode === 'P2002'
          ? 409
          : prismaCode === 'P2025'
            ? 404
            : ['P2004', 'P2034'].includes(prismaCode)
              ? 409
              : 500;
    const labels: Record<number, string> = {
      400: 'Requête invalide.',
      401: 'Authentification requise ou identifiants invalides.',
      403: 'Accès refusé.',
      404: 'Ressource introuvable.',
      409: 'Opération incompatible avec l’état actuel.',
      413: 'Fichier trop volumineux.',
      415: 'Format de fichier non pris en charge.',
      429: 'Trop de tentatives. Réessayez plus tard.',
      503: 'Service temporairement indisponible.',
    };
    response
      .status(status)
      .json({
        statusCode: status,
        message: labels[status] ?? 'Erreur interne.',
      });
  }
}

export function configureHttp(app: INestApplication) {
  const config = app.get(RuntimeConfig);
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });
  app.enableCors({
    origin: config.frontOrigin,
    credentials: true,
    exposedHeaders: ['Retry-After'],
  });
  app.use(
    '/api/v1',
    (_request: Request, response: Response, next: NextFunction) => {
      response.set({
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      });
      next();
    },
  );
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(new ApiErrors());
}
