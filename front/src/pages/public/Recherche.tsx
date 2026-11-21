import { Navigate, useSearchParams } from 'react-router-dom'

/** La page de recherche dédiée a été supprimée (brief V3 §2) : la recherche
 *  progressive est désormais intégrée à la page des actualités. L'ancienne
 *  route redirige vers /actualites en conservant tous les paramètres utiles
 *  (q, annee, tag, tri, ordre, page) ; le paramètre « categorie » est
 *  normalisé en « cat » et le panneau de filtres est ouvert à l'arrivée. */
export function RedirectionRecherche() {
  const [params] = useSearchParams()

  const suivants = new URLSearchParams()
  for (const cle of ['q', 'annee', 'tag', 'tri', 'ordre', 'page']) {
    const v = params.get(cle)
    if (v) suivants.set(cle, v)
  }
  const categorie = params.get('cat') ?? params.get('categorie')
  if (categorie) suivants.set('cat', categorie)
  if (!suivants.get('tri')) suivants.set('avancee', '1')

  const query = suivants.toString()
  return <Navigate to={`/actualites${query ? `?${query}` : ''}`} replace />
}
