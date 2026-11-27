import { ConflictException, BadRequestException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { LoginTicket, OAuth2Client } from 'google-auth-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import type { RuntimeConfig } from '../config/runtime.module.js';
import type { PrismaService } from '../prisma/prisma.module.js';
import { GoogleAccountAlreadyLinkedError } from './google-account-already-linked.error.js';
import { GoogleService } from './google.service.js';
import type { SessionService } from './session.service.js';

const userId = '00000000-0000-4000-a000-000000000001';
const sessionId = '00000000-0000-4000-a000-000000000002';
const state = 's'.repeat(43);
const googleId = 'identifiant-google-fictif';

function fixture(currentGoogleId: string | null = null) {
  const workflow = {
    sub: userId,
    sid: sessionId,
    state,
    nonce: 'nonce',
    verifier: 'verifier',
  };
  const config = {
    googleClientId: 'client',
    googleClientSecret: 'fictif',
    googleRedirectUri:
      'https://association.example.test/api/v1/auth/google/callback',
  } as RuntimeConfig;
  const tokenExchange = vi
    .spyOn(OAuth2Client.prototype, 'getToken')
    .mockImplementation(async () => ({
      tokens: { id_token: 'jeton-fictif' },
      res: null,
    }));
  vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockImplementation(
    async () =>
      new LoginTicket(undefined, {
        iss: 'https://accounts.google.com',
        aud: 'client',
        sub: googleId,
        iat: 0,
        exp: 100,
        email: 'membre@example.test',
        email_verified: true,
        nonce: workflow.nonce,
      } as NonNullable<ReturnType<LoginTicket['getPayload']>>),
  );
  const tx = {
    $queryRaw: vi.fn(),
    user: {
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ id: userId, googleId: currentGoogleId }),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
    profile: { update: vi.fn() },
    notification: { create: vi.fn() },
  };
  const assertLive = vi.fn();
  const prisma = {
    $transaction: (run: (client: typeof tx) => unknown) => run(tx),
  };
  const service = new GoogleService(
    config,
    prisma as unknown as PrismaService,
    {
      verifyAsync: vi.fn().mockResolvedValue(workflow),
    } as unknown as JwtService,
    { assertLive } as unknown as SessionService,
  );
  return { service, tx, assertLive, tokenExchange };
}

describe('GoogleService · association', () => {
  afterEach(() => vi.restoreAllMocks());

  it('associe l’identité vérifiée au compte de la session', async () => {
    const { service, tx, assertLive, tokenExchange } = fixture();
    await expect(service.finish('cookie', 'code', state)).resolves.toBeNull();
    expect(tokenExchange).toHaveBeenCalledWith(
      expect.objectContaining({ codeVerifier: 'verifier' }),
    );
    expect(assertLive).toHaveBeenCalledWith(tx, userId, sessionId);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { googleId },
    });
    expect(tx.profile.update).toHaveBeenCalledOnce();
    expect(tx.notification.create).toHaveBeenCalledOnce();
  });

  it('signale une identité détenue par un autre compte sans effectuer d’écriture', async () => {
    const { service, tx } = fixture();
    tx.user.findUnique.mockResolvedValue({ id: 'autre-compte' });
    await expect(
      service.finish('cookie', 'code', state),
    ).rejects.toBeInstanceOf(GoogleAccountAlreadyLinkedError);
    expect(tx.user.findUnique).toHaveBeenCalledWith({
      where: { googleId },
      select: { id: true },
    });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.profile.update).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it('signale le même conflit si une liaison concurrente déclenche l’index unique', async () => {
    const { service, tx } = fixture();
    tx.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Conflit simulé', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.finish('cookie', 'code', state),
    ).rejects.toBeInstanceOf(GoogleAccountAlreadyLinkedError);
    expect(tx.profile.update).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it('garde un conflit générique si le compte de la session a déjà une autre identité', async () => {
    const { service, tx } = fixture('autre-identite');
    await expect(service.finish('cookie', 'code', state)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ConflictException &&
        !(error instanceof GoogleAccountAlreadyLinkedError),
    );
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('refuse un état OAuth invalide avant de contacter Google', async () => {
    const { service, tokenExchange } = fixture();
    await expect(
      service.finish('cookie', 'code', 'x'.repeat(43)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tokenExchange).not.toHaveBeenCalled();
  });
});
