import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { isEmail } from 'class-validator';
import { Prisma } from '../../generated/prisma/client.js';
import { RuntimeConfig } from '../config/runtime.module.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { normalizeEmail } from './auth.dto.js';
import { GoogleAccountAlreadyLinkedError } from './google-account-already-linked.error.js';
import {
  lockUser,
  opaqueToken,
  SessionService,
  tokenPattern,
  uuidPattern,
} from './session.service.js';
import type { Principal } from './session.service.js';

type Flow = {
  state: string;
  nonce: string;
  verifier: string;
  sub?: string;
  sid?: string;
};

@Injectable()
export class GoogleService {
  private readonly client?: OAuth2Client;

  constructor(
    private readonly config: RuntimeConfig,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly sessions: SessionService,
  ) {
    if (config.googleClientId && config.googleClientSecret) {
      this.client = new OAuth2Client(
        config.googleClientId,
        config.googleClientSecret,
        config.googleRedirectUri,
      );
    }
  }

  async start(principal?: Principal) {
    const client = this.client;
    if (!client) throw new ServiceUnavailableException();
    const flow = {
      state: opaqueToken(),
      nonce: opaqueToken(),
      verifier: opaqueToken(),
      ...(principal ? { sub: principal.userId, sid: principal.sessionId } : {}),
    };
    const challenge = createHash('sha256')
      .update(flow.verifier)
      .digest('base64url');
    const authorize = new URL(
      client.generateAuthUrl({
        scope: ['openid', 'email', 'profile'],
        state: flow.state,
        code_challenge: challenge,
        code_challenge_method: CodeChallengeMethod.S256,
        prompt: 'select_account',
      }),
    );
    authorize.searchParams.set('nonce', flow.nonce);
    return {
      authorizationUrl: authorize.href,
      cookie: await this.jwt.signAsync(flow, {
        audience: 'projetassos-google',
        expiresIn: 600,
      }),
    };
  }

  async finish(cookie: string | undefined, code: unknown, state: unknown) {
    if (!this.client) throw new ServiceUnavailableException();
    if (
      !cookie ||
      typeof code !== 'string' ||
      !code ||
      code.length > 2048 ||
      typeof state !== 'string' ||
      !tokenPattern.test(state)
    )
      throw new BadRequestException();
    let flow: Flow;
    try {
      flow = await this.jwt.verifyAsync(cookie, {
        audience: 'projetassos-google',
        algorithms: ['HS256'],
      });
    } catch {
      throw new BadRequestException();
    }
    if (flow.state !== state) throw new BadRequestException();
    const identity = await this.identity(code, flow);

    if (
      flow.sub &&
      flow.sid &&
      uuidPattern.test(flow.sub) &&
      uuidPattern.test(flow.sid)
    ) {
      await this.prisma.$transaction(async (tx) => {
        await lockUser(tx, flow.sub!);
        await this.sessions.assertLive(tx, flow.sub!, flow.sid!);
        const user = await tx.user.findUniqueOrThrow({
          where: { id: flow.sub },
        });
        if (user.googleId === identity.sub) return;
        const existingOwner = await tx.user.findUnique({
          where: { googleId: identity.sub },
          select: { id: true },
        });
        if (existingOwner && existingOwner.id !== user.id)
          throw new GoogleAccountAlreadyLinkedError();
        if (user.googleId) throw new ConflictException();

        try {
          await tx.user.update({
            where: { id: user.id },
            data: { googleId: identity.sub },
          });
        } catch (error) {
          // Seul googleId change parmi les champs uniques. L’index couvre deux liaisons concurrentes.
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          )
            throw new GoogleAccountAlreadyLinkedError();
          throw error;
        }
        await tx.profile.update({
          where: { userId: user.id },
          data: { googleAvatar: identity.picture },
        });
        await tx.notification.create({
          data: {
            userId: user.id,
            type: 'ACCOUNT',
            title: 'Connexion Google',
            message: 'Une connexion Google a été associée à votre compte.',
          },
        });
      });
      return null;
    }

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.user.findUnique({
        where: { googleId: identity.sub },
        select: { id: true },
      });
      if (account) {
        await lockUser(tx, account.id);
        const user = await tx.user.findUnique({ where: { id: account.id } });
        if (
          !user ||
          user.status !== 'ACTIVE' ||
          user.passwordSetupPending ||
          user.googleId !== identity.sub
        ) {
          throw new UnauthorizedException();
        }
        await tx.user.update({
          where: { id: user.id },
          data: {
            lastActiveAt: new Date(),
            failedLoginCount: 0,
            loginBlockedUntil: null,
          },
        });
        return this.sessions.create(tx, user.id);
      }

      // L’e-mail sert uniquement à détecter un conflit. La liaison exige une session existante.
      if (
        await tx.user.findUnique({
          where: { email: identity.email },
          select: { id: true },
        })
      ) {
        throw new ConflictException();
      }
      const user = await tx.user.create({
        data: {
          googleId: identity.sub,
          email: identity.email,
          lastActiveAt: new Date(),
          profile: {
            create: {
              firstName: identity.firstName,
              lastName: identity.lastName,
              googleAvatar: identity.picture,
              avatarKind: identity.picture ? 'GOOGLE' : 'DEFAULT',
            },
          },
        },
        select: { id: true },
      });
      return this.sessions.create(tx, user.id);
    });
  }

  async unlink(principal: Principal) {
    return this.prisma.$transaction(async (tx) => {
      await lockUser(tx, principal.userId);
      await this.sessions.assertLive(tx, principal.userId, principal.sessionId);
      const user = await tx.user.findUniqueOrThrow({
        where: { id: principal.userId },
        include: { profile: { select: { avatarKind: true } } },
      });
      if (!user.googleId) return false;
      if (!user.passwordHash) throw new ConflictException();
      await tx.user.update({
        where: { id: user.id },
        data: { googleId: null },
      });
      await tx.profile.update({
        where: { userId: user.id },
        data: {
          googleAvatar: null,
          ...(user.profile?.avatarKind === 'GOOGLE'
            ? { avatarKind: 'DEFAULT' }
            : {}),
        },
      });
      await this.sessions.revoke(tx, user.id);
      await tx.notification.create({
        data: {
          userId: user.id,
          type: 'ACCOUNT',
          title: 'Connexion Google',
          message: 'La connexion Google a été dissociée de votre compte.',
        },
      });
      return true;
    });
  }

  private async identity(code: string, flow: Flow) {
    const client = this.client!;
    try {
      const { tokens } = await client.getToken({
        code,
        codeVerifier: flow.verifier,
        redirect_uri: this.config.googleRedirectUri,
      });
      if (!tokens.id_token) throw new UnauthorizedException();
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.config.googleClientId,
      });
      const payload = ticket.getPayload();
      const email = normalizeEmail(payload?.email ?? '');
      if (
        !payload?.sub ||
        payload.sub.length > 255 ||
        !payload.email_verified ||
        !isEmail(email) ||
        email.length > 254 ||
        (payload as { nonce?: string }).nonce !== flow.nonce
      ) {
        throw new UnauthorizedException();
      }
      const picture = URL.parse(payload.picture ?? '');
      return {
        email,
        sub: payload.sub,
        firstName: payload.given_name?.trim().slice(0, 100) || 'Membre',
        lastName: payload.family_name?.trim().slice(0, 100) || 'ProjetAssos',
        picture:
          picture?.protocol === 'https:' &&
          picture.hostname.endsWith('.googleusercontent.com')
            ? picture.href
            : undefined,
      };
    } catch {
      throw new UnauthorizedException();
    }
  }
}
