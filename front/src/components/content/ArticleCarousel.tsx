import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Newspaper, Pause, Play } from 'lucide-react'
import type { Article } from '../../types'
import { articleAuthorLabel, articleCoverMediaId, getMedia, publicBlocks } from '../../lib/selectors'
import { formatDate } from '../../lib/format'
import { mediaUrl } from '../../lib/assets'
import { Button, buttonClasses } from '../ui/form'

const REDUCTION_MOUVEMENT = '(prefers-reduced-motion: reduce)'

/** Carrousel d'articles mis en avant (§26) — accessibilité RGAA :
 *  contrôles explicites, pause possible, autoplay respecte
 *  prefers-reduced-motion, aria-roledescription */
export function ArticleCarousel({ articles }: { articles: Article[] }) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia(REDUCTION_MOUVEMENT).matches)
  const total = articles.length
  const rotation = playing && !reducedMotion && total > 1

  // Autoplay désactivé si l'utilisateur préfère réduire les animations
  useEffect(() => {
    const preference = window.matchMedia(REDUCTION_MOUVEMENT)
    const actualiser = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches)
      if (event.matches) setPlaying(false)
    }
    preference.addEventListener('change', actualiser)
    return () => preference.removeEventListener('change', actualiser)
  }, [])

  useEffect(() => {
    if (!rotation) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % total), 6000)
    return () => window.clearInterval(timer)
  }, [rotation, total])

  // Un article peut être retiré de la liste en cours de consultation.
  const indexActif = Math.min(index, total - 1)
  if (total === 0) return null

  const article = articles[indexActif]
  const cover = getMedia(articleCoverMediaId(article))
  const date = article.publishedAt ?? article.updatedAt
  const extrait = publicBlocks(article).find((b) => b.type === 'paragraphe' && b.text)?.text

  const changerArticle = (direction: -1 | 1) => {
    setPlaying(false)
    setIndex((indexActif + direction + total) % total)
  }

  // Pause automatique lorsque la région a le focus ou est survolée.
  return (
    <section
      aria-roledescription="carrousel"
      aria-label="Articles mis en avant"
      className="carte overflow-hidden"
      onMouseEnter={() => setPlaying(false)}
      onFocus={() => setPlaying(false)}
    >
      <div
        aria-live={rotation ? 'off' : 'polite'}
        aria-atomic="true"
        className="grid md:min-h-60 md:grid-cols-[1.15fr_1fr]"
      >
        <div className="relative h-44 overflow-hidden bg-leaf-pale sm:h-60 md:h-auto">
          {cover ? (
            <img src={mediaUrl(cover.file)} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
              <Newspaper className="h-14 w-14 text-forest/30" />
            </span>
          )}
        </div>
        <div className="min-w-0 self-center p-5 sm:p-7">
          <p className="text-sm text-mist">
            <time dateTime={date}>{formatDate(date)}</time>
            {' · '}
            {articleAuthorLabel(article)}
          </p>
          <h3 className="mt-2 text-xl leading-tight text-forest [overflow-wrap:anywhere] sm:text-2xl">
            {article.titre}
          </h3>
          {extrait ? <p className="mt-2 line-clamp-3 text-base text-mist [overflow-wrap:anywhere]">{extrait}</p> : null}
          <Link
            to={`/actualites/${article.slug}`}
            state={{ from: '/' }}
            className={`mt-4 ${buttonClasses('primaire', 'petit')}`}
          >
            Lire l’article
            <span className="sr-only"> : {article.titre}</span>
          </Link>
        </div>
      </div>

      {/* Contrôles du carrousel */}
      {total > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line bg-white px-3 py-2.5 sm:px-5">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondaire" size="petit" onClick={() => changerArticle(-1)}>
              <ChevronLeft aria-hidden="true" className="h-5 w-5" />
              <span className="sr-only sm:not-sr-only">Précédent</span>
            </Button>
            <Button variant="secondaire" size="petit" onClick={() => changerArticle(1)}>
              <span className="sr-only sm:not-sr-only">Suivant</span>
              <ChevronRight aria-hidden="true" className="h-5 w-5" />
            </Button>
            {!reducedMotion ? (
              <Button
                variant="secondaire"
                size="petit"
                onClick={() => setPlaying((actif) => !actif)}
                aria-label={rotation ? 'Pause du défilement' : 'Lecture automatique'}
              >
                {rotation ? <Pause aria-hidden="true" className="h-4 w-4" /> : <Play aria-hidden="true" className="h-4 w-4" />}
                {rotation ? 'Pause' : 'Lecture auto'}
              </Button>
            ) : null}
          </div>
          <ul className="flex gap-1" aria-label="Choisir l’article affiché">
            {articles.map((a, i) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false)
                    setIndex(i)
                  }}
                  aria-label={`Afficher l’article ${i + 1} sur ${total} : ${a.titre}`}
                  aria-current={i === indexActif ? 'true' : undefined}
                  className="grid h-8 w-8 place-items-center rounded-full text-forest hover:bg-leaf-pale"
                >
                  <span
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 rounded-full border border-forest ${i === indexActif ? 'bg-forest' : ''}`}
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
