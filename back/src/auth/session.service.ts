import { randomBytes, createHash } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../../generated/prisma/client.js';
import type { UserRole } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.module.js';

export const accessSeconds = 600;
export const sessionMilliseconds = 30 * 24 * 60 * 60 * 1000;
export const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Principal = { userId: string; sessionId: string; role: UserRole };

export function opaqueToken() {
  return randomBytes(32).toString('base64url');
}

export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function lockUser(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid FOR UPDATE`;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async create(tx: Prisma.TransactionClient, userId: string) {
    const refreshToken = opaqueToken();
    const expiresAt = new Date(Date.now() + sessionMilliseconds);
    const session = await tx.session.create({
      data: {
        userId,
        expiresAt,
        refreshTokens: {
          create: { tokenHash: tokenHash(refreshToken), expiresAt },
        },
      },
      select: { id: true, expiresAt: true },
    });
    return { userId, session, refreshToken };
  }

  async access(userId: string, sessionId: string) {
    return {
      accessToken: await this.jwt.signAsync(
        { sub: userId, sid: sessionId, purpose: 'access' },
        {
          audience: 'projetassos-api',
          expiresIn: accessSeconds,
        },
      ),
      tokenType: 'Bearer',
      expiresIn: accessSeconds,
    };
  }

  async authenticate(header?: string): Promise<Principal> {
    const match = header?.match(/^Bearer ([A-Za-z0-9_.-]+)$/i);
    if (!match || match[1].length > 2048) throw new UnauthorizedException();

    let payload: { sub?: string; sid?: string; purpose?: string };
    try {
      payload = await this.jwt.verifyAsync(match[1], {
        audience: 'projetassos-api',
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException();
    }
    if (
      payload.purpose !== 'access' ||
      !payload.sub ||
      !payload.sid ||
      !uuidPattern.test(payload.sub) ||
      !uuidPattern.test(payload.sid)
    ) {
      throw new UnauthorizedException();
    }
    return this.assertLive(this.prisma, payload.sub, payload.sid);
  }

  async assertLive(
    tx: Prisma.TransactionClient,
    userId: string,
    sessionId: string,
  ): Promise<Principal> {
    const session = await tx.session.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: 'ACTIVE', passwordSetupPending: false },
      },
      select: { user: { select: { role: true } } },
    });
    if (!session) throw new UnauthorizedException();
    return { userId, sessionId, role: session.user.role };
  }

  async rotate(refreshToken?: string) {
    if (!refreshToken || !tokenPattern.test(refreshToken))
      throw new UnauthorizedException();
    const hash = tokenHash(refreshToken);
    const match = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      select: { session: { select: { userId: true } } },
    });
    if (!match) throw new UnauthorizedException();
    const { userId } = match.session;
    const result = await this.prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const token = await tx.refreshToken.findUnique({
        where: { tokenHash: hash },
        include: {
          session: {
            include: {
              user: { select: { status: true, passwordSetupPending: true } },
            },
          },
        },
      });
      const now = new Date();
      if (
        !token ||
        token.session.revokedAt ||
        token.session.expiresAt <= now ||
        token.session.user.status !== 'ACTIVE' ||
        token.session.user.passwordSetupPending
      )
        return null;

      // Une réutilisation révoque la session entière. La révocation est validée avant le retour HTTP.
      if (token.consumedAt) {
        await this.revoke(tx, userId, token.sessionId);
        return null;
      }
      if (token.revokedAt || token.expiresAt <= now) return null;

      const next = opaqueToken();
      await tx.refreshToken.update({
        where: { id: token.id },
        data: { consumedAt: now },
      });
      await tx.refreshToken.create({
        data: {
          sessionId: token.sessionId,
          tokenHash: tokenHash(next),
          expiresAt: token.session.expiresAt,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { lastActiveAt: now },
      });
      return { userId, session: token.session, refreshToken: next };
    });
    if (!result) throw new UnauthorizedException();
    return result;
  }

  async revoke(
    tx: Prisma.TransactionClient,
    userId: string,
    sessionId?: string,
  ) {
    const now = new Date();
    const sessions = { userId, ...(sessionId ? { id: sessionId } : {}) };
    await tx.session.updateMany({
      where: { ...sessions, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.refreshToken.updateMany({
      where: { session: sessions, revokedAt: null, consumedAt: null },
      data: { revokedAt: now },
    });
  }

  list(principal: Principal) {
    return this.prisma.session
      .findMany({
        where: {
          userId: principal.userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true, createdAt: true, expiresAt: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
      .then((sessions) =>
        sessions.map((session) => ({
          ...session,
          current: session.id === principal.sessionId,
        })),
      );
  }

  async revokeFromPrincipal(principal: Principal, sessionId?: string) {
    await this.prisma.$transaction(async (tx) => {
      await lockUser(tx, principal.userId);
      await this.assertLive(tx, principal.userId, principal.sessionId);
      await this.revoke(tx, principal.userId, sessionId);
    });
  }
}
