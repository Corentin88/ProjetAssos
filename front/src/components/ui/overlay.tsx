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
  size?: 'normal' | 'large'
}

export function Modal({ open, onClose, title, children, footer, size = 'normal' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

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

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      tabIndex={-1}
      className={`fixed inset-0 m-auto w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white p-6 shadow-2xl backdrop:bg-bark/60 ${
        size === 'large' ? 'max-w-3xl' : 'max-w-xl'
      } max-h-[calc(100vh-2rem)] overflow-y-auto scrollzone`}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id={titleId} className="text-xl font-bold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-mist hover:bg-sand hover:text-bark"
        >
          <X aria-hidden="true" className="h-6 w-6" />
          <span className="sr-only">Fermer la fenêtre</span>
        </button>
      </div>
      <div className="mt-4">{children}</div>
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
