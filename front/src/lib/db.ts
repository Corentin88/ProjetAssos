// ============================================================
// Contenus reçus de l’API et données locales des modules encore en maquette.
// ============================================================
import { useSyncExternalStore } from 'react'
import type {
  ActivityLogEntry,
  Article,
  AssociationPage,
  Block,
  Category,
  Comment,
  ContactMessage,
  LogActionType,
  Media,
  StatsData,
  Tag,
  User,
  UserNotification,
} from '../types'
import { newBlockId } from '../data/articles'
import { associationSeed } from '../data/divers'
import { commentsSeed } from '../data/comments'
import { logsSeed, messagesSeed, notificationsSeed, statsSeed } from '../data/divers'
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
  logs: ActivityLogEntry[]
  association: AssociationPage
  stats: StatsData
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

export type ContentSnapshot = Pick<Database, 'articles' | 'categories' | 'tags' | 'medias'>
const emptyContent = (): ContentSnapshot => ({ articles: [], categories: [], tags: [], medias: [] })
export const publicContent = emptyContent()
let adminContent: ContentSnapshot | null = null
export const contentStatus = { public: 'loading', admin: 'loading' } as Record<'public' | 'admin', 'loading' | 'ready' | 'error'>

function freshDatabase(): Database {
  return {
    ...emptyContent(),
    users: clone(usersSeed),
    comments: clone(commentsSeed),
    messages: clone(messagesSeed),
    notifications: clone(notificationsSeed),
    logs: clone(logsSeed),
    association: clone(associationSeed),
    stats: clone(statsSeed),
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
    return { ...parsed, ...emptyContent() }
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
  contentStatus[scope] = data ? 'ready' : 'loading'
  Object.assign(db, adminContent ?? publicContent)
  emit(false)
}

export function setContentError(scope: 'public' | 'admin') {
  if (contentStatus[scope] === 'ready') return
  contentStatus[scope] = 'error'
  emit(false)
}

/** Réinitialisation des données de démonstration (brief §10) : toutes les
 *  modifications effectuées dans la maquette sont perdues, les seeds
 *  d'origine sont rétablis et la session est fermée. */
export function resetDemoData(): void {
  const fresh = freshDatabase()
  db.users = fresh.users
  db.comments = fresh.comments
  db.messages = fresh.messages
  db.notifications = fresh.notifications
  db.logs = fresh.logs
  db.association = fresh.association
  db.stats = fresh.stats
  emit()
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

export function fullName(u: User | null | undefined): string {
  if (!u) return 'Utilisateur supprimé'
  return `${u.prenom} ${u.nom}`.trim()
}

export function initials(u: User): string {
  return `${u.prenom.charAt(0)}${u.nom.charAt(0)}`.toUpperCase()
}

// ------------------------------------------------------------
// Journal d'activité administrateur (§41)
// ------------------------------------------------------------
export function logAction(
  adminId: string,
  type: LogActionType,
  action: string,
  cible: string,
  details?: string,
): void {
  db.logs.unshift({ id: uid('l'), at: now(), adminId, type, action, cible, details })
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
export function moderateComment(id: string, motif: string, precision: string | null, adminId: string): void {
  const c = db.comments.find((x) => x.id === id)
  if (!c) return
  c.moderation = {
    motif,
    precision: motif === 'Autre' && precision ? precision : undefined,
    at: now(),
    adminId,
    contenuSupprime: c.contenu,
  }
  c.contenu = '[contenu supprimé]'
  if (c.auteurId) {
    const article = db.articles.find((a) => a.id === c.articleId)
    notify(
      c.auteurId,
      'moderation',
      'Commentaire supprimé par la modération',
      `Votre commentaire sur « ${article?.titre ?? 'un article'} » a été supprimé par un administrateur. Motif : ${motif}${precision ? ` — ${precision}` : ''}.`,
    )
  }
  logAction(adminId, 'commentaire', `Suppression d'un commentaire (motif : ${motif})`, `Commentaire de ${c.auteurLabel}`, `Article : ${db.articles.find((a) => a.id === c.articleId)?.titre ?? ''}`)
  emit()
}

export function adminEditComment(id: string, contenu: string, adminId: string): void {
  const c = db.comments.find((x) => x.id === id)
  if (!c) return
  c.history.push({ contenu: c.contenu, at: c.updatedAt ?? c.createdAt })
  c.contenu = contenu.trim()
  c.updatedAt = now()
  logAction(adminId, 'commentaire', 'Modification d\'un commentaire', `Commentaire de ${c.auteurLabel}`)
  emit()
}

// ------------------------------------------------------------
// Utilisateurs — administration (§3.1, §10, §11, §12, §38)
// ------------------------------------------------------------
export function adminCount(): number {
  return db.users.filter((u) => u.role === 'administrateur').length
}

export function createUser(
  adminId: string,
  data: { prenom: string; nom: string; email: string; role: 'utilisateur' | 'administrateur' },
): { ok: true } | { ok: false; error: string } {
  const exists = db.users.some((x) => x.email.toLowerCase() === data.email.trim().toLowerCase())
  if (exists) return { ok: false, error: 'Un compte existe déjà avec cette adresse e-mail.' }
  const u: User = {
    id: uid('u'),
    prenom: data.prenom.trim(),
    nom: data.nom.trim(),
    email: data.email.trim(),
    role: data.role,
    statut: 'actif',
    avatar: { type: 'defaut' },
    // §3.1 : l'administrateur ne définit jamais le mot de passe — le compte
    // n'a aucune méthode de connexion tant que l'utilisateur n'a pas défini
    // son mot de passe via le lien temporaire reçu par courriel.
    authMethods: [],
    createdAt: now(),
    lastActivityAt: now(),
  }
  db.users.push(u)
  logAction(adminId, 'compte', 'Création d\'un compte', fullName(u), 'Un courriel avec un lien temporaire de définition du mot de passe a été envoyé à l\'utilisateur.')
  emit()
  return { ok: true }
}

export function updateUserByAdmin(
  adminId: string,
  id: string,
  patch: Partial<Pick<User, 'prenom' | 'nom' | 'email'>>,
): void {
  const u = db.users.find((x) => x.id === id)
  if (!u) return
  Object.assign(u, patch)
  logAction(adminId, 'compte', 'Modification d\'un compte', fullName(u))
  emit()
}

export function changeRole(adminId: string, id: string, newRole: 'utilisateur' | 'administrateur'): { ok: true } | { ok: false; error: string } {
  const u = db.users.find((x) => x.id === id)
  if (!u) return { ok: false, error: 'Compte introuvable.' }
  if (u.role === newRole) return { ok: true }
  if (u.role === 'administrateur' && newRole === 'utilisateur' && adminCount() <= 1) {
    return { ok: false, error: 'Le dernier administrateur ne peut pas être rétrogradé : il doit toujours exister au moins un administrateur.' }
  }
  const ancien = u.role
  u.role = newRole
  notify(id, 'compte', 'Votre rôle a été modifié', `Votre rôle est désormais : ${newRole === 'administrateur' ? 'Administrateur' : 'Utilisateur'}.`)
  logAction(adminId, 'compte', 'Changement de rôle', fullName(u), `Ancien rôle : ${ancien === 'administrateur' ? 'Administrateur' : 'Utilisateur'} — nouveau rôle : ${newRole === 'administrateur' ? 'Administrateur' : 'Utilisateur'}`)
  emit()
  return { ok: true }
}

export function suspendUser(adminId: string, id: string): void {
  const u = db.users.find((x) => x.id === id)
  if (!u) return
  u.statut = 'suspendu'
  notify(id, 'compte', 'Compte suspendu', 'Votre compte a été suspendu par un administrateur. Vous ne pouvez plus vous connecter ni commenter ; les contenus publics du site restent accessibles en lecture.')
  logAction(adminId, 'compte', 'Suspension d\'un compte', fullName(u))
  emit()
}

export function reactivateUser(adminId: string, id: string): void {
  const u = db.users.find((x) => x.id === id)
  if (!u) return
  u.statut = 'actif'
  notify(id, 'compte', 'Compte réactivé', 'Votre compte a été réactivé. Vous pouvez de nouveau vous connecter et participer aux discussions.')
  logAction(adminId, 'compte', 'Réactivation d\'un compte', fullName(u))
  emit()
}

export function deleteUserByAdmin(adminId: string, id: string): { ok: true } | { ok: false; error: string } {
  const u = db.users.find((x) => x.id === id)
  if (!u) return { ok: false, error: 'Compte introuvable.' }
  if (u.role === 'administrateur' && adminCount() <= 1) {
    return { ok: false, error: 'Le dernier administrateur ne peut pas supprimer son compte : il doit toujours exister au moins un administrateur.' }
  }
  db.comments.forEach((c) => {
    if (c.auteurId === id) {
      c.auteurId = null
      c.auteurLabel = 'Utilisateur supprimé'
    }
  })
  db.notifications = db.notifications.filter((n) => n.userId !== id)
  db.users = db.users.filter((x) => x.id !== id)
  logAction(adminId, 'compte', 'Suppression d\'un compte', fullName(u), 'Les commentaires de l\'utilisateur sont conservés avec la mention « Utilisateur supprimé ».')
  emit()
  return { ok: true }
}

/** Retrait ou remplacement de l'avatar par l'avatar par défaut (§13.2) */
export function resetUserAvatar(adminId: string, id: string): void {
  const u = db.users.find((x) => x.id === id)
  if (!u) return
  u.avatar = { type: 'defaut' }
  logAction(adminId, 'compte', 'Réinitialisation de l\'avatar', fullName(u), 'Avatar remplacé par l\'avatar par défaut du site.')
  emit()
}

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
export function replyToMessage(id: string, adminId: string): void {
  const m = db.messages.find((x) => x.id === id)
  if (!m) return
  m.lu = true
  m.repliedAt = now()
  logAction(adminId, 'message', 'Réponse à un message de contact', `${m.prenom} ${m.nom} — ${m.sujet}`, 'Réponse transmise par courriel au demandeur.')
  emit()
}
export function deleteMessage(id: string, adminId: string): void {
  const m = db.messages.find((x) => x.id === id)
  if (!m) return
  db.messages = db.messages.filter((x) => x.id !== id)
  logAction(adminId, 'message', 'Suppression d\'un message de contact', `${m.prenom} ${m.nom} — ${m.sujet}`)
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

// ------------------------------------------------------------
// Page « L'association » (§32 à §34)
// ------------------------------------------------------------
export function saveAssociation(blocks: Block[], coordonnees: AssociationPage['coordonnees'], adminId: string): void {
  db.association.blocks = blocks
  db.association.coordonnees = coordonnees
  db.association.updatedAt = now()
  logAction(adminId, 'association', 'Modification de la page « L\'association »', 'Contenu et coordonnées')
  emit()
}

// ------------------------------------------------------------
// Journal — suppression manuelle d'une entrée (§41) :
// la suppression est elle-même inscrite dans le journal
// ------------------------------------------------------------
export function deleteLogEntry(id: string, adminId: string): void {
  const entry = db.logs.find((x) => x.id === id)
  if (!entry) return
  db.logs = db.logs.filter((x) => x.id !== id)
  logAction(
    adminId,
    'journal',
    'Suppression manuelle d\'une entrée du journal',
    `${entry.action} — ${entry.cible}`,
  )
  emit()
}

export type { Block }
