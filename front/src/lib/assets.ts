/** Résolution des ressources statiques (images) compatible avec
 *  un déploiement sous préfixe (import.meta.env.BASE_URL). */
export function asset(path: string): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${base}${path.replace(/^\//, '')}`
}

/** URL d'un fichier média de la médiathèque.
 *  Les fichiers importés pendant la session (object URLs) sont laissés tels quels. */
export function mediaUrl(file: string): string {
  if (file.startsWith('blob:') || file.startsWith('data:') || file.startsWith('http')) return file
  return asset(`images/${file}`)
}
