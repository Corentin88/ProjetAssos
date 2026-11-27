import { ContentImage } from './ContentImage'
import type { Block } from '../../types'
import { Link } from 'react-router-dom'
import { getMedia } from '../../lib/selectors'
import { mediaUrl } from '../../lib/assets'
import { TrailDetails } from './TrailDetails'
import { LocationDetails } from './LocationMap'
import { BlockCarousel } from './BlockCarousel'
import { PdfActions } from './PdfActions'
import { PdfReader } from './PdfReader'

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
  if (!adresse || adresse.username || adresse.password || !['http:', 'https:'].includes(adresse.protocol)) return null
  const domaine = adresse.host
  let id: string | null | undefined
  if (domaine === 'youtu.be') id = adresse.pathname.slice(1)
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(domaine)) {
    id = adresse.pathname === '/watch'
      ? adresse.searchParams.get('v')
      : adresse.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1]
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null
}

export function estLienInterne(url: string) {
  return /^\/(?![\/\\])[^\\\r\n\t]*$/.test(url)
}

export function estLienAutorise(url: string) {
  if (estLienInterne(url)) return true
  const adresse = lireAdresse(url)
  return Boolean(adresse && !adresse.username && !adresse.password
    && ['http:', 'https:', 'mailto:', 'tel:'].includes(adresse.protocol))
}

/** Rendu public d'une liste de blocs (§18) */
export function BlockRenderer({ blocks, articleId }: { blocks: Block[]; articleId?: string }) {
  return (
    <div className="block-content [overflow-wrap:anywhere]">
      {blocks.map((b) => (
        <BlockView key={b.id} block={b} articleId={articleId} sousPage />
      ))}
    </div>
  )
}

export function BlockView({ block, sousPage = false, articleId, adminPreview = false }: { block: Block; sousPage?: boolean; articleId?: string; adminPreview?: boolean }) {
  const Titre = sousPage ? 'h2' : 'h3'
  const SousTitre = sousPage ? 'h3' : 'h4'
  const pdfPath = articleId ? `${adminPreview ? '/admin/content' : ''}/articles/${articleId}/blocks/${block.id}/pdf` : undefined
  switch (block.type) {
    case 'randonnee':
      return block.trail ? <TrailDetails trail={block.trail} mapPreview={block.mapPreview} visibility={block.visibility}
        mapSettings={block.mapSettings} mediaId={block.mediaId} gpxAvailable={block.gpxAvailable}
        elevationSource={block.elevationSource}
        articleId={articleId} blockId={block.id} /> : null
    case 'localisation':
      return block.location ? <LocationDetails location={block.location} /> : null
    case 'titre':
      return <Titre className="mt-8 text-forest first:mt-0">{block.text}</Titre>
    case 'sous-titre':
      return <SousTitre className="text-forest">{block.text}</SousTitre>
    case 'paragraphe':
      return <p className="whitespace-pre-line text-base leading-relaxed sm:text-lg">{block.text}</p>
    case 'carrousel':
      return <BlockCarousel slides={block.slides ?? []} pdfPath={pdfPath} secure={adminPreview} />
    case 'pdf': {
      if (!pdfPath || !block.pdf || (!block.pdf.display && !block.pdf.download)) return null
      const title = block.text || 'Document PDF'
      return <section className="grid min-w-0 gap-3 rounded-xl border border-line bg-sand p-4">
        <Titre className="text-xl text-forest">{title}</Titre>
        {block.pdf.description && <p className="whitespace-pre-line text-mist">{block.pdf.description}</p>}
        {block.pdf.display && block.pdf.presentation === 'integrated' && <PdfReader key={pdfPath} title={title} path={pdfPath} secure={adminPreview} />}
        <PdfActions title={title} viewPath={block.pdf.display ? `${pdfPath}/view` : undefined}
          downloadPath={block.pdf.download ? `${pdfPath}/download` : undefined} secure={adminPreview} />
      </section>
    }
    case 'image': {
      const media = block.mediaId ? getMedia(block.mediaId) : undefined
      if (!media) return null
      // Les anciens blocs affichaient leur texte alternatif comme légende.
      const alt = block.decorative ? '' : (block.alt || media.alt)
      const caption = block.text ?? alt
      const image = <ContentImage
            src={mediaUrl(media.file)}
            alt={alt}
            width={media.largeur || undefined}
            height={media.hauteur || undefined}
            className="mx-auto h-auto max-h-[36rem] w-auto max-w-full object-contain"
            loading="lazy"
          />
      const viewPath = pdfPath && media.fromPdf && block.viewPdf ? `${pdfPath}/view` : undefined
      const downloadPath = pdfPath && media.fromPdf && block.downloadPdf ? `${pdfPath}/download` : undefined
      return (
        <figure className="overflow-hidden rounded-2xl border border-line">
          {viewPath ? <PdfActions title={media.nom} viewPath={viewPath} downloadPath={downloadPath} secure={adminPreview}
            preview={image} /> : image}
          {!viewPath && downloadPath && <PdfActions title={media.nom} downloadPath={downloadPath} secure={adminPreview} />}
          {caption ? (
            <figcaption className="bg-sand px-4 py-2 text-[0.9375rem] text-mist">
              {caption}
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
          {(block.items ?? []).filter(item => item.trim() !== '').map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )
    case 'lien': {
      const url = block.url?.trim() ?? ''
      const libelle = block.text || url
      const classe = 'inline-flex min-h-11 items-center rounded-lg font-bold text-forest underline underline-offset-4 hover:bg-leaf-pale'
      // Les routes internes restent compatibles avec HashRouter. Les liens édités autorisent seulement les protocoles usuels.
      if (estLienInterne(url)) {
        return <p><Link to={url} className={classe}>{libelle}</Link></p>
      }
      if (!estLienAutorise(url)) {
        return libelle ? <p>{libelle}</p> : null
      }
      return (
        <p>
          <a href={url} className={classe}>{libelle}</a>
        </p>
      )
    }
    case 'citation':
      return <blockquote className="text-base leading-relaxed sm:text-lg">{block.text}</blockquote>
    default:
      return null
  }
}
