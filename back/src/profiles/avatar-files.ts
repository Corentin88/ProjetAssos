import { Logger } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Prisma } from '../../generated/prisma/client.js';

const logger = new Logger('AvatarFiles');
const avatarPathPattern = /^avatars\/([a-f0-9-]{36}\.webp)$/;

export function avatarPath(id: string) {
  return `avatars/${id}.webp`;
}

export async function writeAvatarFile(
  directory: string,
  path: string,
  image: Buffer,
) {
  const match = path.match(avatarPathPattern);
  if (!match) throw new Error('Nom de fichier d’avatar invalide.');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(join(directory, match[1]), image, {
    flag: 'wx',
    mode: 0o600,
  });
}

export async function readAvatarFile(directory: string, path: string) {
  const match = path.match(avatarPathPattern);
  if (!match) return undefined;
  return readFile(join(directory, match[1]));
}

export async function removeAvatarRecord(
  tx: Prisma.TransactionClient,
  id?: string | null,
) {
  if (!id) return undefined;
  const result = await tx.media.deleteMany({
    where: { id, path: avatarPath(id), profiles: { none: {} } },
  });
  return result.count ? avatarPath(id) : undefined;
}

export async function removeAvatarFile(directory: string, path?: string) {
  const match = path?.match(avatarPathPattern);
  if (!match) return;
  try {
    await unlink(join(directory, match[1]));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      logger.warn('Un ancien fichier d’avatar doit être purgé.');
  }
}
