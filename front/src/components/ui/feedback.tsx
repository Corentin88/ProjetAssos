import type { ReactNode } from 'react'
import { CheckCircle2, CircleAlert, Inbox, Info, Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { Button } from './form'

// ============================================================
// États : chargement, erreur, absence de données (brief : qualité technique)
// ============================================================

export function Spinner({ label = 'Chargement en cours…' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-3 text-mist" role="status">
      <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-forest" />
      <span>{label}</span>
    </span>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`animate-pulse rounded-xl bg-sand-dark ${className}`} />
  )
}

/** Zone de texte du squelette : lignes de texte pulsées */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  )
}

type AlertKind = 'info' | 'succes' | 'attention' | 'erreur'

const ALERT_STYLES: Record<AlertKind, string> = {
  info: 'border-forest bg-leaf-pale text-bark',
  succes: 'border-leaf bg-leaf-pale text-bark',
  attention: 'border-ocre bg-ocre-pale text-bark',
  erreur: 'border-brique bg-brique-pale text-bark',
}

const ALERT_ICONS: Record<AlertKind, typeof Info> = {
  info: Info,
  succes: CheckCircle2,
  attention: TriangleAlert,
  erreur: CircleAlert,
}

export function Alert({ kind = 'info', title, children }: { kind?: AlertKind; title: string; children?: ReactNode }) {
  const Icon = ALERT_ICONS[kind]
  return (
    <div className={`flex items-start gap-3 rounded-xl border ${ALERT_STYLES[kind]} p-4`} role={kind === 'erreur' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" className="mt-1 h-6 w-6 shrink-0" />
      <div>
        <p className="font-bold">{title}</p>
        {children ? <div className="mt-1 text-[1rem]">{children}</div> : null}
      </div>
    </div>
  )
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: typeof Inbox
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line bg-white p-10 text-center">
      <Icon aria-hidden="true" className="h-12 w-12 text-leaf-light" />
      <div>
        <p className="text-xl font-bold">{title}</p>
        {description ? <p className="mt-1 max-w-lg text-mist">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function ErrorState({
  title = 'Une erreur est survenue',
  description = 'Le contenu n\'a pas pu être chargé. Vous pouvez réessayer ou revenir plus tard.',
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-brique bg-white p-10 text-center" role="alert">
      <CircleAlert aria-hidden="true" className="h-12 w-12 text-brique" />
      <div>
        <p className="text-xl font-bold">{title}</p>
        <p className="mt-1 max-w-lg text-mist">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="secondaire" onClick={onRetry}>
          <RefreshCw aria-hidden="true" className="h-5 w-5" />
          Réessayer
        </Button>
      ) : null}
    </div>
  )
}

// ============================================================
// Badge
// ============================================================
export type BadgeVariant = 'vert' | 'ocre' | 'gris' | 'rouge' | 'bleu-vert'

const BADGE_STYLES: Record<BadgeVariant, string> = {
  vert: 'bg-forest text-white',
  'bleu-vert': 'bg-leaf text-white',
  ocre: 'bg-ocre text-white',
  gris: 'bg-sand-dark text-bark border border-line',
  rouge: 'bg-brique text-white',
}

export function Badge({
  children,
  variant = 'gris',
  className = '',
}: {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.8125rem] font-bold ${BADGE_STYLES[variant]} ${className}`}>
      {children}
    </span>
  )
}
