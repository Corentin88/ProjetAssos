import { Navigate, useSearchParams } from 'react-router-dom'
import { normaliserParametresArticles } from '../../lib/articleSearchParams'

/** La page de recherche dédiée a été supprimée (brief V3 §2) : la recherche
 *  progressive est désormais intégrée à la page des actualités. L'ancienne
 *  route redirige vers /actualites en conservant tous les paramètres utiles
 *  (q, annee, tag, tri, ordre, page) ; le paramètre « categorie » est
 *  normalisé en « cat » et le panneau de filtres est ouvert à l'arrivée. */
export function RedirectionRecherche() {
  const [params] = useSearchParams()

  const normalises = normaliserParametresArticles(params)
  const suivants = new URLSearchParams()
  for (const cle of ['q', 'annee', 'cat', 'tag', 'tri', 'ordre', 'page']) {
    const v = normalises.get(cle)
    if (v) suivants.set(cle, v)
  }
  suivants.set('avancee', '1')

  return <Navigate to={`/actualites?${suivants}`} replace />
}
