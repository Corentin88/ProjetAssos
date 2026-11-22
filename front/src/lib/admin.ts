import type { ApiAvatar, User } from '../types'
import { ApiError, mapAvatar, authErrorMessage } from './auth'
import { useResource } from './community'

export const actionLabels = {
  CREATE: 'Création', UPDATE: 'Modification', DELETE: 'Suppression', SUSPEND: 'Suspension',
  REACTIVATE: 'Réactivation', CHANGE_ROLE: 'Changement de rôle', PUBLISH: 'Publication',
  SCHEDULE: 'Programmation', CANCEL_SCHEDULE: 'Annulation de programmation', TRASH: 'Mise à la corbeille',
  RESTORE: 'Restauration', UNPUBLISH: 'Retrait de publication',
} as const

export const targetLabels = {
  ACCOUNT: 'Compte', ARTICLE: 'Article', CATEGORY: 'Catégorie', TAG: 'Tag', COMMENT: 'Commentaire',
  MEDIA: 'Média', ASSOCIATION: 'Page Association', CONTACT_MESSAGE: 'Message de contact', ACTIVITY_LOG: 'Entrée du journal',
} as const

export interface JournalEntry {
  id: string
  action: keyof typeof actionLabels
  target: keyof typeof targetLabels
  actorId: string | null
  actorLabel: string | null
  targetId: string | null
  targetLabel: string | null
  description: string
  at: string
}

export interface JournalResult {
  entries: JournalEntry[]
  actors: { id: string; label: string }[]
  hasNext: boolean
}

interface AdminOverview {
  accounts: { ADMIN: number; USER: number }
  articles: { DRAFT: number; PUBLISHED: number; SCHEDULED: number; TRASHED: number }
  suspended: number
  comments: number
  unreadMessages: number
  media: number
  scheduled: { id: string; scheduledAt: string; title: string }[]
  recent: JournalEntry[]
}

export function useAdminOverview() {
  return useResource<AdminOverview>('/admin/overview', true)
}

export function journalTarget(entry: JournalEntry) {
  return entry.targetLabel || [targetLabels[entry.target], entry.targetId].filter(Boolean).join(' · ')
}

export function journalActor(entry: JournalEntry) {
  return entry.actorLabel ?? 'Action automatique ou compte supprimé'
}

export interface AdminAccount {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'USER' | 'ADMIN'
  status: 'ACTIVE' | 'SUSPENDED'
  createdAt: string
  lastActiveAt: string | null
  invitationPending: boolean
  authMethods: ('password' | 'google')[]
  avatar: ApiAvatar
  pendingEmail?: string | null
  publicCommentCount?: number
  isLastAdmin?: boolean
}

export function accountDisplay(account: AdminAccount): Pick<User, 'id' | 'prenom' | 'nom' | 'email' | 'role' | 'statut' | 'avatar' | 'authMethods' | 'createdAt'> & {
  lastActivityAt: string | null; invitationPending: boolean; pendingEmail?: string | null; publicCommentCount?: number; isLastAdmin?: boolean
} {
  return {
    id: account.id, prenom: account.firstName, nom: account.lastName, email: account.email,
    role: account.role === 'ADMIN' ? 'administrateur' : 'utilisateur',
    statut: account.status === 'ACTIVE' ? 'actif' : 'suspendu',
    avatar: mapAvatar(account.avatar), createdAt: account.createdAt, lastActivityAt: account.lastActiveAt,
    authMethods: account.authMethods.map(method => method === 'google' ? 'google' : 'motdepasse'),
    invitationPending: account.invitationPending, pendingEmail: account.pendingEmail,
    publicCommentCount: account.publicCommentCount, isLastAdmin: account.isLastAdmin,
  }
}

export function adminError(error: unknown) {
  return error instanceof ApiError && error.status === 503
    ? 'Courriel indisponible. Vérifiez la configuration SMTP.'
    : authErrorMessage(error)
}
