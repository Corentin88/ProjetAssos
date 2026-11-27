import { randomBytes, randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { LoginTicket, OAuth2Client } from 'google-auth-library';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountToken, Prisma, User } from '../generated/prisma/client.js';
import { AccountLinksService } from '../src/auth/account-links.service.js';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { GoogleService } from '../src/auth/google.service.js';
import {
  opaqueToken,
  SessionService,
  tokenHash,
} from '../src/auth/session.service.js';
import { RuntimeConfig } from '../src/config/runtime.module.js';
import { configureHttp } from '../src/http.js';
import { PrismaService } from '../src/prisma/prisma.module.js';
import { AccountsService } from '../src/users/accounts.service.js';

const auth = '/api/v1/auth';
const frontOrigin = 'http://localhost:5173';
const apiOrigin = 'http://localhost:3000';
const email = 'membre@example.test';
const googleId = 'identifiant-google-fictif';
const password = 'abcdefghijkl';

type FixtureUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'googleId'
  | 'passwordHash'
  | 'passwordSetupPending'
  | 'status'
  | 'role'
  | 'loginBlockedUntil'
  | 'failedLoginCount'
>;

function memoryDatabase() {
  let users = new Map<string, FixtureUser>();
  let links = new Map<string, AccountToken>();
  function findUser({ id, email, googleId }: Prisma.UserWhereUniqueInput) {
    if (id) return users.get(id) ?? null;
    return (
      [...users.values()].find((user) =>
        email ? user.email === email : user.googleId === googleId,
      ) ?? null
    );
  }
  const tx = {
    $queryRaw: vi.fn(),
    user: {
      findUnique: ({ where }: { where: Prisma.UserWhereUniqueInput }) =>
        findUser(where),
      findUniqueOrThrow: ({
        where,
      }: {
        where: Prisma.UserWhereUniqueInput;
      }) => {
        const user = findUser(where);
        if (!user) throw new Error('Compte absent du test.');
        return user;
      },
      create: vi.fn(
        ({
          data,
        }: {
          data: Pick<FixtureUser, 'email'> & Partial<FixtureUser>;
        }) => {
          const user: FixtureUser = {
            id: randomUUID(),
            googleId: null,
            passwordHash: null,
            passwordSetupPending: false,
            status: 'ACTIVE',
            role: 'USER',
            loginBlockedUntil: null,
            failedLoginCount: 0,
            ...data,
          };
          users.set(user.id, user);
          return user;
        },
      ),
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FixtureUser>;
      }) => Object.assign(users.get(where.id)!, data),
    },
    accountToken: {
      findFirst: ({
        where,
      }: {
        where: { userId: string; purpose: string; createdAt: { gt: Date } };
      }) =>
        [...links.values()].find(
          (link) =>
            link.userId === where.userId &&
            link.purpose === where.purpose &&
            link.createdAt > where.createdAt.gt,
        ),
      create: ({
        data,
      }: {
        data: Omit<
          AccountToken,
          'id' | 'createdAt' | 'consumedAt' | 'revokedAt'
        >;
      }) => {
        const token = {
          ...data,
          id: randomUUID(),
          createdAt: new Date(),
          consumedAt: null,
          revokedAt: null,
        };
        links.set(token.id, token);
        return token;
      },
      findUnique: ({ where }: { where: { tokenHash: string } }) => {
        const link = [...links.values()].find(
          (item) => item.tokenHash === where.tokenHash,
        );
        return link && { ...link, user: users.get(link.userId) };
      },
      updateMany: ({
        where,
        data,
      }: {
        where: { userId: string; purpose: string };
        data: { revokedAt: Date };
      }) => {
        for (const link of links.values()) {
          if (
            link.userId === where.userId &&
            link.purpose === where.purpose &&
            !link.consumedAt &&
            !link.revokedAt
          )
            link.revokedAt = data.revokedAt;
        }
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<AccountToken>;
      }) => Object.assign(links.get(where.id)!, data),
    },
    profile: { update: vi.fn() },
    notification: { create: vi.fn() },
  };
  return {
    tx,
    findUser,
    links: () => [...links.values()],
    prisma: {
      ...tx,
      $transaction: async <T>(run: (value: typeof tx) => Promise<T>) => {
        const snapshot = [
          structuredClone(users),
          structuredClone(links),
        ] as const;
        try {
          return await run(tx);
        } catch (error) {
          [users, links] = snapshot;
          throw error;
        }
      },
    },
  };
}

