import { useState } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from 'lucide-react'
import type { Block, BlockImage } from '../../types'
import { mediaUrl } from '../../lib/assets'
import { getMedia } from '../../lib/selectors'
import { ContentImage } from '../content/ContentImage'
import { Button, Field, Input } from '../ui/form'
import { MediaPicker } from './MediaPicker'
import { ImageAlternativeField } from './ImageAlternativeField'
import { VisualPdfFields } from './VisualPdfFields'
import { imageAlternative } from '../../lib/imageAlternative'

const maxSlides = 24

export function BlockCarouselEditor({ block, onChange, errors }: {
  block: Block
  onChange: (slides: BlockImage[]) => void
  errors?: Record<string, string>
}) {
  const [open, setOpen] = useState(false)
  const slides = block.slides ?? []
  const controlId = `blk-${block.id}-slides`

  function move(index: number, offset: -1 | 1) {
    const next = [...slides]
    const target = index + offset
    const image = next[index]
    next[index] = next[target]
    next[target] = image
    onChange(next)
  }

  function update(index: number, patch: Partial<BlockImage>) {
    onChange(slides.map((slide, i) => i === index ? { ...slide, ...patch } : slide))
  }

  return <div className="grid gap-3">
    <Button id={controlId} size="petit" variant="secondaire" className="justify-self-start"
      disabled={slides.length >= maxSlides} aria-describedby={errors?.[controlId] ? `${controlId}-err` : undefined}
      onClick={() => setOpen(true)}>
      <ImagePlus aria-hidden="true" className="h-5 w-5 shrink-0" /> Ajouter des images ou PDF
    </Button>
    {errors?.[controlId] && <p id={`${controlId}-err`} className="text-brique" role="alert">{errors[controlId]}</p>}
    {slides.length >= maxSlides && <p className="text-mist">Limite de {maxSlides} images atteinte.</p>}
    {slides.length > 0 && <ol className="grid gap-3" aria-label="Ordre des images du carrousel">
      {slides.map((slide, index) => {
        const media = getMedia(slide.mediaId)
        const id = `blk-${block.id}-slide-${index}`
        const altError = errors?.[`${id}-alt`]
        return <li key={slide.mediaId} className="grid min-w-0 gap-3 rounded-xl border border-line p-3">
          <p className="break-words font-bold">{index + 1}. {media?.nom ?? 'Image'}</p>
          {media && <ContentImage src={mediaUrl(media.file)} alt="" loading="lazy" className="h-28 max-w-full rounded-lg bg-sand object-contain" />}
          <ImageAlternativeField id={`${id}-alt`} alt={slide.alt} decorative={slide.decorative} error={altError}
            onAltChange={alt => update(index, { alt })} onDecorativeChange={decorative => update(index, { decorative })} />
          {media?.fromPdf && <VisualPdfFields id={id} value={slide} onChange={patch => update(index, patch)} />}
          <Field label="Légende" htmlFor={`${id}-caption`}>
            <Input id={`${id}-caption`} value={slide.caption ?? ''} maxLength={1000}
              onChange={event => update(index, { caption: event.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button size="petit" variant="secondaire" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Monter l’image ${index + 1}`}>
              <ArrowUp aria-hidden="true" className="h-4 w-4" /> Monter
            </Button>
            <Button size="petit" variant="secondaire" disabled={index === slides.length - 1} onClick={() => move(index, 1)} aria-label={`Descendre l’image ${index + 1}`}>
              <ArrowDown aria-hidden="true" className="h-4 w-4" /> Descendre
            </Button>
            <Button size="petit" variant="danger" onClick={() => onChange(slides.filter((_, i) => i !== index))} aria-label={`Retirer l’image ${index + 1}`}>
              <Trash2 aria-hidden="true" className="h-4 w-4" /> Retirer
            </Button>
          </div>
        </li>
      })}
    </ol>}
    <MediaPicker open={open} onClose={() => setOpen(false)} titre="Choisir les images ou PDF du carrousel" type="VISUAL" multiple
      limit={maxSlides - slides.length} excludedIds={slides.map(slide => getMedia(slide.mediaId)?.sourcePdfId ?? slide.mediaId)}
      onChoose={images => onChange([...slides, ...images.map(media => ({ mediaId: media.id, ...imageAlternative(media) }))])} />
  </div>
}
