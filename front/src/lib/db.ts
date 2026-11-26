// ============================================================
// Contenus reçus de l’API et données locales des modules encore en maquette.
// ============================================================
import { useSyncExternalStore } from 'react'
import type {
  Article,
  AssociationPage,
  Block,
  Category,
  Comment,
  ContactMessage,
  Media,
  Tag,
  User,
  UserNotification,
} from '../types'
import { newBlockId } from '../data/articles'
import { associationSeed } from '../data/divers'
import { commentsSeed } from '../data/comments'
import { messagesSeed, notificationsSeed } from '../data/divers'
import { usersSeed } from '../data/users'

export const MOTIFS_MODERATION = [
  'Spam',
  'Insulte / comportement inapproprié',
  'Contenu hors sujet',
  'Contenu illégal',
  'Autre',
] as const

export interface Database {
  users: User[]
  categories: Category[]
  tags: Tag[]
  articles: Article[]
  comments: Comment[]
  medias: Media[]
  messages: ContactMessage[]
  notifications: UserNotification[]
  association: AssociationPage
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

export type ContentSnapshot = Pick<Database, 'articles' | 'categories' | 'tags' | 'medias'>
const emptyContent = (): ContentSnapshot => ({ articles: [], categories: [], tags: [], medias: [] })
export const publicContent = emptyContent()
let adminContent: ContentSnapshot | null = null
const selectedMedia = new Map<string, Media>()

export function rememberMedia(media: Media) {
  selectedMedia.set(media.id, media)
}

export function recalledMedia(id: string) {
  return selectedMedia.get(id)
}
export const contentStatus = { public: 'loading', admin: 'loading' } as Record<'public' | 'admin', 'loading' | 'ready' | 'error'>

function freshDatabase(): Database {
  return {
    ...emptyContent(),
    users: clone(usersSeed),
    comments: clone(commentsSeed),
    messages: clone(messagesSeed),
    notifications: clone(notificationsSeed),
    association: clone(associationSeed),
  }
}

// ------------------------------------------------------------
// Seules les données des modules encore en maquette sont conservées localement.
// ------------------------------------------------------------
const STORAGE_KEY = 'projetassos_demo_v2'

function loadPersisted(): Database | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Database
    // Validation minimale de la forme : toute incohérence → données vierges
    if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.articles) || !parsed.association) {
      return null
    }
    const { users, comments, messages, notifications, association } = parsed
    return { ...emptyContent(), users, comments, messages, notifications, association }
  } catch {
    return null
  }
}

