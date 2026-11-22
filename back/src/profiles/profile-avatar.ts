import type { Profile } from '../../generated/prisma/client.js';

export const profileFields = {
  firstName: true,
  lastName: true,
  avatarKind: true,
  avatarPreset: true,
  googleAvatar: true,
} as const;

export function presentAvatar(
  userId: string,
  profile: Pick<Profile, 'avatarKind' | 'avatarPreset' | 'googleAvatar'>,
) {
  const kind = profile.avatarKind;
  if (kind === 'PERSONAL')
    return { kind, url: `/api/v1/profiles/${userId}/avatar` };
  if (kind === 'PRESET') return { kind, preset: Number(profile.avatarPreset) };
  if (kind === 'GOOGLE' && profile.googleAvatar)
    return { kind, url: profile.googleAvatar };
  return { kind: 'DEFAULT' };
}
