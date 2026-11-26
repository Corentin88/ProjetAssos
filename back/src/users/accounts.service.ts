import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import type { AccountTokenPurpose } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { RuntimeConfig } from '../config/runtime.module.js';
import type {
  AdminProfileDto,
  ChangeRoleDto,
  ChangeStatusDto,
  CompletePasswordDto,
  InviteDto,
} from '../auth/auth.dto.js';
import { hashPassword } from '../auth/auth.service.js';
import { accountLinkMinutes, AccountLinksService } from '../auth/account-links.service.js';
import {
  lockUser,
  opaqueToken,
  SessionService,
  tokenHash,
} from '../auth/session.service.js';
import type { Principal } from '../auth/session.service.js';
import {
  removeAvatarFile,
  removeAvatarRecord,
} from '../profiles/avatar-files.js';

import { presentAvatar, profileFields } from '../profiles/profile-avatar.js';

const operationalAdmin = {
  role: 'ADMIN',
  status: 'ACTIVE',
  passwordSetupPending: false,
} satisfies Prisma.UserWhereInput;
const accountFields = {
  id: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  lastActiveAt: true,
  passwordHash: true,
  googleId: true,
  passwordSetupPending: true,
  profile: { select: profileFields },
} satisfies Prisma.UserSelect;

function presentAccount(
  account: Prisma.UserGetPayload<{ select: typeof accountFields }>,
) {
  return {
    id: account.id,
    email: account.email,
    role: account.role,
    status: account.status,
    createdAt: account.createdAt,
    lastActiveAt: account.lastActiveAt,
    invitationPending: account.passwordSetupPending,
    firstName: account.profile?.firstName ?? '',
    lastName: account.profile?.lastName ?? '',
    avatar: account.profile
      ? presentAvatar(account.id, account.profile)
      : { kind: 'DEFAULT' },
    authMethods: [
      ...(account.passwordHash ? ['password'] : []),
      ...(account.googleId ? ['google'] : []),
    ],
  };
}


