/** Les liens publiés avec « categorie » restent valides. « cat » est prioritaire si les deux sont présents. */
export function normaliserParametresArticles(params: URLSearchParams): URLSearchParams {
  const normalises = new URLSearchParams(params)
  const categorie = normalises.get('cat') ?? normalises.get('categorie')
  normalises.delete('categorie')
  if (categorie) normalises.set('cat', categorie)
  else normalises.delete('cat')
  return normalises
}