function memorySessions() {
  type FixtureSession = {
    userId: string;
    refreshToken: string;
    session: { id: string; expiresAt: Date };
  };
  const active = new Map<string, FixtureSession>();
  return {
    create: (_tx: unknown, userId: string) => {
      const session = {
        id: randomUUID(),
        expiresAt: new Date(Date.now() + 60_000),
      };
      const result = { userId, session, refreshToken: opaqueToken() };
      active.set(session.id, result);
      return result;
    },
    access: (_: string, sessionId: string) => ({
      accessToken: sessionId,
      expiresIn: 60,
    }),
    rotate: (token: string) => {
      const found = [...active.values()].find(
        (item) => item.refreshToken === token,
      );
      if (!found) throw new UnauthorizedException();
      return found;
    },
    authenticate: (header?: string) => {
      const found = active.get(header?.replace(/^Bearer /, '') ?? '');
      if (!found) throw new UnauthorizedException();
      return {
        userId: found.userId,
        sessionId: found.session.id,
        role: 'USER',
      };
    },
    assertLive: (_: unknown, userId: string, sessionId: string) => {
      if (active.get(sessionId)?.userId !== userId)
        throw new UnauthorizedException();
      return { role: 'USER' };
    },
    revoke: (_: unknown, id: string) => {
      for (const [sid, item] of active)
        if (item.userId === id) active.delete(sid);
    },
  };
}

