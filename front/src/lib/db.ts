// ============================================================
// Store central de la maquette : données fictives + mutations.
// Simule le futur backend NestJS/Prisma sans implémenter de
// véritable authentification ni de base de données.
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
import { articlesSeed, initA3Draft, newBlockId } from '../data/articles'
import { associationSeed } from '../data/divers'
import { categoriesSeed, tagsSeed } from '../data/categories'
import { commentsSeed } from '../data/comments'
import { logsSeed, messagesSeed, notificationsSeed, statsSeed } from '../data/divers'
import { mediasSeed } from '../data/medias'
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

initA3Draft()

/** Grain de données « vierge » : les seeds, après initialisation de la version
 *  en préparation de l'article a3. Sert au premier chargement et à la
 *  réinitialisation des données de démonstration. */
function freshDatabase(): Database {
  return {
    users: clone(usersSeed),
    categories: clone(categoriesSeed),
    tags: clone(tagsSeed),
    articles: clone(articlesSeed),
    comments: clone(commentsSeed),
    medias: clone(mediasSeed),
    messages: clone(messagesSeed),
    notifications: clone(notificationsSeed),
    logs: clone(logsSeed),
    association: clone(associationSeed),
    stats: clone(statsSeed),
  }
}

// ------------------------------------------------------------
// Persistance de la démonstration : les modifications de la maquette
// survivent au rechargement de la page (brief §10). Les fichiers importés
// en session (blob:/data:) ne sont pas persistés — quota de stockage.
// ------------------------------------------------------------
const STORAGE_KEY = 'projetassos_demo_v2'

function isPersistentMedia(m: Media): boolean {
  return !(m.file.startsWith('blob:') || m.file.startsWith('data:'))
}

function loadPersisted(): Database | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Database
    // Validation minimale de la forme : toute incohérence → données vierges
    if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.articles) || !parsed.association) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function persist(): void {
  try {
    const snapshot: Database = { ...db, medias: db.medias.filter(isPersistentMedia) }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    /* quota dépassé ou stockage indisponible : la maquette reste utilisable
       en mémoire, les données de session (images importées) ne sont pas
       conservées après rechargement */
  }
}

export const db: Database = loadPersisted() ?? freshDatabase()

