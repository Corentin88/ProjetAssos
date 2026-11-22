import { ContentImage } from './ContentImage'
import type { Block } from '../../types'
import { Link } from 'react-router-dom'
import { getMedia } from '../../lib/selectors'
import { mediaUrl } from '../../lib/assets'

function lireAdresse(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

/** Extrait l'identifiant YouTube d'une URL (§19 : vérification de l'URL) */
export function youtubeId(url: string | undefined): string | null {
  const adresse = lireAdresse(url?.trim() ?? '')
  if (!adresse || !['http:', 'https:'].includes(adresse.protocol)) return null
  const [, route, segment] = adresse.pathname.split('/')
  const domaine = adresse.hostname
  let id: string | null | undefined
  if (domaine === 'youtu.be') id = route
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(domaine)) {
    if (route === 'watch') id = adresse.searchParams.get('v')
    if (route === 'embed' || route === 'shorts') id = segment
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null
}

/** Rendu public d'une liste de blocs (§18) */
export function BlockRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <div className="block-content [overflow-wrap:anywhere]">
      {blocks.map((b) => (
        <BlockView key={b.id} block={b} sousPage />
      ))}
    </div>
  )
}

export function BlockView({ block, sousPage = false }: { block: Block; sousPage?: boolean }) {
  const Titre = sousPage ? 'h2' : 'h3'
  const SousTitre = sousPage ? 'h3' : 'h4'
  switch (block.type) {
    case 'titre':
      return <Titre className="mt-8 text-forest first:mt-0">{block.text}</Titre>
    case 'sous-titre':
      return <SousTitre className="text-forest">{block.text}</SousTitre>
    case 'paragraphe':
      return <p className="whitespace-pre-line text-base leading-relaxed sm:text-lg">{block.text}</p>
    case 'image': {
      const media = block.mediaId ? getMedia(block.mediaId) : undefined
      if (!media) return null
      return (
        <figure className="overflow-hidden rounded-2xl border border-line">
          <ContentImage
            src={mediaUrl(media.file)}
            alt={block.alt || media.alt}
            width={media.largeur || undefined}
            height={media.hauteur || undefined}
            className="mx-auto h-auto max-h-[36rem] w-auto max-w-full object-contain"
            loading="lazy"
          />
          {block.alt || media.alt ? (
            <figcaption className="bg-sand px-4 py-2 text-[0.9375rem] text-mist">
              {block.alt || media.alt}
            </figcaption>
          ) : null}
        </figure>
      )
    }
    case 'video': {
      const id = youtubeId(block.url)
      return (
        <figure className="overflow-hidden rounded-2xl border border-line bg-bark">
          {id ? (
            <div className="aspect-video w-full">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${id}`}
                title={block.text || `Vidéo YouTube (${id})`}
                loading="lazy"
                allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          ) : (
            <div className="p-6 text-white">
              <p className="font-bold">Vidéo YouTube</p>
              <p className="mt-1 text-white/80">
                L'adresse saisie n'a pas pu être reconnue comme une adresse YouTube valide.
              </p>
            </div>
          )}
          {id ? (
            <figcaption className="bg-white px-4 text-sm">
              <a href={`https://www.youtube.com/watch?v=${id}`} className="inline-flex min-h-11 items-center font-bold text-forest underline underline-offset-4">
                Voir sur YouTube
              </a>
            </figcaption>
          ) : null}
        </figure>
      )
    }
    case 'liste':
      return (
        <ul className="text-base leading-relaxed marker:text-forest sm:text-lg">
          {(block.items ?? []).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )
    case 'lien': {
      const url = block.url?.trim() ?? ''
      const libelle = block.text || url
      const classe = 'inline-flex min-h-11 items-center rounded-lg font-bold text-forest underline underline-offset-4 hover:bg-leaf-pale'
      // Les routes internes restent compatibles avec HashRouter. Les liens édités autorisent seulement les protocoles usuels.
      if (/^\/(?![\/\\])/.test(url)) {
        return <p><Link to={url} className={classe}>{libelle}</Link></p>
      }
      const adresse = lireAdresse(url)
      if (!adresse || !['http:', 'https:', 'mailto:', 'tel:'].includes(adresse.protocol)) {
        return libelle ? <p>{libelle}</p> : null
      }
      return (
        <p>
          <a href={adresse.href} className={classe}>{libelle}</a>
        </p>
      )
    }
    case 'citation':
      return <blockquote className="text-base leading-relaxed sm:text-lg">{block.text}</blockquote>
    default:
      return null
  }
}
