import type { Media } from '../types'

export function proposeImageAlternative(filename: string) {
  const cleaned = filename.replace(/\.(?:jpe?g|png|webp)$/i, '')
    .replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\brandonnee(s?)\b/gi, 'randonnée$1')
  return cleaned.charAt(0).toLocaleUpperCase('fr') + cleaned.slice(1)
}

export function imageAlternative(media: Pick<Media, 'alt' | 'nom' | 'decorative'>) {
  return {
    alt: media.decorative ? '' : media.alt.trim() || proposeImageAlternative(media.nom),
    decorative: media.decorative,
  }
}
