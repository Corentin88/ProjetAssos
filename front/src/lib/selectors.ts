import type { Article, Block, Comment, Media, User } from '../types'
import { mediasSeed } from '../data/medias'
import { articlesSeed } from '../data/articles'
import { db, publicContent, recalledMedia } from './db'

// ------------------------------------------------------------
// Sélecteurs de lecture (helpers réutilisables)
// ------------------------------------------------------------

/** Articles visibles publiquement (publiés uniquement) */
export function publishedArticles(): Article[] {
  return publicContent.articles
    .filter((a) => a.statut === 'publie')
    .sort((a, b) => (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt))
}

export function getArticleById(id: string): Article | undefined {
  return db.articles.find((a) => a.id === id) ?? articlesSeed.find((a) => a.id === id)
}

export function getArticleBySlug(slug: string): Article | undefined {
  return publicContent.articles.find((a) => a.slug === slug)
}

/** Version actuellement visible publiquement d'un article (§20) */
export function publicBlocks(article: Article): Block[] {
  return article.publicSnapshot ?? article.blocks
}

export function getCategory(id: string) {
  return db.categories.find((c) => c.id === id)
}
export function getTag(id: string) {
  return db.tags.find((t) => t.id === id)
}
export function getMedia(id: string | null | undefined): Media | undefined {
  if (!id) return undefined
  return publicContent.medias.find((m) => m.id === id)
    ?? db.medias.find((m) => m.id === id)
    ?? recalledMedia(id)
    ?? mediasSeed.find((m) => m.id === id)
}

/** Visuel d'un article : couverture choisie > première image de l'article >
 *  visuel par défaut (§22) */
export function articleCoverMediaId(article: Article): string | null {
  return article.coverMediaId ?? firstArticleImage(publicBlocks(article)) ?? getMedia('m-visuel-defaut')?.id ?? null
}

export function firstArticleImage(blocks: Block[]) {
  for (const block of blocks) {
    if (block.type === 'image' && block.mediaId) return block.mediaId
    if (block.type === 'carrousel' && block.slides?.length) return block.slides[0].mediaId
  }
}

export function articleExcerpt(blocks: Block[]) {
  return blocks.find(block => block.type === 'paragraphe' && block.text)?.text?.slice(0, 220) ?? ''
}

export function getUser(id: string | null | undefined): User | undefined {
  if (!id) return undefined
  return db.users.find((u) => u.id === id)
}

/** Auteur d'un article en libellé lisible */
export function articleAuthorLabel(article: Article): string {
  if (article.auteurLabel) return article.auteurLabel
  const u = getUser(article.auteurId)
  return u ? `${u.prenom} ${u.nom}` : 'Utilisateur supprimé'
}

export function authorLabel(comment: Comment): string {
  if (comment.auteurId) {
    const u = getUser(comment.auteurId)
    if (u) return `${u.prenom} ${u.nom}`
    return comment.auteurLabel
  }
  return comment.auteurLabel || 'Utilisateur supprimé'
}

/** Commentaires visibles publiquement d'un article (§28) */
export function visibleComments(articleId: string): Comment[] {
  return db.comments.filter(
    (c) => c.articleId === articleId && !c.deletedByAuthor && !c.moderation,
  )
}

/** Threads : commentaires de premier niveau + leurs réponses.
 *  Les commentaires supprimés (par l'auteur ou par modération) restent
 *  matérialisés par le placeholder « Commentaire supprimé » et leurs
 *  réponses visibles sont conservées (§30, §31). */
