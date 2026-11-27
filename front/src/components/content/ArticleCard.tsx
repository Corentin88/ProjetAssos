import { Link, useLocation, useMatch } from 'react-router-dom'
import { CalendarDays, Newspaper, User } from 'lucide-react'
import type { Article, Tag as TagType } from '../../types'
import { articleAuthorLabel, articleCoverMediaId, articleExcerpt, getCategory, getMedia, getTag, publicBlocks } from '../../lib/selectors'
import { formatDate } from '../../lib/format'
import { mediaUrl } from '../../lib/assets'
import { normaliserParametresArticles } from '../../lib/articleSearchParams'
import { Badge } from '../ui/feedback'
import type { BadgeVariant } from '../ui/feedback'
import { articleCategoryLink } from './ArticleCategories'
import { CategoryVisualMark } from './CategoryVisualMark'

/** Nombre de tags affichés directement sur la carte ; au-delà, un « +N »
 *  évite de masquer la photographie (brief §2 : traitement élégant) */
const MAX_TAGS_CARTE = 3

/** Badges de statut d'un article (§20) — statut jamais porté par la couleur seule :
 *  un libellé texte explicite accompagne toujours la pastille */
export function ArticleStatutBadge({ statut }: { statut: Article['statut'] }) {
  const map: Record<Article['statut'], { label: string; variant: BadgeVariant }> = {
    brouillon: { label: 'Brouillon', variant: 'gris' },
    programme: { label: 'Programmé', variant: 'ocre' },
    publie: { label: 'Publié', variant: 'vert' },
    corbeille: { label: 'Corbeille', variant: 'rouge' },
  }
  const { label, variant } = map[statut]
  return <Badge variant={variant}>{label}</Badge>
}

/** Carte d'article moderne et compacte (§25) :
 *  - image de couverture en haut, badge de catégorie superposé en haut à gauche ;
 *  - tags superposés en bas de l'image (3 maximum puis « +N ») sur une seule
 *    ligne, avec un fond opaque pour rester lisibles sur chaque photographie ;
 *  - titre, date, auteur et extrait sous l'image — catégories et tags ne sont
 *    pas répétés sous l'image ;
 *  - les badges sont cliquables et appliquent le filtre correspondant ;
 *  - articles sans image : visuel de remplacement sobre aux couleurs du site. */
export function ArticleCard({ article }: { article: Article }) {
  const coverId = articleCoverMediaId(article)
  const cover = getMedia(coverId)
  const categorie = article.categorieIds[0] ? getCategory(article.categorieIds[0]) : undefined
  const tags = article.tagIds
    .map((tid): TagType | undefined => getTag(tid))
    .filter((t): t is TagType => Boolean(t))
  const tagsVisibles = tags.slice(0, MAX_TAGS_CARTE)
  const tagsRestants = tags.length - tagsVisibles.length
  const lienArticle = `/actualites/${article.slug}`

  /** Le détail mémorise la page d'origine, y compris les critères de la liste (§25). */
  const location = useLocation()
  const depuisListe = Boolean(useMatch('/actualites'))
  const origine = depuisListe || location.pathname === '/' ? `${location.pathname}${location.search}` : undefined
  const navigationArticle = origine ? { from: origine } : undefined

  const filtres = new URLSearchParams(depuisListe ? location.search : '')
  const lienTag = (id: string) => {
    const params = normaliserParametresArticles(filtres)
    params.set('tag', id)
    params.delete('page')
    params.set('avancee', '1')
    return `/actualites?${params}`
  }

  return (
    <article className="carte-hover h-full min-w-0">
      <div className="carte carte-article-surface relative isolate flex h-full min-w-0 flex-col overflow-hidden">
        {/* Zone visuelle standardisée : image + badges superposés (§22, §25) */}
        <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-forest-dark">
          {cover ? (
            <img
              src={mediaUrl(cover.file)}
              alt=""
              className={`h-full w-full ${cover.fromPdf ? 'bg-sand object-contain' : 'carte-article-image object-cover'}`}
              loading="lazy"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-forest to-forest-dark">
              <Newspaper aria-hidden="true" className="h-14 w-14 text-white/20" />
            </span>
          )}

          {/* Badge de catégorie, haut à gauche, toujours lisible */}
          {categorie ? (
            <Link
              to={articleCategoryLink(categorie.id, filtres)}
              className="carte-article-badge absolute left-3 top-3 z-10 inline-flex min-h-8 max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full bg-white px-3 text-sm font-bold text-forest shadow-sm hover:bg-leaf-pale hover:underline"
              title={categorie.nom}
            >
              <CategoryVisualMark visual={categorie.visual} size="h-4 w-4" />
              <span className="truncate">{categorie.nom}</span>
              <span className="sr-only"> — filtrer les actualités par cette catégorie</span>
            </Link>
          ) : null}

          {/* Tags superposés en bas de l'image, cliquables */}
          {tags.length > 0 ? (
            <ul
              className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex items-center gap-1.5"
              aria-label="Tags de l'article"
            >
              {tagsVisibles.map((t) => (
                <li key={t.id} className="min-w-0">
                  <Link
                    to={lienTag(t.id)}
                    className="carte-article-badge pointer-events-auto flex min-h-8 items-center rounded-full bg-bark px-2.5 text-xs font-bold text-white hover:bg-forest-dark hover:underline"
                    title={`#${t.nom}`}
                  >
                    <span className="truncate">#{t.nom}</span>
                    <span className="sr-only"> — filtrer par ce tag</span>
                  </Link>
                </li>
              ))}
              {tagsRestants > 0 ? (
                <li className="pointer-events-auto shrink-0">
                  <span
                    className="inline-flex min-h-8 items-center rounded-full bg-bark px-2.5 text-xs font-bold text-white"
                    title={tags.slice(MAX_TAGS_CARTE).map((t) => `#${t.nom}`).join(', ')}
                  >
                    <span aria-hidden="true">+{tagsRestants}</span>
                    <span className="sr-only">
                      {tagsRestants} {tagsRestants === 1 ? 'tag supplémentaire' : 'tags supplémentaires'}
                    </span>
                  </span>
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4 [overflow-wrap:anywhere] sm:p-5">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-mist">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="h-4 w-4" />
              <time dateTime={article.publishedAt ?? article.updatedAt}>
                {formatDate(article.publishedAt ?? article.updatedAt)}
              </time>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <User aria-hidden="true" className="h-4 w-4" />
              {articleAuthorLabel(article)}
            </span>
          </p>
          <h3 className="text-lg leading-snug sm:text-xl">
            <Link
              to={lienArticle}
              state={navigationArticle}
              className="carte-article-lien rounded-md text-bark underline-offset-4 hover:text-forest hover:underline"
            >
              {article.titre}
            </Link>
          </h3>
          <p className="line-clamp-3 text-[0.9375rem] leading-relaxed text-bark/90">
            {articleExcerpt(publicBlocks(article))}
          </p>
          <p className="mt-auto pt-1">
            <span
              aria-hidden="true"
              className="inline-flex min-h-[44px] items-center rounded-lg font-bold text-forest underline decoration-2 underline-offset-4"
            >
              Lire l'article
            </span>
          </p>
        </div>
      </div>
    </article>
  )
}
