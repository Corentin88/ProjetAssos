import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, RotateCcw, Search, SearchX, SlidersHorizontal, X } from 'lucide-react'
import { useDb, useDbVersion } from '../../lib/db'
import { getCategory, getTag, publishedYears, searchArticles } from '../../lib/selectors'
import { normaliserParametresArticles } from '../../lib/articleSearchParams'
import { Button, Field, Input, Select } from '../ui/form'
import { EmptyState } from '../ui/feedback'
import { Pagination } from '../ui/nav'
import { ArticleCard } from './ArticleCard'
import { ArticleCategories, articleResultsHash } from './ArticleCategories'

const PAR_PAGE = 6

/** Recherche progressive intégrée à la page des actualités (§24, §25) :
 *  une barre de recherche toujours visible, un panneau de filtres dépliable
 *  (les critères sont conservés quand on le referme), des résultats sur la
 *  même page. L'état est porté par l'URL (q, annee, cat, tag, tri, ordre,
 *  page) : retour depuis un article restaure la recherche, les filtres, le
 *  tri, la page de pagination et la position de défilement. */
export function ArticlesExplorer({ titreResultats }: { titreResultats?: string }) {
  const db = useDb()
  const version = useDbVersion()
  const [params, setParams] = useSearchParams()
  const { hash, key } = useLocation()
  const navigate = useNavigate()

  const q = params.get('q') ?? ''
  const annee = params.get('annee') ?? ''
  const cat = params.get('cat') ?? params.get('categorie') ?? ''
  const tag = params.get('tag') ?? ''
  const triParam = params.get('tri')
  const tri = triParam === 'titre' || triParam === 'auteur' ? triParam : 'date'
  const ordre = params.get('ordre') === 'croissant' ? 'croissant' : 'decroissant'
  const pageParam = Number(params.get('page'))
  const page = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1
  const nbFiltres = [annee, cat, tag, tri !== 'date', ordre !== 'decroissant'].filter(Boolean).length
  const rechercheActive = Boolean(q) || nbFiltres > 0

  const versResultats = hash === articleResultsHash
  const [panneauOuvert, setPanneauOuvert] = useState(
    () => !versResultats && (params.has('avancee') || (!cat && nbFiltres > 0)),
  )

  // Une nouvelle navigation par catégorie replie le panneau, même sur une liste déjà montée.
  useLayoutEffect(() => {
    if (versResultats) setPanneauOuvert(false)
  }, [key, versResultats])

  // Les badges de tags et le lien de recherche avancée conservent leur ouverture explicite.
  useEffect(() => {
    if (!params.has('avancee') && !params.has('categorie')) return
    if (params.has('avancee') && !versResultats) setPanneauOuvert(true)
    const next = normaliserParametresArticles(params)
    next.delete('avancee')
    navigate({ search: next.toString(), hash }, { replace: true })
  }, [params, navigate, hash, versResultats])

  const maj = (patch: Record<string, string | undefined>, replace = false) => {
    const next = normaliserParametresArticles(params)
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === '') next.delete(k)
      else next.set(k, v)
    })
    if (!('page' in patch)) next.delete('page')
    if (next.toString() !== params.toString()) setParams(next, { replace })
  }

  const resultats = useMemo(
    () =>
      searchArticles({
        q,
        annee: annee || undefined,
        categorieId: cat || undefined,
        tagId: tag || undefined,
        tri,
        ordre,
      }),
    [version, q, annee, cat, tag, tri, ordre],
  )

  const totalPages = Math.max(1, Math.ceil(resultats.length / PAR_PAGE))
  const pageCourante = Math.min(page, totalPages)
  const visibles = resultats.slice((pageCourante - 1) * PAR_PAGE, pageCourante * PAR_PAGE)

  const annees = publishedYears()

  const reinitialiser = () => {
    // Les critères sont effacés mais le panneau garde son état : on ne perd
    // pas le contexte de recherche en cours
    setParams(new URLSearchParams(), { replace: false })
  }

  /** Puces des critères actifs, retirables individuellement */
  const puces: { label: string; onRetirer: () => void }[] = []
  if (q.trim()) {
    puces.push({ label: `« ${q.trim()} »`, onRetirer: () => maj({ q: undefined }) })
  }
  if (annee) puces.push({ label: `Année : ${annee}`, onRetirer: () => maj({ annee: undefined }) })
  if (cat) {
    const nom = getCategory(cat)?.nom ?? 'introuvable'
    puces.push({ label: `Catégorie : ${nom}`, onRetirer: () => maj({ cat: undefined }) })
  }
  if (tag) {
    const t = getTag(tag)
    puces.push({ label: `Tag : ${t ? `#${t.nom}` : 'introuvable'}`, onRetirer: () => maj({ tag: undefined }) })
  }
  if (tri !== 'date') {
    puces.push({ label: `Tri : ${tri === 'titre' ? 'titre' : 'auteur'}`, onRetirer: () => maj({ tri: undefined }) })
  }
  if (ordre !== 'decroissant') {
    puces.push({ label: 'Ordre : croissant', onRetirer: () => maj({ ordre: undefined }) })
  }

  return (
    <div>
      {/* Recherche progressive : barre simple + panneau de filtres dépliable */}
      <form
        id={articleResultsHash.slice(1)}
        tabIndex={-1}
        role="search"
        aria-label="Rechercher et filtrer les articles"
        onSubmit={(e) => e.preventDefault()}
        className="carte scroll-mt-20 p-3 sm:p-6"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:gap-3">
          <div className="relative min-w-0">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-mist"
            />
            <Input
              id="recherche-q"
              type="search"
              value={q}
              placeholder="Rechercher un article"
              aria-label="Rechercher dans les articles (titre, contenu, auteur, catégories et tags)"
              className="min-h-[52px] pl-12"
              onChange={(e) => maj({ q: e.target.value }, true)}
            />
          </div>
          <button
            type="button"
            onClick={() => setPanneauOuvert((o) => !o)}
            aria-expanded={panneauOuvert}
            aria-controls="panneau-filtres"
            className={`inline-flex min-h-[52px] shrink-0 items-center justify-center gap-1 rounded-xl px-2.5 font-bold transition-colors motion-reduce:transition-none sm:gap-2 sm:px-5 ${
              panneauOuvert
                ? 'bg-forest text-white hover:bg-forest-dark'
                : 'border border-line bg-white text-forest hover:bg-leaf-pale'
            }`}
          >
            <SlidersHorizontal aria-hidden="true" className="h-5 w-5" />
            Filtres
            {nbFiltres > 0 ? (
              <span
                className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[0.8125rem] ${
                  panneauOuvert ? 'bg-white/25' : 'bg-forest text-white'
                }`}
                aria-label={`${nbFiltres} filtre${nbFiltres > 1 ? 's' : ''} actif${nbFiltres > 1 ? 's' : ''}`}
              >
                {nbFiltres}
              </span>
            ) : null}
            <ChevronDown
              aria-hidden="true"
              className={`hidden h-5 w-5 transition-transform motion-reduce:transition-none sm:block ${panneauOuvert ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Panneau de filtres : le refermer conserve les critères portés par l'URL. */}
        <div
          id="panneau-filtres"
          hidden={!panneauOuvert}
          className={`mt-4 gap-x-5 gap-y-4 rounded-xl border border-line bg-sand p-4 sm:p-5 md:grid-cols-2 lg:grid-cols-3 ${panneauOuvert ? 'grid' : 'hidden'}`}
        >
          <Field
            label="Catégorie"
            htmlFor="recherche-cat"
          >
            <Select id="recherche-cat" value={cat} onChange={(e) => maj({ cat: e.target.value })}>
              <option value="">Toutes les catégories</option>
              {db.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tag" htmlFor="recherche-tag">
            <Select id="recherche-tag" value={tag} onChange={(e) => maj({ tag: e.target.value })}>
              <option value="">Tous les tags</option>
              {db.tags.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.nom}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Année de publication"
            htmlFor="recherche-annee"
            hint="Déterminée automatiquement à partir de la date de publication."
          >
            <Select
              id="recherche-annee"
              value={annee}
              onChange={(e) => maj({ annee: e.target.value })}
            >
              <option value="">Toutes les années</option>
              {annees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Trier par" htmlFor="recherche-tri">
            <Select id="recherche-tri" value={tri} onChange={(e) => maj({ tri: e.target.value })}>
              <option value="date">Date</option>
              <option value="titre">Titre</option>
              <option value="auteur">Auteur</option>
            </Select>
          </Field>
          <Field label="Ordre" htmlFor="recherche-ordre">
            <Select
              id="recherche-ordre"
              value={ordre}
              onChange={(e) => maj({ ordre: e.target.value })}
            >
              <option value="decroissant">Décroissant</option>
              <option value="croissant">Croissant</option>
            </Select>
          </Field>
        </div>

        {/* Critères actifs, réinitialisation et nombre de résultats */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {rechercheActive || params.has('page') ? (
            <Button
              type="button"
              variant="secondaire"
              size="petit"
              onClick={reinitialiser}
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Réinitialiser
            </Button>
          ) : null}
          {puces.map((p) => (
            <span
              key={p.label}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-leaf-pale py-1 pl-3 pr-1.5 text-[0.875rem] font-bold text-forest"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">{p.label}</span>
              <button
                type="button"
                onClick={p.onRetirer}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-forest hover:bg-leaf hover:text-white"
                aria-label={`Retirer le critère ${p.label}`}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </span>
          ))}
          <p className="ml-auto text-[0.9375rem] text-mist" role="status">
            {resultats.length} {resultats.length === 1 ? 'article trouvé' : 'articles trouvés'}
            {!rechercheActive && resultats.length > 0
              ? ' — du plus récent au plus ancien'
              : ''}
          </p>
        </div>
      </form>

      <div className="mt-2"><ArticleCategories active={cat} filters={params} compact /></div>
      <h2 className="mt-4 text-xl text-forest">
        {titreResultats ?? (cat ? getCategory(cat)?.nom ?? 'Résultats' : 'Résultats')}
      </h2>

      {visibles.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={SearchX}
            title="Aucun article ne correspond à votre recherche"
            description="Essayez avec d'autres mots-clés, ou retirez certains filtres pour élargir la recherche."
            action={
              <Button variant="secondaire" onClick={reinitialiser}>
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Réinitialiser les critères
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <ul className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {visibles.map((a) => (
              <li key={a.id} className="h-full">
                <ArticleCard article={a} />
              </li>
            ))}
          </ul>
          <Pagination
            page={pageCourante}
            totalPages={totalPages}
            onPageChange={(p) => maj({ page: String(p) })}
            label="Pagination des articles"
          />
        </>
      )}
    </div>
  )
}
