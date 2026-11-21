import type { Category, Tag } from '../types'

/** Catégories et tags fictifs (§23) — entièrement administrables.
 *  L'association n'étant pas spécialisée, les catégories couvrent la vie
 *  associative générale d'Arches. */
export const categoriesSeed: Category[] = [
  { id: 'c1', nom: 'Vie associative', slug: 'vie-associative' },
  { id: 'c2', nom: 'Vie du village', slug: 'vie-du-village' },
  { id: 'c3', nom: 'Nature & patrimoine', slug: 'nature-patrimoine' },
  { id: 'c4', nom: 'Culture & loisirs', slug: 'culture-loisirs' },
  { id: 'c5', nom: 'Solidarité & entraide', slug: 'solidarite-entraide' },
]

export const tagsSeed: Tag[] = [
  { id: 't1', nom: 'Assemblée générale', slug: 'assemblee-generale' },
  { id: 't2', nom: 'Fête du village', slug: 'fete-du-village' },
  { id: 't3', nom: 'Bénévolat', slug: 'benevolat' },
  { id: 't4', nom: 'Atelier', slug: 'atelier' },
  { id: 't5', nom: 'Chorale', slug: 'chorale' },
  { id: 't6', nom: 'Marché', slug: 'marche' },
  { id: 't7', nom: 'Jeunesse', slug: 'jeunesse' },
  { id: 't8', nom: 'Patrimoine', slug: 'patrimoine' },
  { id: 't9', nom: 'Nature', slug: 'nature' },
  { id: 't10', nom: 'Solidarité', slug: 'solidarite' },
]
