import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './form'

// ============================================================
// Fenêtre modale accessible — élément <dialog> natif :
// focus piégé, fermeture au clavier (Échap), aria-modal
// ============================================================
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'normal' | 'large' | 'fullscreen'
  preventClose?: boolean
}

export function Modal({ open, onClose, title, children, footer, size = 'normal', preventClose = false }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const fullscreen = size === 'fullscreen'

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      d.focus()
    } else if (!open && d.open) {
      d.close()
    }
  }, [open])

  useEffect(() => {
    if (!open || !fullscreen) return
    const root = document.documentElement
    const body = document.body
    const rootOverflow = root.style.overflow
    const bodyOverflow = body.style.overflow
    root.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      root.style.overflow = rootOverflow
      body.style.overflow = bodyOverflow
    }
  }, [open, fullscreen])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={event => { if (preventClose) event.preventDefault() }}
      tabIndex={-1}
      className={fullscreen
        ? 'fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none flex-col overflow-hidden bg-white p-3 backdrop:bg-bark/90 open:flex sm:p-5'
          : `fixed inset-0 m-auto w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white p-4 shadow-2xl backdrop:bg-bark/60 sm:p-6 ${
          size === 'large' ? 'max-w-3xl' : 'max-w-xl'
        } max-h-[calc(100vh-2rem)] overflow-y-auto scrollzone`}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id={titleId} className="min-w-0 text-xl font-bold [overflow-wrap:anywhere]">
          {title}
        </h2>
        <button
          type="button"
          disabled={preventClose}
          onClick={onClose}
          className="grid size-11 shrink-0 place-items-center rounded-lg text-mist hover:bg-sand hover:text-bark"
        >
          <X aria-hidden="true" className="h-6 w-6" />
          <span className="sr-only">Fermer la fenêtre</span>
        </button>
      </div>
      <div className={fullscreen ? 'mt-2 flex min-h-0 flex-1 flex-col' : 'mt-4'}>{children}</div>
      {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
    </dialog>
  )
}

// ============================================================
// Confirmation explicite des actions sensibles ou destructrices
// ============================================================
interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  children: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  destructive = true,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="blanc" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primaire'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[1.0625rem] leading-relaxed">{children}</div>
    </Modal>
  )
}
