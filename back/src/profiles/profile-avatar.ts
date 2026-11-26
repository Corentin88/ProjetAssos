import type { Profile } from '../../generated/prisma/client.js';

export const profileFields = {
  firstName: true,
  lastName: true,
  avatarKind: true,
  avatarPreset: true,
  avatarMediaId: true,
  googleAvatar: true,
} as const;

export function presentAvatar(
  userId: string,
  profile: Pick<
    Profile,
    'avatarKind' | 'avatarPreset' | 'avatarMediaId' | 'googleAvatar'
  >,
) {
  const kind = profile.avatarKind;
  if (kind === 'PERSONAL' && profile.avatarMediaId)
    return {
      kind,
      url: `/api/v1/profiles/${userId}/avatar?v=${profile.avatarMediaId}`,
    };
  if (kind === 'PRESET') return { kind, preset: Number(profile.avatarPreset) };
  if (kind === 'GOOGLE' && profile.googleAvatar)
    return { kind, url: profile.googleAvatar };
  return { kind: 'DEFAULT' };
}
