import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Maximize2 } from 'lucide-react'
import { protectedRequest, request } from '../../lib/auth'
import { useResource } from '../../lib/community'
import { pdfTransferTimeoutMs } from '../../lib/content'
import { Button } from '../ui/form'
import { Modal } from '../ui/overlay'

export function PdfReader({ title, path, secure }: { title: string; path: string; secure: boolean }) {
  const info = useResource<{ pages: number }>(`${path}/info`, secure)
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState(false)
  const [image, setImage] = useState<{ path: string; url?: string }>()
  const expandButton = useRef<HTMLButtonElement>(null)
  const pages = info.data?.pages ?? 0
  const pagePath = pages ? `${path}/page?page=${page}` : undefined

  useEffect(() => {
    if (!pagePath) return
    let cancelled = false
    let url: string | undefined
    const response = secure
      ? protectedRequest<Blob>(pagePath, 'GET', undefined, true, pdfTransferTimeoutMs)
      : request<Blob>(pagePath, 'GET', undefined, undefined, true, pdfTransferTimeoutMs)
    void response.then(blob => {
      if (cancelled) return
      if (blob.type === 'image/png' && blob.size) url = URL.createObjectURL(blob)
      setImage({ path: pagePath, url })
    }).catch(() => {
      if (!cancelled) setImage({ path: pagePath })
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [pagePath, secure])

  function move(offset: number) {
    setPage(current => Math.max(1, Math.min(pages, current + offset)))
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!pages || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    move(event.key === 'ArrowLeft' ? -1 : 1)
  }

  function close() {
    setExpanded(false)
    requestAnimationFrame(() => expandButton.current?.focus({ preventScroll: true }))
  }

  const currentImage = image?.path === pagePath ? image : undefined
  const unavailable = Boolean(info.error || (currentImage && !currentImage.url))
  const fallback = <p role="status" className="text-brique">
    Le lecteur intégré ne peut pas afficher cette page. Utilisez « Consulter le PDF » pour ouvrir le document.
  </p>
  const controls = pages > 0 && <div className="flex flex-wrap items-center justify-center gap-2">
    <Button size="petit" variant="secondaire" disabled={page <= 1} onClick={() => move(-1)}>Précédente</Button>
    <span className="text-sm text-mist" role="status">Page {page} sur {pages}</span>
    <Button size="petit" variant="secondaire" disabled={page >= pages} onClick={() => move(1)}>Suivante</Button>
  </div>

  function displayedPage(large: boolean) {
    if (unavailable) return fallback
    if (!currentImage?.url) return <p role="status" className="text-sm text-mist">Chargement de la page…</p>
    return <img src={currentImage.url} alt={`${title} — page ${page} sur ${pages}`}
      onError={() => setImage({ path: currentImage.path })}
      className={large ? 'size-full min-h-0 object-contain' : 'mx-auto h-auto max-h-[72dvh] max-w-full object-contain'} />
  }

  return <section aria-label={`Lecteur PDF — ${title}`} className="grid min-w-0 gap-3" onKeyDown={onKeyDown}>
    <div className="grid min-w-0 place-items-center rounded-lg bg-white p-2">{displayedPage(false)}</div>
    {controls}
    {pages > 0 && <button ref={expandButton} type="button" onClick={() => setExpanded(true)} aria-haspopup="dialog"
      className="inline-flex min-h-11 items-center justify-self-center gap-2 rounded-lg px-3 font-bold text-forest underline">
      <Maximize2 aria-hidden="true" className="size-4" /> Agrandir le lecteur
    </button>}
    {expanded && <Modal open onClose={close} title={title} size="fullscreen">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="grid min-h-0 flex-1 place-items-center overflow-hidden rounded-lg bg-sand">{displayedPage(true)}</div>
        {controls}
      </div>
    </Modal>}
  </section>
}
