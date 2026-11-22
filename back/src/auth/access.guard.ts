import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { UserRole } from '../../generated/prisma/client.js';
import { RuntimeConfig } from '../config/runtime.module.js';
import { createRequestLimit } from './request-limit.js';
import { SessionService } from './session.service.js';
import type { Principal } from './session.service.js';

type AuthenticatedRequest = Request & { principal: Principal };
const rolesMetadata = 'allowedRoles';

export const Roles = (...roles: UserRole[]) =>
  SetMetadata(rolesMetadata, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().principal,
);

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.principal = await this.sessions.authenticate(
      request.get('authorization'),
    );
    return true;
  }
}

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(rolesMetadata, [
      context.getHandler(),
      context.getClass(),
    ]);
    const { principal } = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    if (roles?.length && (!principal || !roles.includes(principal.role)))
      throw new ForbiddenException();
    return true;
  }
}

@Injectable()
export class BrowserOriginGuard implements CanActivate {
  constructor(private readonly config: RuntimeConfig) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    const origin = request.get('origin');
    if (
      (origin &&
        origin !== this.config.frontOrigin &&
        origin !== this.config.apiOrigin) ||
      (request.get('sec-fetch-site') === 'cross-site' && !origin)
    ) {
      throw new ForbiddenException();
    }
    return true;
  }
}

@Injectable()
export class AuthRateGuard implements CanActivate {
  private readonly retryAfter = createRequestLimit(30);

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const retry = this.retryAfter(
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
    if (retry) {
      context
        .switchToHttp()
        .getResponse<Response>()
        .setHeader('Retry-After', retry);
      throw new HttpException('', 429);
    }
    return true;
  }
}