@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly mail: AccountLinksService,
    private readonly config: RuntimeConfig,
  ) {}

  async list() {
    return (
      await this.prisma.user.findMany({
        select: accountFields,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      })
    ).map(presentAccount);
  }

  async detail(id: string) {
    const account = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...accountFields,
        accountTokens: {
          where: {
            purpose: 'EMAIL_CHANGE',
            expiresAt: { gt: new Date() },
            consumedAt: null,
            revokedAt: null,
          },
          select: { newEmail: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            comments: {
              where: { status: 'PUBLISHED', article: { status: 'PUBLISHED' } },
            },
          },
        },
      },
    });
    if (!account) throw new NotFoundException();
    const isLastAdmin =
      account.role === 'ADMIN' &&
      account.status === 'ACTIVE' &&
      !account.passwordSetupPending &&
      !(await this.prisma.user.count({
        where: { ...operationalAdmin, id: { not: id } },
      }));
    return {
      ...presentAccount(account),
      pendingEmail: account.accountTokens[0]?.newEmail ?? null,
      publicCommentCount: account._count.comments,
      isLastAdmin,
    };
  }

  async edit(actor: Principal, userId: string, dto: AdminProfileDto) {
    const token = await this.prisma.$transaction(async (tx) => {
      await this.authorize(tx, actor, userId, true);
      const account = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          email: true,
          passwordSetupPending: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      });
      const names = { firstName: dto.firstName, lastName: dto.lastName };
      if (
        account.profile?.firstName !== names.firstName ||
        account.profile?.lastName !== names.lastName
      ) {
        await tx.profile.upsert({
          where: { userId },
          create: { userId, ...names },
          update: names,
        });
        await this.log(
          tx,
          actor.userId,
          userId,
          'UPDATE',
          'Informations de profil modifiées.',
        );
      }
      return dto.email && dto.email !== account.email
        ? this.prepareEmailChange(tx, userId, account, dto.email, actor.userId)
        : null;
    });
    if (!token || !dto.email)
      return {
        emailConfirmationRequested: false,
        emailConfirmationSent: false,
      };
    try {
      await this.mail.send(dto.email, 'EMAIL_CHANGE', token);
      return { emailConfirmationRequested: true, emailConfirmationSent: true };
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) throw error;
      return { emailConfirmationRequested: true, emailConfirmationSent: false };
    }
  }

  async resetAvatar(actor: Principal, userId: string) {
    const path = await this.prisma.$transaction(async (tx) => {
      await this.authorize(tx, actor, userId, true);
      const profile = await tx.profile.findUniqueOrThrow({
        where: { userId },
        select: { avatarMediaId: true, avatarKind: true },
      });
      if (profile.avatarKind === 'DEFAULT' && !profile.avatarMediaId) return;
      await tx.profile.update({
        where: { userId },
        data: {
          avatarKind: 'DEFAULT',
          avatarPreset: null,
          avatarMediaId: null,
        },
      });
      await this.log(
        tx,
        actor.userId,
        userId,
        'UPDATE',
        'Avatar remplacé par l’avatar par défaut.',
      );
      return removeAvatarRecord(tx, profile.avatarMediaId);
    });
    await removeAvatarFile(this.config.avatarDirectory, path);
  }

  requestReset(email: string) {
    this.mail.assertConfigured();
    // Répondre avant toute recherche et tout envoi pour garder le même délai HTTP.
    void this.sendReset(email).catch(() =>
      this.logger.warn('Une demande de réinitialisation a échoué.'),
    );
  }

  private async sendReset(email: string) {
    const candidate = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!candidate) return;

    const token = await this.prisma.$transaction(async (tx) => {
      await lockUser(tx, candidate.id);
      const user = await tx.user.findUnique({ where: { id: candidate.id } });
      if (
        user?.email !== email ||
        user.status !== 'ACTIVE' ||
        user.passwordSetupPending ||
        !user.passwordHash
      )
        return;
      return this.issue(tx, user.id, 'PASSWORD_RESET');
    });
    if (token) await this.mail.send(email, 'PASSWORD_RESET', token);
  }

  async requestEmailChange(
    principal: Principal,
    userId: string,
    newEmail: string,
    admin = false,
  ) {
    this.mail.assertConfigured();
    const token = await this.prisma.$transaction(async (tx) => {
      await this.authorize(tx, principal, userId, admin);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.email === newEmail) return null;
      return this.prepareEmailChange(
        tx,
        userId,
        user,
        newEmail,
        admin ? principal.userId : undefined,
      );
    });
    if (token) await this.mail.send(newEmail, 'EMAIL_CHANGE', token);
  }

  private async prepareEmailChange(
    tx: Prisma.TransactionClient,
    userId: string,
    account: { passwordSetupPending: boolean },
    newEmail: string,
    adminId?: string,
  ) {
    this.mail.assertConfigured();
    if (
      account.passwordSetupPending ||
      (await tx.user.findUnique({
        where: { email: newEmail },
        select: { id: true },
      }))
    ) {
      throw new ConflictException();
    }
    const token = await this.issue(tx, userId, 'EMAIL_CHANGE', newEmail);
    if (adminId)
      await this.log(
        tx,
        adminId,
        userId,
        'UPDATE',
        'Confirmation d’un changement d’adresse demandée.',
      );
    return token;
  }

  async confirmEmail(token: string) {
    await this.consume('EMAIL_CHANGE', token, async (tx, accountToken) => {
      if (!accountToken.newEmail) throw new BadRequestException();
      await tx.user.update({
        where: { id: accountToken.userId },
        data: { email: accountToken.newEmail },
      });
      await tx.accountToken.updateMany({
        where: {
          userId: accountToken.userId,
          purpose: 'PASSWORD_RESET',
          consumedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      await this.notify(
        tx,
        accountToken.userId,
        'Votre adresse e-mail a été modifiée.',
      );
    });
  }

  async completePassword(
    purpose: 'INVITATION' | 'PASSWORD_RESET',
    dto: CompletePasswordDto,
  ) {
    if (dto.password !== dto.passwordConfirmation)
      throw new BadRequestException();
    await this.consume(purpose, dto.token, async (tx, token) => {
      if (token.user.passwordSetupPending !== (purpose === 'INVITATION'))
        throw new BadRequestException();
      await tx.user.update({
        where: { id: token.userId },
        data: {
          passwordHash: await hashPassword(dto.password),
          passwordSetupPending: false,
          failedLoginCount: 0,
          loginBlockedUntil: null,
        },
      });
      await this.sessions.revoke(tx, token.userId);
      await this.notify(tx, token.userId, 'Votre mot de passe a été défini.');
    });
  }

  async invite(principal: Principal | null, dto: InviteDto) {
    this.mail.assertConfigured();
    const { userId, token } = await this.prisma.$transaction(async (tx) => {
      if (principal) {
        await this.authorize(tx, principal, principal.userId, true);
      } else {
        // Le premier compte administrateur est créé par une commande locale explicite.
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(8476102)`;
        if (dto.role !== 'ADMIN') throw new ConflictException();
      }
      const existing = await tx.user.findUnique({
        where: { email: dto.email },
        select: { id: true },
      });
      if (existing) {
        await lockUser(tx, existing.id);
        const pending = await tx.user.findFirst({
          where: {
            id: existing.id,
            email: dto.email,
            role: dto.role,
            status: 'ACTIVE',
            passwordSetupPending: true,
          },
          select: { id: true },
        });
        if (!pending) throw new ConflictException();
        if (principal)
          await this.log(
            tx,
            principal.userId,
            pending.id,
            'UPDATE',
            'Lien d’invitation renouvelé.',
          );
        return {
          userId: pending.id,
          token: await this.issue(tx, pending.id, 'INVITATION'),
        };
      }
      if (!principal && (await tx.user.count({ where: { role: 'ADMIN' } })))
        throw new ConflictException();
      const user = await tx.user.create({
        data: {
          email: dto.email,
          role: dto.role,
          passwordSetupPending: true,
          profile: {
            create: { firstName: dto.firstName, lastName: dto.lastName },
          },
        },
        select: { id: true },
      });
      if (principal)
        await this.log(
          tx,
          principal.userId,
          user.id,
          'CREATE',
          'Compte créé sur invitation.',
        );
      return {
        userId: user.id,
        token: await this.issue(tx, user.id, 'INVITATION'),
      };
    });
    await this.mail.send(dto.email, 'INVITATION', token);
    return { id: userId };
  }

  async resendInvitation(principal: Principal, userId: string) {
    this.mail.assertConfigured();
    const { email, token } = await this.prisma.$transaction(async (tx) => {
      await this.authorize(tx, principal, userId, true);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (!user.passwordSetupPending || user.status !== 'ACTIVE') {
        throw new ConflictException();
      }
      await this.log(
        tx,
        principal.userId,
        userId,
        'UPDATE',
        'Lien d’invitation renouvelé.',
      );
      return {
        email: user.email,
        token: await this.issue(tx, userId, 'INVITATION'),
      };
    });
    await this.mail.send(email, 'INVITATION', token);
  }

  async changeStatus(
    actor: Principal,
    userId: string,
    { status }: ChangeStatusDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await this.serializeAdminChanges(tx);
      await this.authorize(tx, actor, userId, true);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.status === status) return;
      if (status === 'SUSPENDED') await this.protectLastAdmin(tx, user);
      await tx.user.update({ where: { id: userId }, data: { status } });
      if (status === 'SUSPENDED') await this.sessions.revoke(tx, userId);
      const suspended = status === 'SUSPENDED';
      const message = suspended ? 'Compte suspendu.' : 'Compte réactivé.';
      await this.notify(tx, userId, message);
      await this.log(
        tx,
        actor.userId,
        userId,
        suspended ? 'SUSPEND' : 'REACTIVATE',
        message,
      );
    });
  }

  async changeRole(
    actor: Principal,
    userId: string,
    { currentRole, role }: ChangeRoleDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await this.serializeAdminChanges(tx);
      await this.authorize(tx, actor, userId, true);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.role !== currentRole) throw new ConflictException();
      if (role === currentRole) return;
      if (role === 'USER') await this.protectLastAdmin(tx, user);
      await tx.user.update({ where: { id: userId }, data: { role } });
      await this.notify(tx, userId, 'Votre rôle a été modifié.');
      await this.log(
        tx,
        actor.userId,
        userId,
        'CHANGE_ROLE',
        `Rôle modifié (${currentRole} → ${role}).`,
      );
    });
  }

  async delete(actor: Principal, userId: string, admin = false) {
    const avatarPath = await this.prisma.$transaction(async (tx) => {
      await this.serializeAdminChanges(tx);
      await this.authorize(tx, actor, userId, admin);
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: { profile: { select: { avatarMediaId: true } } },
      });
      await this.protectLastAdmin(tx, user);
      await tx.activityLog.updateMany({
        where: { target: 'ACCOUNT', targetId: userId },
        data: { targetId: null },
      });
      if (admin)
        await this.log(tx, actor.userId, null, 'DELETE', 'Compte supprimé.');
      // Les FK préservent les discussions et effacent les identifiants ainsi que les sessions.
      await tx.user.delete({ where: { id: userId } });
      return removeAvatarRecord(tx, user.profile?.avatarMediaId);
    });
    await removeAvatarFile(this.config.avatarDirectory, avatarPath);
  }

  private async issue(
    tx: Prisma.TransactionClient,
    userId: string,
    purpose: AccountTokenPurpose,
    newEmail?: string,
  ) {
    const now = new Date();
    const token = opaqueToken();
    if (purpose === 'EMAIL_CHANGE') {
      await tx.accountToken.deleteMany({ where: { userId, purpose } });
    } else {
      await tx.accountToken.updateMany({
        where: { userId, purpose, revokedAt: null, consumedAt: null },
        data: { revokedAt: now },
      });
    }
    await tx.accountToken.create({
      data: {
        userId,
        purpose,
        tokenHash: tokenHash(token),
        newEmail,
        expiresAt: new Date(now.getTime() + accountLinkMinutes[purpose] * 60_000),
      },
    });
    return token;
  }

  private async consume<T>(
    purpose: AccountTokenPurpose,
    token: string,
    apply: (
      tx: Prisma.TransactionClient,
      record: Prisma.AccountTokenGetPayload<{ include: { user: true } }>,
    ) => Promise<T>,
  ) {
    const hash = tokenHash(token);
    const candidate = await this.prisma.accountToken.findUnique({
      where: { tokenHash: hash },
      select: { userId: true },
    });
    if (!candidate) throw new BadRequestException();
    return this.prisma.$transaction(
      async (tx) => {
        await lockUser(tx, candidate.userId);
        const current = await tx.accountToken.findUnique({
          where: { tokenHash: hash },
          include: { user: true },
        });
        const now = new Date();
        if (
          !current ||
          current.purpose !== purpose ||
          current.consumedAt ||
          current.revokedAt ||
          current.expiresAt <= now ||
          current.user.status !== 'ACTIVE'
        )
          throw new BadRequestException();

        await tx.accountToken.update({
          where: { id: current.id },
          data: { consumedAt: now },
        });
        const result = await apply(tx, current);
        if (purpose === 'EMAIL_CHANGE')
          await tx.accountToken.delete({ where: { id: current.id } });
        return result;
      },
      { timeout: 10_000 },
    );
  }

  private async authorize(
    tx: Prisma.TransactionClient,
    principal: Principal,
    targetId: string,
    admin: boolean,
  ) {
    if (!admin && targetId !== principal.userId) throw new ForbiddenException();
    for (const id of [...new Set([principal.userId, targetId])].sort())
      await lockUser(tx, id);
    const actor = await this.sessions.assertLive(
      tx,
      principal.userId,
      principal.sessionId,
    );
    if (admin && actor.role !== 'ADMIN') throw new ForbiddenException();
  }

  private async serializeAdminChanges(tx: Prisma.TransactionClient) {
    // Deux administrateurs peuvent agir sur leur propre compte au même moment.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(8476102)`;
  }

  private async protectLastAdmin(
    tx: Prisma.TransactionClient,
    user: {
      id: string;
      role: string;
      status: string;
      passwordSetupPending: boolean;
    },
  ) {
    if (
      user.role !== 'ADMIN' ||
      user.status !== 'ACTIVE' ||
      user.passwordSetupPending
    )
      return;
    const replacement = await tx.user.findFirst({
      where: {
        ...operationalAdmin,
        id: { not: user.id },
      },
      select: { id: true },
    });
    if (!replacement) throw new ConflictException();
  }

  private notify(
    tx: Prisma.TransactionClient,
    userId: string,
    message: string,
  ) {
    return tx.notification.create({
      data: { userId, type: 'ACCOUNT', title: 'Compte', message },
    });
  }

  private log(
    tx: Prisma.TransactionClient,
    userId: string,
    targetId: string | null,
    action: Prisma.ActivityLogUncheckedCreateInput['action'],
    description: string,
  ) {
    return tx.activityLog.create({
      data: { userId, action, target: 'ACCOUNT', targetId, description },
    });
  }
}
