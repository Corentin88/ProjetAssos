import { randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { lockUser, SessionService } from '../auth/session.service.js';
import type { Principal } from '../auth/session.service.js';

export function contentSlug(label: string) {
  const slug = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180);
  return (slug || 'contenu') + '-' + randomUUID();
}

export async function lockAdmin(
  tx: Prisma.TransactionClient,
  sessions: SessionService,
  actor: Principal,
) {
  await lockUser(tx, actor.userId);
  if (
    (await sessions.assertLive(tx, actor.userId, actor.sessionId)).role !==
    'ADMIN'
  ) {
    throw new ForbiddenException();
  }
}

export function contentLog(
  tx: Prisma.TransactionClient,
  userId: string | null,
  target: Prisma.ActivityLogUncheckedCreateInput['target'],
  targetId: string | null,
  action: Prisma.ActivityLogUncheckedCreateInput['action'],
  description: string,
) {
  return tx.activityLog.create({
    data: { userId, target, targetId, action, description },
  });
}
