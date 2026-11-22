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
    if (roles?.length && !roles.includes(principal.role))
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
  private readonly windows = new Map<
    string,
    { until: number; count: number }
  >();

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const key = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    let window = this.windows.get(key);
    if (!window || window.until <= now) {
      if (this.windows.size >= 2000) {
        for (const [ip, entry] of this.windows) {
          if (entry.until <= now) this.windows.delete(ip);
        }
        if (this.windows.size >= 2000 && !this.windows.has(key))
          throw new HttpException('', 429);
      }
      window = { count: 0, until: now + 60_000 };
      this.windows.set(key, window);
    }
    if (++window.count > 30) {
      response.setHeader('Retry-After', Math.ceil((window.until - now) / 1000));
      throw new HttpException('', 429);
    }
    return true;
  }
}
