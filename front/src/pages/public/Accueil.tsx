import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Newspaper, Search, Users } from 'lucide-react'
import { useDb } from '../../lib/db'
import { publishedArticles } from '../../lib/selectors'
import { ArticleCarousel } from '../../components/content/ArticleCarousel'
import { ArticleCard } from '../../components/content/ArticleCard'
import { getMedia } from '../../lib/selectors'
import { mediaUrl } from '../../lib/assets'
import { useFakeLoad, useScrollMemory } from '../../hooks/common'
import { Skeleton, SkeletonText } from '../../components/ui/feedback'

/** Page d'accueil (§26) : priorité aux actualités — bannière d'accueil
 *  équilibrée, articles mis en avant, 5 dernières actualités, présentation
 *  courte de l'association et accès à la recherche (intégrée à la page
 *  des actualités depuis la V3). */
export function Accueil() {
  const db = useDb()
  const chargement = useFakeLoad(450)
  useScrollMemory('accueil')
  const navigate = useNavigate()

  const articles = publishedArticles()
  const derniers = articles.slice(0, 5) // 5 derniers articles (§26)
  const aLaUne = articles.filter((a) => a.misEnAvant).slice(0, 3)
  const presentation = getMedia('m-village')

  const lancerRecherche = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
    navigate(q ? `/actualites?q=${encodeURIComponent(q)}` : '/actualites')
  }

  return (
    <div>
      {/* Bannière de bienvenue équilibrée (sans monopoliser l'écran) */}
      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 md:grid-cols-2 md:py-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-leaf-pale px-4 py-1.5 text-[0.9375rem] font-bold text-forest">
              <Users aria-hidden="true" className="h-4 w-4" />
              Association du village — Arches (Vosges)
            </p>
            <h1 className="mt-4">
              Toute la vie associative d'Arches, au même endroit
            </h1>
            <p className="mt-4 max-w-xl text-lg text-mist">
              Ateliers, culture, solidarité et événements : suivez les actualités du Foyer
              Rural, participez aux discussions et retrouvez toutes les informations du
              village, pour toutes les générations.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/actualites"
                className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-forest px-6 font-bold text-white shadow-sm transition-colors hover:bg-forest-dark"
              >
                <Newspaper aria-hidden="true" className="h-5 w-5" />
                Voir les actualités
              </Link>
              <Link
                to="/inscription"
                className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-forest bg-white px-6 font-bold text-forest transition-colors hover:bg-leaf-pale"
              >
                Créer mon compte
              </Link>
            </div>
          </div>
          {presentation ? (
            <img
              src={mediaUrl(presentation.file)}
              alt={presentation.alt}
              className="h-64 w-full rounded-2xl object-cover shadow-[var(--shadow-carte)] md:h-80"
            />
          ) : null}
        </div>
      </section>

      {/* Accès à la recherche (§26) */}
      <div className="bg-leaf-pale">
        <form
          role="search"
          aria-label="Recherche rapide d'articles"
          onSubmit={lancerRecherche}
          className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-5"
        >
          <label htmlFor="accueil-recherche" className="font-bold text-forest">
            Rechercher dans le site :
          </label>
          <div className="flex min-w-[240px] flex-1 gap-2">
            <input
              id="accueil-recherche"
              name="q"
              type="search"
              placeholder="Exemple : fête du village, chorale, atelier mémoire…"
              className="min-h-[48px] w-full rounded-xl border border-line bg-white px-4 text-bark placeholder:text-mist/70 focus:border-forest"
            />
            <button
              type="submit"
              className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-forest px-5 font-bold text-white hover:bg-forest-dark"
            >
              <Search aria-hidden="true" className="h-5 w-5" />
              <span className="sr-only sm:not-sr-only">Rechercher</span>
            </button>
          </div>
          <Link
            to="/actualites?avancee=1"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 font-bold text-forest underline decoration-2 underline-offset-4 hover:bg-white"
          >
            Recherche avancée
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </form>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12">
        {/* Zone d'articles mis en avant (§26) — carrousel contrôlable et pausable */}
        {aLaUne.length > 0 ? (
          <section aria-labelledby="titre-une" className="mb-14">
            <h2 id="titre-une" className="mb-4 text-2xl text-forest">
              À la une
            </h2>
            <ArticleCarousel articles={aLaUne} />
          </section>
        ) : null}

        {/* Les cinq dernières actualités (§26) */}
        <section aria-labelledby="titre-derniers" className="mb-14">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="titre-derniers" className="text-2xl text-forest">
              Les dernières actualités
            </h2>
            <Link
              to="/actualites"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg font-bold text-forest underline decoration-2 underline-offset-4 hover:bg-leaf-pale"
            >
              Toutes les actualités
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </Link>
          </div>
          {chargement ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3" aria-label="Chargement des articles">
              {[0, 1, 2].map((i) => (
                <div key={i} className="carte p-6">
                  <Skeleton className="h-40 w-full" />
                  <div className="mt-4">
                    <SkeletonText lines={3} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {derniers.map((a) => (
                <li key={a.id} className="h-full">
                  <ArticleCard article={a} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Présentation courte de l'association */}
        <section
          aria-labelledby="titre-presentation"
          className="grid items-center gap-8 rounded-2xl border border-line bg-white p-6 shadow-[var(--shadow-carte)] md:grid-cols-2 md:p-10"
        >
          <div>
            <h2 id="titre-presentation" className="text-2xl text-forest">
              Le Foyer Rural, c'est quoi ?
            </h2>
            <p className="mt-4">
              Depuis 1962, l'association fait vivre le village : plus de vingt ateliers
              hebdomadaires, une bibliothèque bénévole, quatre grands événements par an et
              des actions solidaires avec les écoles et la commune.
            </p>
            <p className="mt-3">
              Les adhérents disposent d'un espace personnel : participation aux discussions,
              notifications et gestion de leur profil.
            </p>
            <Link
              to="/association"
              className="mt-5 inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-forest bg-white px-6 font-bold text-forest hover:bg-leaf-pale"
            >
              Découvrir l'association
              <ArrowRight aria-hidden="true" className="h-5 w-5" />
            </Link>
          </div>
          <ul className="grid gap-3" aria-label="Points clés de l'association">
            {[
              { chiffre: '150', texte: 'adhérents cotisants' },
              { chiffre: '20+', texte: 'ateliers chaque semaine' },
              { chiffre: '4', texte: 'événements fédérateurs par an' },
              { chiffre: '6 000', texte: 'livres en bibliothèque' },
            ].map((k) => (
              <li
                key={k.texte}
                className="flex items-center gap-4 rounded-xl bg-sand px-5 py-4"
              >
                <span className="text-2xl font-bold text-forest">{k.chiffre}</span>
                <span className="text-[1.0625rem]">{k.texte}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