describe('Premier mot de passe sur un compte Google (e2e)', () => {
  let app: INestApplication<App>;
  let database: ReturnType<typeof memoryDatabase>;
  let nonce: string;
  const mail = {
    assertConfigured: vi.fn(),
    send: vi.fn<(address: string, purpose: string, token: string) => void>(),
  };
  const api = () => request(app.getHttpServer());
  const payload = (token: string, value = password) => ({
    token,
    password: value,
    passwordConfirmation: value,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    database = memoryDatabase();
    vi.spyOn(OAuth2Client.prototype, 'getToken').mockImplementation(
      async () => ({ tokens: { id_token: 'fictif' }, res: null }),
    );
    vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockImplementation(
      async () =>
        new LoginTicket(undefined, {
          iss: 'https://accounts.google.com',
          aud: 'client',
          sub: googleId,
          iat: 0,
          exp: 100,
          email,
          email_verified: true,
          nonce,
        } as NonNullable<ReturnType<LoginTicket['getPayload']>>),
    );
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AccountsService,
        AuthService,
        GoogleService,
        {
          provide: RuntimeConfig,
          useValue: {
            frontOrigin,
            apiOrigin,
            googleClientId: 'client',
            googleClientSecret: 'fictif',
            googleRedirectUri: `${apiOrigin}${auth}/google/callback`,
          },
        },
        { provide: PrismaService, useValue: database.prisma },
        { provide: AccountLinksService, useValue: mail },
        { provide: SessionService, useValue: memorySessions() },
        {
          provide: JwtService,
          useValue: new JwtService({ secret: randomBytes(32) }),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    configureHttp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  async function signInWithGoogle() {
    const browser = request.agent(app.getHttpServer());
    const start = await browser.post(`${auth}/google/start`).expect(200);
    const { searchParams } = new URL(start.body.authorizationUrl);
    nonce = searchParams.get('nonce')!;
    await browser
      .get(`${auth}/google/callback`)
      .query({ code: 'fictif', state: searchParams.get('state') })
      .expect(303)
      .expect('Location', `${frontOrigin}/#/connexion?google=ok`);
    const refresh = await browser.post(`${auth}/refresh`).expect(200);
    return String(refresh.body.accessToken);
  }

  it('ajoute le mot de passe sur le même compte, puis autorise les deux connexions et la dissociation', async () => {
    const accessToken = await signInWithGoogle();
    const { id } = database.findUser({ email })!;
    expect(database.findUser({ id })).toMatchObject({
      email,
      googleId,
      role: 'USER',
      status: 'ACTIVE',
      passwordHash: null,
    });
    await api()
      .delete(`${auth}/google/link`)
      .auth(accessToken, { type: 'bearer' })
      .expect(409);
    await api().post(`${auth}/password/setup/request`).expect(401);
    await api()
      .post(`${auth}/password/setup/request`)
      .auth(accessToken, { type: 'bearer' })
      .expect(202);
    const [recipient, purpose, token] = mail.send.mock.calls[0];
    expect([recipient, purpose]).toEqual([email, 'FIRST_PASSWORD']);
    const [stored] = database.links();
    expect(stored.tokenHash).toBe(tokenHash(token));
    expect(
      stored.expiresAt.getTime() - stored.createdAt.getTime(),
    ).toBeGreaterThan(29 * 60_000);
    expect(
      stored.expiresAt.getTime() - stored.createdAt.getTime(),
    ).toBeLessThanOrEqual(30 * 60_000);
    await api()
      .post(`${auth}/password/setup/request`)
      .auth(accessToken, { type: 'bearer' })
      .expect(429);
    expect(mail.send).toHaveBeenCalledOnce();
    await api().post(`${auth}/password/reset`).send(payload(token)).expect(400);
    await api().post(`${auth}/password/setup`).send(payload(token)).expect(204);
    await api().post(`${auth}/password/setup`).send(payload(token)).expect(400);
    await api()
      .post(`${auth}/password/setup/request`)
      .auth(accessToken, { type: 'bearer' })
      .expect(401);
    expect(database.findUser({ email })).toMatchObject({
      id,
      googleId,
      role: 'USER',
      status: 'ACTIVE',
    });
    expect(database.findUser({ id })?.passwordHash).toMatch(/^\$argon2id\$/);
    const classic = await api()
      .post(`${auth}/login`)
      .send({ email, password })
      .expect(200);
    const google = await signInWithGoogle();
    await api()
      .post(`${auth}/password/setup/request`)
      .auth(classic.body.accessToken, { type: 'bearer' })
      .expect(409);
    await api()
      .delete(`${auth}/google/link`)
      .auth(google, { type: 'bearer' })
      .expect(204);
    expect(database.findUser({ email })).toMatchObject({
      id,
      googleId: null,
      role: 'USER',
      status: 'ACTIVE',
    });
    expect(database.tx.user.create).toHaveBeenCalledOnce();
  });

  it('rejette un lien expiré et accepte un nouveau lien demandé depuis le compte', async () => {
    const accessToken = await signInWithGoogle();
    const issue = () =>
      api()
        .post(`${auth}/password/setup/request`)
        .auth(accessToken, { type: 'bearer' })
        .expect(202);
    await issue();
    const [expired] = database.links();
    expired.createdAt = new Date(Date.now() - 31 * 60_000);
    expired.expiresAt = new Date(Date.now() - 60_000);
    await api()
      .post(`${auth}/password/setup`)
      .send(payload(mail.send.mock.calls[0][2]))
      .expect(400);
    expect(database.findUser({ email })?.passwordHash).toBeNull();
    await issue();
    await api()
      .post(`${auth}/password/setup`)
      .send(payload(mail.send.mock.calls[1][2]))
      .expect(204);
  });

  it('applique les mêmes limites aux nouveaux mots de passe et accepte une inscription conforme', async () => {
    const details = { email, firstName: 'Membre', lastName: 'Exemple' };
    const registration = await api()
      .post(`${auth}/register`)
      .send({ ...details, password })
      .expect(201);
    for (const [size, message] of [
      [11, 'Votre mot de passe doit contenir au moins 12 caractères.'],
      [129, 'Votre mot de passe ne peut pas dépasser 128 caractères.'],
    ] as const) {
      const invalid = 'a'.repeat(size);
      await api()
        .post(`${auth}/register`)
        .send({ ...details, password: invalid })
        .expect(400, { statusCode: 400, message });
      for (const path of [
        'password/reset',
        'password/setup',
        'invitations/complete',
      ]) {
        await api()
          .post(`${auth}/${path}`)
          .send(payload(opaqueToken(), invalid))
          .expect(400, { statusCode: 400, message });
      }
      await api()
        .post(`${auth}/password/change`)
        .auth(registration.body.accessToken, { type: 'bearer' })
        .send({
          currentPassword: password,
          password: invalid,
          passwordConfirmation: invalid,
        })
        .expect(400, { statusCode: 400, message });
    }
    await api()
      .post(`${auth}/register`)
      .send({
        ...details,
        email: 'autre@example.test',
        password: 'a'.repeat(128),
      })
      .expect(201);
  });

  it('préserve la réinitialisation du mot de passe existant dans son parcours dédié', async () => {
    await api()
      .post(`${auth}/register`)
      .send({ email, firstName: 'Membre', lastName: 'Exemple', password })
      .expect(201);
    await api().post(`${auth}/password/forgot`).send({ email }).expect(202);
    await vi.waitFor(() => expect(mail.send).toHaveBeenCalledOnce());
    const [recipient, purpose, token] = mail.send.mock.calls[0];
    expect([recipient, purpose]).toEqual([email, 'PASSWORD_RESET']);
    const newPassword = 'mot de passe de remplacement';
    await api()
      .post(`${auth}/password/setup`)
      .send(payload(token, newPassword))
      .expect(400);
    await api()
      .post(`${auth}/password/reset`)
      .send(payload(token, newPassword))
      .expect(204);
    await api().post(`${auth}/login`).send({ email, password }).expect(401);
    await api()
      .post(`${auth}/login`)
      .send({ email, password: newPassword })
      .expect(200);
  });
});
