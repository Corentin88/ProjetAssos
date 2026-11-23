import { useState } from 'react'
import type { LocationBlockFields } from '../../types'
import { protectedRequest } from '../../lib/auth'
import { LocationMap } from '../content/LocationMap'
import { Button, Field, Input, Textarea } from '../ui/form'

type AddressMatch = { label: string; latitude: number; longitude: number }

export function LocationEditor({ id, location, error, onChange }: {
  id: string
  location: LocationBlockFields
  error?: string
  onChange: (location: LocationBlockFields) => void
}) {
  const fieldId = (key: string) => `blk-${id}-${key}`
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState<{ query: string; results?: AddressMatch[]; error?: string }>()
  const addressSearch = search?.query === location.address ? search : undefined

  async function findAddress() {
    const query = location.address
    setLoading(true)
    try {
      const results = await protectedRequest<AddressMatch[]>('/admin/content/locations/search', 'POST', { address: query })
      setSearch({ query, results })
    } catch {
      setSearch({ query, error: 'Recherche indisponible. Réessayez ou saisissez les coordonnées.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Titre du lieu" htmlFor={fieldId('title')} className="sm:col-span-2">
        <Input id={fieldId('title')} value={location.title} maxLength={255}
          onChange={event => onChange({ ...location, title: event.target.value })} />
      </Field>
      <Field label="Adresse" htmlFor={fieldId('address')} className="sm:col-span-2"
        hint="Recherchez une adresse française avec la Géoplateforme IGN, ou saisissez les coordonnées du lieu.">
        <Input id={fieldId('address')} value={location.address} maxLength={500} describedBy={`${fieldId('address')}-hint`}
          onChange={event => onChange({ ...location, address: event.target.value })} />
        <Button className="self-start" size="petit" variant="secondaire" disabled={loading || location.address.trim().length < 3}
          onClick={() => void findAddress()}>{loading ? 'Recherche en cours…' : 'Rechercher l’adresse'}</Button>
      </Field>
      {addressSearch?.error && <p role="alert" className="sm:col-span-2">{addressSearch.error}</p>}
      {addressSearch?.results?.length === 0 && <p role="status" className="sm:col-span-2">Adresse introuvable. Précisez-la ou saisissez les coordonnées.</p>}
      {!!addressSearch?.results?.length && <ul aria-label="Adresses trouvées" className="grid gap-2 sm:col-span-2">
        {addressSearch.results.map(({ label, latitude, longitude }) => (
          <li key={`${label}-${latitude}-${longitude}`}>
            <Button size="petit" variant="secondaire" onClick={() => {
              onChange({ ...location, address: label, latitude, longitude })
              setSearch(undefined)
            }}>{label}</Button>
          </li>
        ))}
      </ul>}
      {([['latitude', 'Latitude', 90], ['longitude', 'Longitude', 180]] as const).map(([key, label, max]) => (
        <Field key={key} label={label} htmlFor={fieldId(key)} error={key === 'latitude' ? error : undefined}>
          <Input id={fieldId(key)} type="number" min={-max} max={max} step="any" value={location[key] ?? ''}
            invalid={Boolean(error)} describedBy={error ? `${fieldId('latitude')}-err` : undefined}
            onChange={event => {
              const value = event.target.valueAsNumber
              onChange({ ...location, [key]: Number.isFinite(value) ? value : null })
            }} />
        </Field>
      ))}
      <Field label="Description ou indication pratique" htmlFor={fieldId('description')} className="sm:col-span-2">
        <Textarea id={fieldId('description')} value={location.description} maxLength={4000}
          onChange={event => onChange({ ...location, description: event.target.value })} />
      </Field>
      <div className="sm:col-span-2"><LocationMap location={location} /></div>
    </div>
  )
}
