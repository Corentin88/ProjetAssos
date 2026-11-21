import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'

export type ToastKind = 'succes' | 'info' | 'erreur'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => undefined })

export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}

const ICONS: Record<ToastKind, typeof Info> = {
  succes: CheckCircle2,
  info: Info,
  erreur: TriangleAlert,
}

const STYLES: Record<ToastKind, string> = {
  succes: 'border-leaf bg-white text-bark',
  info: 'border-forest bg-white text-bark',
  erreur: 'border-ocre bg-white text-bark',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, kind: ToastKind = 'succes') => {
      const id = nextId.current++
      setToasts((ts) => [...ts, { id, kind, message }])
      setTimeout(() => dismiss(id), 6000)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Région live : les notifications toast sont annoncées aux lecteurs d'écran */}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-3 p-4 sm:items-end"
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.kind]
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border ${STYLES[t.kind]} p-4 shadow-lg`}
            >
              <Icon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
              <p className="flex-1 text-base leading-snug">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded-md p-1 text-mist hover:text-bark"
              >
                <X aria-hidden="true" className="h-5 w-5" />
                <span className="sr-only">Fermer la notification</span>
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
