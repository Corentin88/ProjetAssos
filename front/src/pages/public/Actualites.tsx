import { PageHead } from '../../components/layout/PublicLayout'
import { ArticlesExplorer } from '../../components/content/ArticlesExplorer'
import { useScrollMemory } from '../../hooks/common'
import { articleResultsHash } from '../../components/content/ArticleCategories'
import { useSearchParams } from 'react-router-dom'

/** Page des actualités (§25) : cartes homogènes, pagination, recherche
 *  progressive avec filtres dépliables — l'état (critères, tri, pagination)
 *  et la position de défilement sont restaurés après lecture d'un article */
export function Actualites() {
  const [params] = useSearchParams()
  useScrollMemory('actualites', articleResultsHash, Boolean(params.get('cat') ?? params.get('categorie')) && !params.has('avancee'))

  return (
    <div>
      <PageHead
        titre="Actualités"
        sousTitre="Événements, ateliers, vie du village et de l'association : retrouvez ici toute l'actualité du Foyer Rural d'Arches. Utilisez la recherche et les filtres pour affiner."
      />
      <div className="mx-auto max-w-7xl px-4 py-4 sm:py-10">
        <ArticlesExplorer />
      </div>
    </div>
  )
}
