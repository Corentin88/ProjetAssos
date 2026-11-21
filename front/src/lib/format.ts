const dtfLong = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const dtfShort = new Intl.DateTimeFormat('fr-FR')
const dtfLongTime = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const dtfMoisAnnee = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return dtfLong.format(new Date(iso))
}

export function formatDateShort(iso: string | null): string {
  if (!iso) return '—'
  return dtfShort.format(new Date(iso))
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return dtfLongTime.format(new Date(iso))
}

/** « Membre depuis novembre 2025 » */
export function formatMoisAnnee(iso: string): string {
  return dtfMoisAnnee.format(new Date(iso))
}

/** Durée en minutes → « 2 h 40 » ou « 45 min » */
export function formatDuree(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${String(m).padStart(2, '0')}`
}

export function formatTaille(ko: number): string {
  if (ko >= 1000) return `${(ko / 1000).toFixed(1)} Mo`
  return `${ko} Ko`
}

export function formatNombre(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

/** Date-heure locale pour un <input type="datetime-local"> */
export function toInputDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromInputDateTime(value: string): string {
  // value: '2026-12-05T09:00' → ISO (heure locale)
  return new Date(value).toISOString()
}
