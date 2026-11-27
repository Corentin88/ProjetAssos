import type { PublicNameFormat } from '../types'

export function publicNameOptions(firstName: string, lastName: string): Record<PublicNameFormat, string> {
  const initial = Array.from(lastName.trim())[0]
  return {
    FULL: [firstName, lastName].filter(Boolean).join(' '),
    INITIAL: initial ? `${firstName} ${initial}.` : firstName,
    ADMIN: 'Admin',
  }
}
