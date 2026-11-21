import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'

// ============================================================
// Pagination accessible (RGAA — liste de liens, page courante indiquée)
// ============================================================
interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  label?: string
}

export function Pagination({ page, totalPages, onPageChange, label = 'Pagination' }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <nav aria-label={label} className="mt-10 flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex min-h-[48px] items-center gap-1 rounded-xl border border-line bg-white px-4 font-bold text-forest hover:bg-leaf-pale disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft aria-hidden="true" className="h-5 w-5" />
        Précédent
      </button>
      <ul className="flex flex-wrap items-center gap-2">
        {pages.map((p, i) =>
          p === '...' ? (
            <li key={`dots-${i}`} className="px-1 text-mist" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p}${p === page ? ' (page courante)' : ''}`}
                className={`inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border px-3 font-bold ${
                  p === page
                    ? 'border-forest bg-forest text-white'
                    : 'border-line bg-white text-forest hover:bg-leaf-pale'
                }`}
              >
                {p}
              </button>
            </li>
          ),
        )}
      </ul>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex min-h-[48px] items-center gap-1 rounded-xl border border-line bg-white px-4 font-bold text-forest hover:bg-leaf-pale disabled:cursor-not-allowed disabled:opacity-40"
      >
        Suivant
        <ChevronRight aria-hidden="true" className="h-5 w-5" />
      </button>
    </nav>
  )
}

// ============================================================
// Onglets accessibles (pattern WAI-ARIA : flèches de navigation)
// ============================================================
interface TabsProps {
  tabs: { id: string; label: ReactNode }[]
  activeId: string
  onChange: (id: string) => void
  label: string
}

export function Tabs({ tabs, activeId, onChange, label }: TabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    refs.current = refs.current.slice(0, tabs.length)
  }, [tabs.length])

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next: number | null = null
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length
    if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = tabs.length - 1
    if (next !== null) {
      e.preventDefault()
      onChange(tabs[next].id)
      refs.current[next]?.focus()
    }
  }

  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[i] = el
          }}
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={t.id === activeId}
          aria-controls={`panel-${t.id}`}
          tabIndex={t.id === activeId ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKeyDown(e, i)}
          className={`inline-flex min-h-[48px] items-center gap-2 rounded-xl px-5 font-bold transition-colors ${
            t.id === activeId ? 'bg-forest text-white' : 'bg-white text-forest border border-line hover:bg-leaf-pale'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function TabPanel({
  panelId,
  activeId,
  children,
}: {
  panelId: string
  activeId: string
  children: ReactNode
}) {
  if (panelId !== activeId) return null
  return (
    <div role="tabpanel" id={`panel-${panelId}`} aria-labelledby={`tab-${panelId}`} tabIndex={0}>
      {children}
    </div>
  )
}

// ============================================================
// Fil d'Ariane
// ============================================================
export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="text-[0.9375rem]">
      <ol className="flex flex-wrap items-center gap-1 text-mist">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 ? <span aria-hidden="true">›</span> : null}
            {item.to ? (
              <Link to={item.to} className="rounded-md underline decoration-line underline-offset-4 hover:text-forest">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-bold text-bark">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
