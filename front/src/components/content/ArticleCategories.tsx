import { Link } from 'react-router-dom'
import { publicContent } from '../../lib/db'
import { publishedArticles } from '../../lib/selectors'

export const articleResultsHash = '#resultats-articles'

export function articleCategoryLink(category?: string, filters?: URLSearchParams) {
  const params = new URLSearchParams(filters)
  params.delete('page')
  params.delete('avancee')
  params.delete('categorie')
  if (category) params.set('cat', category)
  else params.delete('cat')
  return { pathname: '/actualites', search: params.toString(), hash: articleResultsHash }
}

export function ArticleCategories({ active = '', filters, compact = false }: {
  active?: string
  filters?: URLSearchParams
  compact?: boolean
}) {
  const used = new Set(publishedArticles().flatMap(article => article.categorieIds))
  const categories = publicContent.categories.filter(category => used.has(category.id))
  if (!categories.length) return null
  return <nav aria-label="Catégories des articles">
    <ul className={`flex gap-2 ${compact ? 'overflow-x-auto p-1' : 'flex-wrap'}`}>
      {[{ id: '', nom: 'Tous les articles' }, ...categories].map(({ id, nom }) => (
        <li key={id} className={compact ? 'shrink-0' : 'max-w-full'}>
          <Link to={articleCategoryLink(id, filters)} aria-current={active === id ? 'true' : undefined}
            className={`inline-flex min-h-11 max-w-full items-center rounded-full border px-4 py-2 font-bold [overflow-wrap:anywhere] ${
              active === id ? 'border-forest bg-forest text-white' : 'border-line bg-white text-forest hover:bg-leaf-pale'
            }`}>{nom}</Link>
        </li>
      ))}
    </ul>
  </nav>
}
