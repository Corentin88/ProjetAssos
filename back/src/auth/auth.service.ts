import { randomBytes } from 'node:crypto';
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { argon2id, hash, verify } from 'argon2';
import { PrismaService } from '../prisma/prisma.module.js';
import type { ChangePasswordDto, LoginDto, RegisterDto } from './auth.dto.js';
import { lockUser, SessionService } from './session.service.js';
import type { Principal } from './session.service.js';

let passwordWork = 0;

async function withPasswordWork<T>(operation: () => Promise<T>) {
  // Chaque opération Argon2 réserve 64 Mio. Borne commune aux flux qui calculent ou vérifient un hash.
  if (passwordWork >= 4) throw new ServiceUnavailableException();
  passwordWork++;
  try {
    return await operation();
  } finally {
    passwordWork--;
  }
}

export function hashPassword(password: string) {
  return withPasswordWork(() =>
    hash(password, {
      type: argon2id,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    }),
  );
}

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await hashPassword(dto.password);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          lastActiveAt: new Date(),
          profile: {
            create: { firstName: dto.firstName, lastName: dto.lastName },
          },
        },
        select: { id: true },
      });
      return this.sessions.create(tx, user.id);
    });
  }

  async login(dto: LoginDto) {
    const candidate = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        passwordHash: true,
        loginBlockedUntil: true,
        status: true,
        passwordSetupPending: true,
      },
    });
    if (
      candidate?.loginBlockedUntil &&
      candidate.loginBlockedUntil > new Date()
    ) {
      throw new UnauthorizedException();
    }
    const hashToCheck =
      candidate?.passwordHash ??
      (await (this.dummyHash ??= hashPassword(
        randomBytes(32).toString('hex'),
      ).catch((error) => {
        this.dummyHash = undefined;
        throw error;
      })));
    const matched = await withPasswordWork(() =>
      verify(hashToCheck, dto.password),
    );
    if (
      !candidate?.passwordHash ||
      candidate.status !== 'ACTIVE' ||
      candidate.passwordSetupPending
    ) {
      throw new UnauthorizedException();
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await lockUser(tx, candidate.id);
      const user = await tx.user.findUnique({ where: { id: candidate.id } });
      const now = new Date();
      if (
        !user ||
        user.passwordHash !== candidate.passwordHash ||
        user.email !== dto.email ||
        user.status !== 'ACTIVE' ||
        user.passwordSetupPending ||
        (user.loginBlockedUntil && user.loginBlockedUntil > now)
      )
        return null;

      if (!matched) {
        const failedLoginCount = Math.min(user.failedLoginCount + 1, 15);
        const loginBlockedUntil =
          failedLoginCount >= 3
            ? new Date(
                now.getTime() +
                  Math.min(300, 2 ** (failedLoginCount - 3)) * 1000,
              )
            : null;
        await tx.user.update({
          where: { id: user.id },
          data: { failedLoginCount, loginBlockedUntil },
        });
        return null;
      }
      await tx.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: 0,
          loginBlockedUntil: null,
          lastActiveAt: now,
        },
      });
      return this.sessions.create(tx, user.id);
    });
    if (!result) throw new UnauthorizedException();
    return result;
  }

  async changePassword(principal: Principal, dto: ChangePasswordDto) {
    if (dto.password !== dto.passwordConfirmation)
      throw new BadRequestException();
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: principal.userId },
      select: { passwordHash: true },
    });
    if (
      !user.passwordHash ||
      !(await withPasswordWork(() =>
        verify(user.passwordHash!, dto.currentPassword),
      ))
    )
      throw new UnauthorizedException();
    const nextHash = await hashPassword(dto.password);

    await this.prisma.$transaction(async (tx) => {
      await lockUser(tx, principal.userId);
      await this.sessions.assertLive(tx, principal.userId, principal.sessionId);
      const update = await tx.user.updateMany({
        where: { id: principal.userId, passwordHash: user.passwordHash },
        data: {
          passwordHash: nextHash,
          failedLoginCount: 0,
          loginBlockedUntil: null,
        },
      });
      if (!update.count) throw new UnauthorizedException();
      await tx.accountToken.updateMany({
        where: {
          userId: principal.userId,
          purpose: 'PASSWORD_RESET',
          revokedAt: null,
          consumedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      await this.sessions.revoke(tx, principal.userId);
      await tx.notification.create({
        data: {
          userId: principal.userId,
          type: 'ACCOUNT',
          title: 'Sécurité du compte',
          message: 'Votre mot de passe a été modifié.',
        },
      });
    });
  }
}
