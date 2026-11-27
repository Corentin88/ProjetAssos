import { useRef, useState } from 'react'
import type { KeyboardEvent, TouchEvent } from 'react'
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import type { BlockImage } from '../../types'
import { mediaUrl } from '../../lib/assets'
import { getMedia } from '../../lib/selectors'
import { Button } from '../ui/form'
import { Modal } from '../ui/overlay'
import { ContentImage } from './ContentImage'
import { PdfActions } from './PdfActions'

export function BlockCarousel({ slides, pdfPath, secure }: { slides: BlockImage[]; pdfPath?: string; secure?: boolean }) {
  const [index, setIndex] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const origin = useRef<{ x: number; y: number }>()
  const lastSwipe = useRef(0)
  const visible = slides.flatMap((slide, sourcePosition) => {
    const media = getMedia(slide.mediaId)
    return media ? [{ slide, media, sourcePosition }] : []
  })
  if (!visible.length) return null
  const position = Math.min(index, visible.length - 1)
  const { slide, media, sourcePosition } = visible[position]
  const alt = slide.decorative ? '' : slide.alt
  const interactive = visible.length > 1

  function move(offset: -1 | 1) {
    setIndex(current => (Math.min(current, visible.length - 1) + offset + visible.length) % visible.length)
  }

  function navigateWithKeyboard(event: KeyboardEvent) {
    if (!interactive || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
    event.preventDefault()
    event.stopPropagation()
    move(event.key === 'ArrowLeft' ? -1 : 1)
  }

  function startSwipe(event: TouchEvent) {
    const point = event.touches[0]
    origin.current = interactive && event.touches.length === 1 ? { x: point.clientX, y: point.clientY } : undefined
    lastSwipe.current = 0
  }

  function endSwipe(event: TouchEvent) {
    const start = origin.current
    origin.current = undefined
    const point = event.changedTouches[0]
    if (!start || !point) return
    const dx = point.clientX - start.x
    const dy = point.clientY - start.y
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      lastSwipe.current = Date.now()
      move(dx < 0 ? 1 : -1)
    }
  }

  function closeViewer() {
    setViewerOpen(false)
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
  }

  const touchHandlers = {
    onTouchStart: startSwipe, onTouchEnd: endSwipe, onTouchCancel: () => { origin.current = undefined },
  }
  const image = <ContentImage key={slide.mediaId} src={mediaUrl(media.file)} alt={alt}
    className="absolute inset-0 block size-full object-contain" />
  const document = media.fromPdf && <div className="grid gap-2 p-3">
    <p className="text-sm font-bold text-mist">Document PDF</p>
    {pdfPath && (slide.viewPdf || slide.downloadPdf) && <PdfActions key={slide.mediaId} title={media.nom} secure={secure}
      viewPath={slide.viewPdf ? `${pdfPath}/view?slide=${sourcePosition}` : undefined}
      downloadPath={slide.downloadPdf ? `${pdfPath}/download?slide=${sourcePosition}` : undefined} />}
  </div>
  const controls = interactive && <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 p-3">
    <Button variant="secondaire" size="petit" onClick={() => move(-1)} aria-label="Image précédente">
      <ChevronLeft aria-hidden="true" className="h-5 w-5" /> <span className="hidden sm:inline">Précédente</span>
    </Button>
    <p role="status" aria-atomic="true" className="text-center text-sm text-mist">Image {position + 1} sur {visible.length}</p>
    <Button variant="secondaire" size="petit" onClick={() => move(1)} aria-label="Image suivante">
      <span className="hidden sm:inline">Suivante</span> <ChevronRight aria-hidden="true" className="h-5 w-5" />
    </Button>
  </div>

  return <section aria-label="Carrousel d’images" tabIndex={interactive ? 0 : undefined}
    className="min-w-0 rounded-2xl border border-line bg-white" onKeyDown={navigateWithKeyboard}>
    <figure className="overflow-hidden rounded-t-2xl" {...touchHandlers}>
      {/* L’image ne participe pas au calcul de la hauteur du cadre, même en portrait. */}
      <button ref={trigger} type="button" aria-haspopup="dialog"
        aria-label={alt ? `Agrandir l’image — ${alt}` : 'Agrandir l’image'}
        className="relative block h-[clamp(10rem,62vw,30rem)] max-h-[65dvh] w-full touch-pan-y overflow-hidden bg-sand"
        onClick={event => {
          if (event.detail && Date.now() - lastSwipe.current < 400) return
          setViewerOpen(true)
        }}>
        {image}
        <span aria-hidden="true" className="absolute right-2 bottom-2 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-forest shadow">
          <Maximize2 className="h-4 w-4" /> Agrandir
        </span>
      </button>
      {slide.caption && <figcaption className="break-words bg-sand px-4 py-2 text-mist">{slide.caption}</figcaption>}
    </figure>
    {document}
    {controls}
    {viewerOpen && <Modal open onClose={closeViewer} title="Visionneuse du carrousel" size="fullscreen">
      <div className="flex min-h-0 flex-1 flex-col" onKeyDown={navigateWithKeyboard}>
        <figure className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-sand" {...touchHandlers}>
          <div className="relative min-h-0 flex-1 touch-pan-y">{image}</div>
          {slide.caption && <figcaption className="max-h-[25dvh] shrink-0 overflow-y-auto break-words px-4 py-2 text-center text-mist">{slide.caption}</figcaption>}
        </figure>
        {document}
        {controls}
      </div>
    </Modal>}
  </section>
}