// ------------------------------------------------------------
// Réactivité
// ------------------------------------------------------------
let version = 0
const listeners = new Set<() => void>()
function emit() {
  version += 1
  persist()
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

/** Réinitialisation des données de démonstration (brief §10) : toutes les
 *  modifications effectuées dans la maquette sont perdues, les seeds
 *  d'origine sont rétablis et la session est fermée. */
export function resetDemoData(): void {
  const fresh = freshDatabase()
  db.users = fresh.users
  db.categories = fresh.categories
  db.tags = fresh.tags
  db.articles = fresh.articles
  db.comments = fresh.comments
  db.medias = fresh.medias
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

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
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
// Articles (§17 à §22)
// ------------------------------------------------------------
function nextArticleSlug(titre: string): string {
  const base = slugify(titre) || 'article'
  let slug = base
  let n = 2
  while (db.articles.some((a) => a.slug === slug)) {
    slug = `${base}-${n++}`
  }
  return slug
}

export function createArticle(
  auteurId: string,
  data: Partial<Pick<Article, 'titre' | 'blocks' | 'categorieIds' | 'tagIds' | 'coverMediaId'>>,
): Article {
  const a: Article = {
    id: uid('a'),
    slug: nextArticleSlug(data.titre || 'nouvel-article'),
    titre: data.titre || 'Article sans titre',
    statut: 'brouillon',
    auteurId,
    createdAt: now(),
    publishedAt: null,
    programmeAt: null,
    updatedAt: now(),
    coverMediaId: data.coverMediaId ?? null,
    categorieIds: data.categorieIds ?? [],
    tagIds: data.tagIds ?? [],
    blocks: data.blocks ?? [{ id: newBlockId(), type: 'paragraphe', text: '' }],
    publicSnapshot: null,
    misEnAvant: false,
    viewCount: 0,
  }
  db.articles.unshift(a)
  emit()
  return a
}

export function updateArticle(
  id: string,
  patch: Partial<Pick<Article, 'titre' | 'blocks' | 'categorieIds' | 'tagIds' | 'coverMediaId' | 'misEnAvant'>>,
): void {
  const a = db.articles.find((x) => x.id === id)
  if (!a) return
  Object.assign(a, patch)
  a.updatedAt = now()
  emit()
}

/** Publication immédiate (§20) */
export function publishNow(id: string, adminId: string): void {
  const a = db.articles.find((x) => x.id === id)
  if (!a) return
  const etaitProgramme = a.statut === 'programme'
  a.statut = 'publie'
  a.publishedAt = a.publishedAt ?? now()
  a.programmeAt = null
  a.updatedAt = now()
  logAction(adminId, 'article', etaitProgramme ? 'Publication anticipée d\'un article programmé' : 'Publication immédiate', a.titre)
  emit()
}

/** Programmation d'une publication (§20) */
export function programArticle(id: string, isoDate: string, adminId: string): void {
  const a = db.articles.find((x) => x.id === id)
  if (!a) return
  a.statut = 'programme'
  a.programmeAt = isoDate
  a.updatedAt = now()
  logAction(adminId, 'article', 'Programmation d\'un article', a.titre)
  emit()
}

/** Annulation d'une programmation : retour en Brouillon (§20) */
export function cancelProgramming(id: string, adminId: string): void {
  const a = db.articles.find((x) => x.id === id)
  if (!a) return
  a.statut = 'brouillon'
  a.programmeAt = null
  a.updatedAt = now()
  logAction(adminId, 'article', 'Annulation d\'une programmation', a.titre)
  emit()
}

/** Retrait de la publication d'un article publié (§20) */
export function unpublish(id: string, adminId: string): void {
  const a = db.articles.find((x) => x.id === id)
  if (!a) return
  a.statut = 'brouillon'
  a.publishedAt = null
  a.updatedAt = now()
  logAction(adminId, 'article', 'Retrait de la publication', a.titre)
  emit()
}

/** Début de modification d'un article publié : la version publiée reste
 *  visible, les modifications sont préparées en brouillon (§20) */
export function startEditPublished(id: string): void {
  const a = db.articles.find((x) => x.id === id)
  if (!a || a.statut !== 'publie' || a.publicSnapshot) return
  a.publicSnapshot = clone(a.blocks)
  emit()
}

export function cancelEditPublished(id: string): void {
  const a = db.articles.find((x) => x.id === id)
  if (!a || !a.publicSnapshot) return
  a.blocks = a.publicSnapshot
  a.publicSnapshot = null
  emit()
}

/** Validation de la nouvelle version d'un article publié (§20) */
export function validatePublishedEdit(id: string, adminId: string): void {
  const a = db.articles.find((x) => x.id === id)
  if (!a || !a.publicSnapshot) return
  a.publicSnapshot = null
  a.updatedAt = now()
  logAction(adminId, 'article', 'Validation de la nouvelle version d\'un article publié', a.titre)
  emit()
}

/** Mise à la corbeille (§21). Un article programmé y passe après
 *  confirmation et sa programmation est annulée. */
export function trashArticle(id: string, adminId: string): void {
  const a = db.articles.find((x) => x.id === id)
  if (!a) return
  const etaitProgramme = a.statut === 'programme'
  a.statut = 'corbeille'
  a.programmeAt = null
  a.updatedAt = now()
  logAction(adminId, 'article', etaitProgramme ? 'Mise à la corbeille d\'un article programmé' : 'Mise à la corbeille', a.titre)
  emit()
}

/** Restauration depuis la corbeille : choix entre Brouillon et Publié (§21) */
export function restoreArticle(id: string, target: 'brouillon' | 'publie', adminId: string): void {
  const a = db.articles.find((x) => x.id === id)
  if (!a) return
  a.statut = target === 'publie' ? 'publie' : 'brouillon'
  a.publishedAt = target === 'publie' ? now() : null
  a.programmeAt = null
  a.updatedAt = now()
  logAction(adminId, 'article', `Restauration depuis la corbeille (cible : ${target === 'publie' ? 'Publié' : 'Brouillon'})`, a.titre)
  emit()
}

/** Suppression définitive : les commentaires associés sont supprimés (§21) */
export function deleteArticleForever(id: string, adminId: string): void {
  const a = db.articles.find((x) => x.id === id)
  if (!a) return
  db.articles = db.articles.filter((x) => x.id !== id)
  db.comments = db.comments.filter((c) => c.articleId !== id)
  logAction(adminId, 'article', 'Suppression définitive', a.titre, 'Les commentaires associés ont été supprimés.')
  emit()
}

// ------------------------------------------------------------
// Catégories et tags (§23)
// ------------------------------------------------------------
export function createCategory(nom: string): Category {
  const c: Category = { id: uid('c'), nom: nom.trim(), slug: slugify(nom) }
  db.categories.push(c)
  emit()
  return c
}
export function updateCategory(id: string, nom: string): void {
  const c = db.categories.find((x) => x.id === id)
  if (!c) return
  c.nom = nom.trim()
  c.slug = slugify(nom)
  emit()
}
export function deleteCategory(id: string): void {
  db.categories = db.categories.filter((x) => x.id !== id)
  db.articles.forEach((a) => {
    a.categorieIds = a.categorieIds.filter((cid) => cid !== id)
  })
  emit()
}
export function createTag(nom: string): Tag {
  const t: Tag = { id: uid('t'), nom: nom.trim(), slug: slugify(nom) }
  db.tags.push(t)
  emit()
  return t
}
export function updateTag(id: string, nom: string): void {
  const t = db.tags.find((x) => x.id === id)
  if (!t) return
  t.nom = nom.trim()
  t.slug = slugify(nom)
  emit()
}
export function deleteTag(id: string): void {
  db.tags = db.tags.filter((x) => x.id !== id)
  db.articles.forEach((a) => {
    a.tagIds = a.tagIds.filter((tid) => tid !== id)
  })
  emit()
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
// Médiathèque (§36)
// ------------------------------------------------------------
export interface MediaUsage {
  articles: string[]
  avatars: number
  association: boolean
}

export function mediaUsage(mediaId: string): MediaUsage {
  const usage: MediaUsage = { articles: [], avatars: 0, association: false }
  const blocksUse = (blocks: Block[] | null | undefined): boolean =>
    (blocks ?? []).some((bl) => bl.mediaId === mediaId)
  db.articles.forEach((a) => {
    if (
      a.coverMediaId === mediaId ||
      blocksUse(a.blocks) ||
      blocksUse(a.publicSnapshot)
    ) {
      usage.articles.push(a.titre)
    }
  })
  usage.avatars = db.users.filter((u) => u.avatar.type === 'image' && u.avatar.mediaId === mediaId).length
  usage.association = blocksUse(db.association.blocks)
  return usage
}

export function isMediaUsed(mediaId: string): boolean {
  const u = mediaUsage(mediaId)
  return u.articles.length > 0 || u.avatars > 0 || u.association
}

export function addMedia(data: Omit<Media, 'id' | 'createdAt'>): Media {
  const m: Media = { id: uid('m'), ...data, createdAt: now() }
  db.medias.unshift(m)
  emit()
  return m
}

export function updateMedia(id: string, patch: Partial<Pick<Media, 'nom' | 'alt'>>): void {
  const m = db.medias.find((x) => x.id === id)
  if (!m) return
  Object.assign(m, patch)
  emit()
}

/** Remplacement du fichier d'un média : l'identifiant est conservé, tous
 *  les contenus qui utilisent l'image sont mis à jour (§36) */
export function replaceMediaFile(id: string, nouveauFichier: string): void {
  const m = db.medias.find((x) => x.id === id)
  if (!m) return
  m.file = nouveauFichier
  emit()
}

export function deleteMedia(id: string): void {
  if (isMediaUsed(id)) return // la suppression d'un média utilisé est bloquée (§36)
  db.medias = db.medias.filter((x) => x.id !== id)
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
