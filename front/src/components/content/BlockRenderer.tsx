import type { Block } from '../../types'
import { getMedia } from '../../lib/selectors'
import { mediaUrl } from '../../lib/assets'

/** Extrait l'identifiant YouTube d'une URL (§19 : vérification de l'URL) */
export function youtubeId(url: string | undefined): string | null {
  if (!url) return null
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{6,})/,
    /(?:youtu\.be\/)([\w-]{6,})/,
    /(?:youtube\.com\/embed\/)([\w-]{6,})/,
    /(?:youtube\.com\/shorts\/)([\w-]{6,})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

/** Rendu public d'une liste de blocs (§18) */
export function BlockRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <div className="block-content">
      {blocks.map((b) => (
        <BlockView key={b.id} block={b} />
      ))}
    </div>
  )
}

export function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'titre':
      return <h3 className="text-forest">{block.text}</h3>
    case 'sous-titre':
      return <h4 className="text-forest">{block.text}</h4>
    case 'paragraphe':
      return <p className="text-[1.0625rem] leading-relaxed">{block.text}</p>
    case 'image': {
      const media = block.mediaId ? getMedia(block.mediaId) : undefined
      if (!media) return null
      return (
        <figure className="overflow-hidden rounded-2xl border border-line">
          <img
            src={mediaUrl(media.file)}
            alt={block.alt || media.alt}
            className="w-full object-cover"
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
                title="Vidéo YouTube intégrée à l'article"
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
          <figcaption className="bg-white px-4 py-2 text-[0.9375rem] text-mist">
            Vidéo hébergée sur YouTube — {block.url}
          </figcaption>
        </figure>
      )
    }
    case 'liste':
      return (
        <ul>
          {(block.items ?? []).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )
    case 'lien':
      return (
        <p>
          <a
            href={block.url || '#'}
            onClick={(e) => {
              // Liens internes de la maquette : navigation via le routeur
              if (block.url?.startsWith('/')) {
                e.preventDefault()
                window.location.hash = `#${block.url}`
              }
            }}
            className="inline-flex min-h-[44px] items-center rounded-lg font-bold text-forest underline decoration-2 underline-offset-4 hover:bg-leaf-pale"
          >
            {block.text || block.url}
          </a>
        </p>
      )
    case 'citation':
      return <blockquote>{block.text}</blockquote>
    default:
      return null
  }
}
