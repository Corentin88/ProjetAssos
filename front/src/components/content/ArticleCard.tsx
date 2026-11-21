import { Link, useLocation } from 'react-router-dom'
import { CalendarDays, Newspaper, User } from 'lucide-react'
import type { Article, Tag as TagType } from '../../types'
import { articleAuthorLabel, articleCoverMediaId, getCategory, getMedia, getTag, publicBlocks } from '../../lib/selectors'
import { formatDate } from '../../lib/format'
import { mediaUrl } from '../../lib/assets'
import { Badge } from '../ui/feedback'
import type { BadgeVariant } from '../ui/feedback'

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

function extrait(article: Article): string {
  const blocks = publicBlocks(article)
  const p = blocks.find((b) => b.type === 'paragraphe' && b.text)
  return p?.text?.slice(0, 220) ?? ''
}

/** Carte d'article moderne et compacte (§25) :
 *  - image de couverture en haut, badge de catégorie superposé en haut à gauche ;
 *  - tags superposés en bas de l'image (3 maximum puis « +N ») sur un voile
 *    sombre garantissant le contraste, même sur une photographie claire ;
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

  /** Depuis la liste des actualités, on mémorise l'URL de la liste (critères,
   *  tri, pagination) dans l'état de navigation : le lien « Retour à la
   *  liste » de l'article la réutilisera (§25). */
  const location = useLocation()
  const depuisListe = location.pathname === '/actualites'
  const retourListe = depuisListe ? `${location.pathname}${location.search}` : undefined

  return (
    <article className="carte carte-hover group flex h-full flex-col overflow-hidden">
      {/* Zone visuelle standardisée : image + badges superposés (§22, §25) */}
      <div className="relative h-48 w-full shrink-0 overflow-hidden bg-forest-dark">
        <Link
          to={lienArticle}
          state={retourListe ? { from: retourListe } : undefined}
          className="absolute inset-0 block overflow-hidden"
          tabIndex={-1}
          aria-hidden="true"
        >
          {cover ? (
            <img
              src={mediaUrl(cover.file)}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              loading="lazy"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-forest to-forest-dark">
              <Newspaper aria-hidden="true" className="h-14 w-14 text-white/20" />
            </span>
          )}
        </Link>

        {/* Voile de lisibilité en bas de l'image pour les tags */}
        {tags.length > 0 ? (
          <span
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bark/75 via-bark/35 to-transparent"
            aria-hidden="true"
          />
        ) : null}

        {/* Badge de catégorie, haut à gauche, toujours lisible */}
        {categorie ? (
          <Link
            to={`/actualites?cat=${categorie.id}`}
            className="absolute left-3 top-3 z-10 inline-flex max-w-[calc(100%-1.5rem)] items-center rounded-full bg-white/95 px-3 py-1 text-[0.8125rem] font-bold text-forest shadow-sm hover:bg-white"
          >
            <span className="truncate">{categorie.nom}</span>
            <span className="sr-only"> — filtrer les actualités par cette catégorie</span>
          </Link>
        ) : null}

        {/* Tags superposés en bas de l'image, cliquables */}
        {tags.length > 0 ? (
          <ul
            className="absolute inset-x-3 bottom-2.5 z-10 flex flex-wrap gap-1.5"
            aria-label="Tags de l'article"
          >
            {tagsVisibles.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/actualites?tag=${t.id}`}
                  className="inline-flex items-center rounded-full bg-bark/65 px-2.5 py-0.5 text-[0.75rem] font-bold text-white backdrop-blur-sm hover:bg-bark/85"
                >
                  #{t.nom}
                  <span className="sr-only"> — filtrer par ce tag</span>
                </Link>
              </li>
            ))}
            {tagsRestants > 0 ? (
              <li>
                <span
                  className="inline-flex items-center rounded-full bg-bark/65 px-2.5 py-0.5 text-[0.75rem] font-bold text-white/90 backdrop-blur-sm"
                  title={tags.slice(MAX_TAGS_CARTE).map((t) => `#${t.nom}`).join(', ')}
                >
                  +{tagsRestants}
                </span>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
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
            state={retourListe ? { from: retourListe } : undefined}
            className="rounded-md text-bark underline-offset-4 hover:text-forest hover:underline"
          >
            {article.titre}
          </Link>
        </h3>
        <p className="flex-1 text-[0.9375rem] leading-relaxed text-bark/90 line-clamp-3">
          {extrait(article)}
        </p>
        <p className="mt-1">
          <Link
            to={lienArticle}
            state={retourListe ? { from: retourListe } : undefined}
            className="inline-flex min-h-[44px] items-center rounded-lg font-bold text-forest underline decoration-2 underline-offset-4 hover:bg-leaf-pale"
          >
            Lire l'article
            <span className="sr-only"> : {article.titre}</span>
          </Link>
        </p>
      </div>
    </article>
  )
}
