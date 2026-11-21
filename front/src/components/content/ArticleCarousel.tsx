import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import type { Article } from '../../types'
import { articleAuthorLabel, articleCoverMediaId, getMedia, publicBlocks } from '../../lib/selectors'
import { formatDate } from '../../lib/format'
import { mediaUrl } from '../../lib/assets'

/** Carrousel d'articles mis en avant (§26) — accessibilité RGAA :
 *  contrôles explicites, pause possible, autoplay respecte
 *  prefers-reduced-motion, aria-roledescription */
export function ArticleCarousel({ articles }: { articles: Article[] }) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const regionRef = useRef<HTMLDivElement>(null)

  // Autoplay désactivé si l'utilisateur préfère réduire les animations
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (!playing || reducedMotion) return
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % articles.length)
    }, 6000)
    return () => clearInterval(t)
  }, [playing, reducedMotion, articles.length])

  const go = useCallback(
    (dir: 1 | -1) => setIndex((i) => (i + dir + articles.length) % articles.length),
    [articles.length],
  )

  // Pause automatique lorsque la région a le focus ou est survolée
  useEffect(() => {
    const el = regionRef.current
    if (!el) return
    const stop = () => setPlaying(false)
    el.addEventListener('mouseenter', stop)
    el.addEventListener('focusin', stop)
    return () => {
      el.removeEventListener('mouseenter', stop)
      el.removeEventListener('focusin', stop)
    }
  }, [])

  if (articles.length === 0) return null
  const current = articles[index]
  const coverId = articleCoverMediaId(current)
  const cover = getMedia(coverId)
  const extrait =
    publicBlocks(current).find((b) => b.type === 'paragraphe' && b.text)?.text?.slice(0, 220) ?? ''

  return (
    <section
      ref={regionRef}
      aria-roledescription="carrousel"
      aria-label="Articles mis en avant"
      className="carte overflow-hidden"
    >
      <div className="relative">
        {cover ? (
          <img src={mediaUrl(cover.file)} alt="" className="h-72 w-full object-cover md:h-96" />
        ) : (
          <div className="h-72 w-full bg-leaf-pale md:h-96" aria-hidden="true" />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bark/95 via-bark/70 to-transparent p-6 pt-16 text-white">
          <p className="text-[0.875rem] font-bold uppercase tracking-wide text-white/85">
            À la une
          </p>
          <p className="mt-1 text-xl font-bold leading-snug md:text-2xl">{current.titre}</p>
          <p className="mt-1 text-[0.9375rem] text-white/85">
            Par {articleAuthorLabel(current)} — {formatDate(current.publishedAt ?? current.updatedAt)}
          </p>
          {extrait ? <p className="mt-2 hidden max-w-2xl text-white/90 md:block">{extrait}…</p> : null}
          <Link
            to={`/actualites/${current.slug}`}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-xl bg-white px-4 font-bold text-forest hover:bg-sand"
          >
            Lire l'article
            <span className="sr-only"> : {current.titre}</span>
          </Link>
        </div>
      </div>

      {/* Contrôles du carrousel */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white px-4 py-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-line bg-white px-4 font-bold text-forest hover:bg-leaf-pale"
          >
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            Précédent
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-line bg-white px-4 font-bold text-forest hover:bg-leaf-pale"
          >
            Suivant
            <ChevronRight aria-hidden="true" className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-line bg-white px-4 font-bold text-forest hover:bg-leaf-pale"
          >
            {playing ? (
              <>
                <Pause aria-hidden="true" className="h-5 w-5" />
                Mettre en pause
              </>
            ) : (
              <>
                <Play aria-hidden="true" className="h-5 w-5" />
                Lancer le défilement automatique
              </>
            )}
          </button>
        </div>
        <ul className="flex gap-2" aria-label="Choisir l'article affiché">
          {articles.map((a, i) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Afficher l'article ${i + 1} sur ${articles.length} : ${a.titre}`}
                aria-current={i === index}
                className={`inline-block h-5 w-5 rounded-full border ${
                  i === index ? 'border-forest bg-forest' : 'border-line bg-white'
                }`}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