function persist(): void {
  try {
    const snapshot: Database = { ...db, ...emptyContent() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Si le stockage est indisponible, la maquette reste utilisable en mémoire.
  }
}

export const db: Database = loadPersisted() ?? freshDatabase()

// ------------------------------------------------------------
// Réactivité
// ------------------------------------------------------------
let version = 0
const listeners = new Set<() => void>()
function emit(save = true) {
  version += 1
  if (save) persist()
  listeners.forEach((l) => l())
}
function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
export function useDb(): Database {
  useSyncExternalStore(subscribe, () => version)
  return db
}

/** Version du grain de données : change à chaque mutation. À utiliser en
 *  dépendance des useMemo qui lisent db (les tableaux sont mutés en place,
 *  leur référence ne change donc pas forcément). */
export function useDbVersion(): number {
  useSyncExternalStore(subscribe, () => version)
  return version
}

export function setContent(scope: 'public' | 'admin', data?: ContentSnapshot) {
  if (scope === 'admin') adminContent = data ?? null
  else if (data) Object.assign(publicContent, data)
  if (scope === 'admin' && !data) selectedMedia.clear()
  contentStatus[scope] = data ? 'ready' : 'loading'
  Object.assign(db, adminContent ?? publicContent)
  emit(false)
}

export function setContentError(scope: 'public' | 'admin') {
  if (contentStatus[scope] === 'ready') return
  contentStatus[scope] = 'error'
  emit(false)
}

export function anonymizeDemoComments(userId: string) {
  const comments = db.comments.filter(comment => comment.auteurId === userId)
  if (!comments.length) return
  for (const comment of comments) {
    comment.auteurId = null
    comment.auteurLabel = 'Utilisateur supprimé'
  }
  emit()
}

// ------------------------------------------------------------
// Utilitaires
// ------------------------------------------------------------
export function now(): string {
  return new Date().toISOString()
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function fullName(u: Pick<User, 'prenom' | 'nom'> | null | undefined): string {
  if (!u) return 'Utilisateur supprimé'
  return `${u.prenom} ${u.nom}`.trim()
}

export function initials(u: User): string {
  return `${u.prenom.charAt(0)}${u.nom.charAt(0)}`.toUpperCase()
}

// ------------------------------------------------------------
// Notifications internes (§16) — jamais de courriel systématique
// ------------------------------------------------------------
export function notify(
  userId: string,
  type: UserNotification['type'],
  titre: string,
  texte: string,
  link?: string,
): void {
  db.notifications.unshift({ id: uid('n'), userId, type, titre, texte, at: now(), lue: false, link })
}

// ------------------------------------------------------------
// Commentaires (§28 à §31)
// ------------------------------------------------------------
export function addComment(
  articleId: string,
  auteurId: string,
  contenu: string,
  parentId: string | null,
  auteurLabel: string,
): Comment {
  const c: Comment = {
    id: uid('c'),
    articleId,
    auteurId,
    auteurLabel,
    contenu: contenu.trim(),
    createdAt: now(),
    updatedAt: null,
    parentId,
    deletedByAuthor: false,
    moderation: null,
    history: [],
  }
  db.comments.push(c)
  // Notification « réponse à un commentaire » (§16) : le parent doit être
  // un commentaire de premier niveau (un seul niveau de réponse, §28)
  if (parentId) {
    const parent = db.comments.find((x) => x.id === parentId)
    if (parent && parent.auteurId && parent.auteurId !== auteurId) {
      const article = db.articles.find((a) => a.id === articleId)
      notify(
        parent.auteurId,
        'interaction',
        'Réponse à votre commentaire',
        `${auteurLabel} a répondu à votre commentaire sur « ${article?.titre ?? 'un article'} ».`,
        `/actualites/${article?.slug ?? ''}#commentaire-${parentId}`,
      )
    }
  }
  emit()
  return c
}

export function editComment(id: string, contenu: string): void {
  const c = db.comments.find((x) => x.id === id)
  if (!c) return
  c.history.push({ contenu: c.contenu, at: c.updatedAt ?? c.createdAt })
  c.contenu = contenu.trim()
  c.updatedAt = now()
  emit()
}

/** Suppression par l'auteur : placeholder « Commentaire supprimé »,
 *  réponses conservées (§30) */
export function deleteCommentByAuthor(id: string): void {
  const c = db.comments.find((x) => x.id === id)
  if (!c) return
  c.deletedByAuthor = true
  c.contenu = '[contenu supprimé]'
  c.updatedAt = null
  emit()
}

/** Suppression par un administrateur : motif obligatoire (§31) */
// ------------------------------------------------------------
// Messages de contact (§35)
// ------------------------------------------------------------
export function addContactMessage(m: { prenom: string; nom: string; email: string; sujet: string; message: string }): void {
  db.messages.unshift({ id: uid('msg'), ...m, at: now(), lu: false, repliedAt: null })
  emit()
}
export function markMessage(id: string, lu: boolean): void {
  const m = db.messages.find((x) => x.id === id)
  if (!m) return
  m.lu = lu
  emit()
}
// ------------------------------------------------------------
// Notifications — gestion par l'utilisateur (§16)
// ------------------------------------------------------------
export function markNotificationRead(id: string): void {
  const n = db.notifications.find((x) => x.id === id)
  if (!n) return
  n.lue = true
  emit()
}
export function markAllNotificationsRead(userId: string): void {
  db.notifications.forEach((n) => {
    if (n.userId === userId) n.lue = true
  })
  emit()
}
export function deleteNotification(id: string): void {
  db.notifications = db.notifications.filter((x) => x.id !== id)
  emit()
}
export function deleteAllNotifications(userId: string): void {
  db.notifications = db.notifications.filter((n) => n.userId !== userId)
  emit()
}

export type { Block }
