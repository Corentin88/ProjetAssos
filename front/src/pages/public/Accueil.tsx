import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Newspaper, Search, SlidersHorizontal } from 'lucide-react'
import { currentUser, useDb } from '../../lib/db'
import { getMedia, publishedArticles } from '../../lib/selectors'
import { ArticleCarousel } from '../../components/content/ArticleCarousel'
import { ArticleCard } from '../../components/content/ArticleCard'
import { Button, Input, buttonClasses } from '../../components/ui/form'
import { EmptyState } from '../../components/ui/feedback'
import { mediaUrl } from '../../lib/assets'
import { useScrollMemory } from '../../hooks/common'

/** Page d'accueil (§26) : priorité aux actualités — bannière d'accueil
 *  équilibrée, articles mis en avant, 5 dernières actualités, présentation
 *  courte de l'association et accès à la recherche (intégrée à la page
 *  des actualités depuis la V3). */
export function Accueil() {
  useDb()
  useScrollMemory('accueil')
  const navigate = useNavigate()
  const utilisateur = currentUser()

  const articles = publishedArticles()
  const derniers = articles.slice(0, 5) // 5 derniers articles (§26)
  const aLaUne = articles.filter((a) => a.misEnAvant).slice(0, 3)
  const presentation = getMedia('m-village')

  const lancerRecherche = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = String(new FormData(e.currentTarget).get('q') ?? '').trim()
    navigate(q ? `/actualites?q=${encodeURIComponent(q)}` : '/actualites')
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-5 sm:space-y-10 sm:py-8">
      <div className="space-y-4">
        {/* Bannière de bienvenue équilibrée (sans monopoliser l'écran) */}
        <section
          aria-labelledby="titre-accueil"
          className={`overflow-hidden rounded-2xl bg-forest-dark text-white ${presentation ? 'md:grid md:grid-cols-[1.1fr_1fr]' : ''}`}
        >
          <div className="focus-inverse px-5 py-4 sm:p-8 lg:px-10">
            <h1 id="titre-accueil" className="text-[1.75rem] leading-tight sm:text-4xl lg:text-[2.625rem]">
              Foyer Rural d’Arches
            </h1>
            <p className="mt-3 max-w-lg text-base text-white/90 sm:text-lg">
              Ateliers, culture et solidarité font vivre le village. Retrouvez les événements
              et les nouvelles de l’association.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 sm:mt-5">
              <Link to="/actualites" className={buttonClasses('blanc', 'petit')}>
                <Newspaper aria-hidden="true" className="h-5 w-5" />
                Voir les actualités
              </Link>
              {!utilisateur ? (
                <Link
                  to="/inscription"
                  className="inline-flex min-h-11 items-center rounded-lg text-base font-bold text-white underline underline-offset-4 hover:text-leaf-pale"
                >
                  Créer un compte
                </Link>
              ) : null}
            </div>
          </div>
          {presentation ? (
            <div className="relative h-28 md:h-auto">
              <img
                src={mediaUrl(presentation.file)}
                alt={presentation.alt}
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
            </div>
          ) : null}
        </section>

        {/* Accès à la recherche (§26) */}
        <form
          role="search"
          aria-label="Recherche rapide d’articles"
          onSubmit={lancerRecherche}
          className="carte grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3"
        >
          <div className="flex min-w-0 items-center gap-2">
            <label htmlFor="accueil-recherche" className="sr-only">Rechercher un article</label>
            <Input
              id="accueil-recherche"
              name="q"
              type="search"
              placeholder="Rechercher un article"
              className="min-w-0"
            />
            <Button type="submit" className="shrink-0">
              <Search aria-hidden="true" className="h-5 w-5" />
              <span className="sr-only md:not-sr-only">Rechercher</span>
            </Button>
          </div>
          <Link
            to="/actualites?avancee=1"
            className="inline-flex min-h-11 items-center gap-2 justify-self-start rounded-lg px-2 text-base font-bold text-forest underline underline-offset-4 hover:bg-leaf-pale"
          >
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
            Recherche avancée
          </Link>
        </form>
      </div>

      {/* Zone d'articles mis en avant (§26) — carrousel contrôlable et pausable */}
      {aLaUne.length > 0 ? (
        <section aria-labelledby="titre-une">
          <h2 id="titre-une" className="mb-3 text-2xl text-forest sm:mb-4">À la une</h2>
          <ArticleCarousel articles={aLaUne} />
        </section>
      ) : null}

      {/* Les cinq dernières actualités (§26) */}
      <section aria-labelledby="titre-derniers">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 sm:mb-4">
          <h2 id="titre-derniers" className="text-2xl text-forest">Les dernières actualités</h2>
          <Link
            to="/actualites"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg text-base font-bold text-forest underline underline-offset-4 hover:bg-leaf-pale"
          >
            Toutes les actualités
            <ArrowRight aria-hidden="true" className="h-5 w-5" />
          </Link>
        </div>
        {derniers.length ? (
          <ul className="flex flex-wrap justify-center gap-4 sm:gap-6">
            {derniers.map((a) => (
              <li key={a.id} className="min-w-0 basis-full sm:basis-[calc((100%-1.5rem)/2)] lg:basis-[calc((100%-3rem)/3)]">
                <ArticleCard article={a} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Newspaper} title="Aucun article publié pour le moment" />
        )}
      </section>

      {/* Présentation courte de l'association */}
      <section
        aria-labelledby="titre-presentation"
        className="grid items-start gap-5 rounded-2xl border border-line bg-leaf-pale px-5 py-6 sm:px-7 md:grid-cols-2 md:items-center"
      >
        <div>
          <h2 id="titre-presentation" className="text-2xl text-forest">L’association</h2>
          <p className="mt-2 max-w-xl text-base text-bark sm:text-lg">
            Depuis 1962, le Foyer Rural organise des ateliers, anime une bibliothèque bénévole
            et mène des actions solidaires avec les écoles et la commune.
          </p>
          <Link to="/association" className={`mt-4 ${buttonClasses('secondaire', 'petit')}`}>
            Découvrir l’association
            <ArrowRight aria-hidden="true" className="h-5 w-5" />
          </Link>
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-forest/20 pt-4 text-base md:border-l md:border-t-0 md:pl-6 md:pt-0">
          {[
            { chiffre: '150', texte: 'adhérents cotisants' },
            { chiffre: '20+', texte: 'ateliers chaque semaine' },
            { chiffre: '4', texte: 'événements par an' },
            { chiffre: '6 000', texte: 'livres en bibliothèque' },
          ].map(({ chiffre, texte }) => (
            <li key={texte}>
              <span className="block text-xl font-bold text-forest">{chiffre}</span>
              {texte}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
