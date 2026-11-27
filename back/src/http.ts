import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  INestApplication,
  Logger,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { fileURLToPath } from 'node:url';
import type { Application, NextFunction, Request, Response } from 'express';
import { createRequestLimit } from './auth/request-limit.js';
import { Prisma } from '../generated/prisma/client.js';
import { RuntimeConfig } from './config/runtime.module.js';
import { ContentInputError } from './content/content-input.error.js';
import { GoogleAccountAlreadyLinkedError } from './auth/google-account-already-linked.error.js';
import {
  passwordMaximumMessage,
  passwordMinimumMessage,
  PasswordValidationError,
} from './auth/password-validation.js';

export function httpErrorStatus(error: unknown) {
  if (error instanceof HttpException) return error.getStatus();
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (['P2002', 'P2003', 'P2004', 'P2034'].includes(error.code)) return 409;
    if (error.code === 'P2025') return 404;
  }
  return 500;
}

const sourceDirectory = new URL('.', import.meta.url);
const sourcePaths = [
  sourceDirectory.href,
  fileURLToPath(sourceDirectory).replaceAll('\\', '/'),
];

function applicationLocation(error: Error) {
  for (const line of error.stack?.split('\n').slice(1) ?? []) {
    if (!/^\s+at /.test(line)) continue;
    const frame = line.replaceAll('\\', '/');
    for (const prefix of sourcePaths) {
      const index = frame.indexOf(prefix);
      if (index < 0) continue;
      const location = /^([\w/-]+\.[cm]?[jt]s:\d+:\d+)\)?$/.exec(
        frame.slice(index + prefix.length),
      )?.[1];
      if (location) return location;
    }
  }
}

function databaseErrorCodes(error: Prisma.PrismaClientKnownRequestError) {
  const adapter = error.meta?.driverAdapterError;
  const cause =
    adapter && typeof adapter === 'object' && 'cause' in adapter
      ? adapter.cause
      : undefined;
  const code =
    cause && typeof cause === 'object' && 'originalCode' in cause
      ? cause.originalCode
      : error.meta?.code;
  return {
    prismaCode: /^P\d{4}$/.test(error.code) ? error.code : undefined,
    sqlState:
      typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) ? code : undefined,
  };
}

@Catch()
class ApiErrors implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrors.name);

  catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const status = httpErrorStatus(error);
    if (status >= 500) {
      const request = http.getRequest<Request>();
      const route: unknown = request.route?.path;
      const type =
        error instanceof Error ? error.constructor.name : 'Exception inconnue';
      // Seules les métadonnées de diagnostic sont journalisées. Les messages Prisma peuvent contenir des données SQL.
      this.logger.error({
        method: request.method,
        route: typeof route === 'string' ? route : '(route inconnue)',
        status,
        errorType: /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(type)
          ? type
          : 'Exception inconnue',
        ...(error instanceof Prisma.PrismaClientKnownRequestError
          ? databaseErrorCodes(error)
          : {}),
        location:
          error instanceof Error ? applicationLocation(error) : undefined,
      });
    }
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
    response.status(status).json({
      statusCode: status,
      message:
        error instanceof ContentInputError ||
        error instanceof PasswordValidationError
          ? error.message
          : (labels[status] ?? 'Erreur interne.'),
      ...(error instanceof GoogleAccountAlreadyLinkedError
        ? { code: GoogleAccountAlreadyLinkedError.code }
        : {}),
    });
  }
}

export function configureHttp(app: INestApplication) {
  const config = app.get(RuntimeConfig);
  const express: Application = app.getHttpAdapter().getInstance();
  express.disable('x-powered-by');
  if (config.trustProxyIp) express.set('trust proxy', config.trustProxyIp);
  const retryAfter = createRequestLimit(180, 10_000);
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });
  app.enableCors({
    origin: config.frontOrigin,
    credentials: true,
    exposedHeaders: ['Retry-After'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });
  app.use(
    '/api/v1',
    (request: Request, response: Response, next: NextFunction) => {
      response.set({
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy':
          "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
        ...(config.production
          ? { 'Strict-Transport-Security': 'max-age=31536000' }
          : {}),
      });
      const retry = retryAfter(
        request.ip ?? request.socket.remoteAddress ?? 'unknown',
      );
      if (retry) {
        response.set('Retry-After', String(retry)).status(429).json({
          statusCode: 429,
          message: 'Trop de tentatives. Réessayez plus tard.',
        });
        return;
      }
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
      exceptionFactory: (errors) => {
        // Seules les consignes publiques de longueur passent le filtre des erreurs API.
        if (
          errors.some(
            ({ constraints }) =>
              constraints?.maxLength === passwordMaximumMessage &&
              !constraints.isString,
          )
        )
          return new PasswordValidationError(passwordMaximumMessage);
        if (
          errors.some(
            ({ constraints }) =>
              constraints?.minLength === passwordMinimumMessage &&
              !constraints.isString,
          )
        )
          return new PasswordValidationError(passwordMinimumMessage);
        return new BadRequestException();
      },
    }),
  );
  app.useGlobalFilters(new ApiErrors());
}
