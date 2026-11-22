import type { Article } from '../types'

export const CAPACITE_CARROUSEL = 3

export function articlesSelectionnes(articles: Article[]) {
  return articles
    .filter(article => article.statut === 'publie' && article.positionCarrousel != null)
    .sort((a, b) => a.positionCarrousel! - b.positionCarrousel!)
}

export function articlesDuCarrousel(articles: Article[]) {
  const recents = articles
    .filter(article => article.statut === 'publie')
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') || a.id.localeCompare(b.id))
  const uniques = new Map<string, Article>()
  for (const article of [...articlesSelectionnes(articles), ...recents]) {
    if (!uniques.has(article.id)) uniques.set(article.id, article)
    if (uniques.size === CAPACITE_CARROUSEL) break
  }
  return [...uniques.values()]
}
