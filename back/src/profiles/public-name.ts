import type { PublicNameFormat } from '../../generated/prisma/client.js';

export function formatPublicName(
  profile: { firstName: string; lastName: string } | null | undefined,
  format: PublicNameFormat,
) {
  if (!profile) return 'Utilisateur supprimé';
  if (format === 'ADMIN') return 'Admin';
  if (format === 'FULL') return `${profile.firstName} ${profile.lastName}`;
  const initial = Array.from(profile.lastName.trim())[0];
  return initial ? `${profile.firstName} ${initial}.` : profile.firstName;
}