export function commentThreads(articleId: string): { comment: Comment; replies: Comment[] }[] {
  const discussion = db.comments
    .filter((c) => c.articleId === articleId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return discussion.filter((c) => c.parentId === null).map((comment) => ({
    comment,
    replies: discussion.filter((c) => c.parentId === comment.id),
  }))
}

/** Nombre de commentaires publics publiés par un utilisateur (§14) */
export function userPublicCommentCount(userId: string): number {
  return userPublicComments(userId).length
}

/** Commentaires publics d'un utilisateur, du plus récent au plus ancien (§15) */
export function userPublicComments(userId: string): Comment[] {
  // Un commentaire sort du profil dès que l'article quitte les actualités publiques.
  const articlesPublics = new Set(publishedArticles().map((article) => article.id))
  return db.comments
    .filter((c) => c.auteurId === userId && !c.deletedByAuthor && !c.moderation && articlesPublics.has(c.articleId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** « Mes commentaires » : exclut les supprimés par l'auteur (§30) */
export function myComments(userId: string): Comment[] {
  return db.comments
    .filter((c) => c.auteurId === userId && !c.deletedByAuthor)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// ----- Recherche et filtres des articles (§24) -----
export interface ArticleQuery {
  q?: string
  annee?: string
  categorieId?: string
  tagId?: string
  tri?: 'date' | 'titre' | 'auteur'
  ordre?: 'croissant' | 'decroissant'
}

function articleText(a: Article): string {
  return [
    a.titre,
    publicBlocks(a).flatMap((b) => [
      b.text, ...(b.items ?? []), b.trail?.name, b.trail?.description,
      b.location?.title, b.location?.address, b.location?.description,
    ]).join(' '),
    articleAuthorLabel(a),
    a.categorieIds.map((id) => getCategory(id)?.nom ?? '').join(' '),
    a.tagIds.map((id) => getTag(id)?.nom ?? '').join(' '),
  ]
    .join(' ')
    .toLowerCase()
}

export function searchArticles(query: ArticleQuery): Article[] {
  let list = publishedArticles()
  if (query.q && query.q.trim()) {
    const q = query.q.trim().toLowerCase()
    list = list.filter((a) => articleText(a).includes(q))
  }
  if (query.annee) {
    list = list.filter((a) => String(new Date(a.publishedAt ?? a.updatedAt).getFullYear()) === query.annee)
  }
  if (query.categorieId) {
    list = list.filter((a) => a.categorieIds.includes(query.categorieId!))
  }
  if (query.tagId) {
    list = list.filter((a) => a.tagIds.includes(query.tagId!))
  }
  const tri = query.tri ?? 'date'
  const ordre = query.ordre ?? 'decroissant'
  const dir = ordre === 'croissant' ? 1 : -1
  list = [...list].sort((a, b) => {
    if (tri === 'titre') return dir * a.titre.localeCompare(b.titre, 'fr')
    if (tri === 'auteur') {
      const na = (a.auteurNom ?? getUser(a.auteurId)?.nom ?? '').toLowerCase()
      const nb = (b.auteurNom ?? getUser(b.auteurId)?.nom ?? '').toLowerCase()
      return dir * na.localeCompare(nb, 'fr')
    }
    return dir * (a.publishedAt ?? a.updatedAt).localeCompare(b.publishedAt ?? b.updatedAt)
  })
  return list
}

export function publishedYears(): string[] {
  return [...new Set(publishedArticles().map((a) => String(new Date(a.publishedAt ?? a.updatedAt).getFullYear())))].sort((a, b) => Number(b) - Number(a))
}

// ----- notifications -----
export function unreadNotificationCount(userId: string): number {
  return db.notifications.filter((n) => n.userId === userId && !n.lue).length
}

export function userNotifications(userId: string): UserNotificationLike[] {
  return db.notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => b.at.localeCompare(a.at))
}
export interface UserNotificationLike {
  id: string
  type: string
  titre: string
  texte: string
  at: string
  lue: boolean
  link?: string
}

// ----- utilisateurs : dernier admin -----
export function isLastActiveAdmin(userId: string): boolean {
  const u = getUser(userId)
  if (!u || u.role !== 'administrateur') return false
  return db.users.filter((x) => x.role === 'administrateur').length <= 1
}
