import type { GpxMedia, TrailFields } from '../../types'
import { useResource } from '../../lib/community'
import { difficulties } from '../content/TrailDetails'
import { Button, Field, Input, Select, Textarea } from '../ui/form'

export const emptyTrail: TrailFields = {
  name: '', description: '', distance: 0, duration: 0,
  difficulty: 'EASY', elevationGain: 0, elevationLoss: 0,
}
const numberFields = [
  ['distance', 'Distance (km)', 'any'], ['duration', 'Durée (minutes)', '1'],
  ['elevationGain', 'Dénivelé positif (m)', 'any'], ['elevationLoss', 'Dénivelé négatif (m)', 'any'],
] as const

export function TrailEditor({ trail, file, onChange, onFile, disabled }: {
  trail: (TrailFields & { gpxMediaId?: string }) | null
  file: File | null
  onChange: (trail: (TrailFields & { gpxMediaId?: string }) | null) => void
  onFile: (file: File | null) => void
  disabled: boolean
}) {
  const { data: files } = useResource<GpxMedia[]>(trail ? '/admin/content/gpx' : undefined, true)
  return (
    <section aria-labelledby="edition-parcours" className="carte p-6">
      <h2 id="edition-parcours" className="text-xl text-forest">Parcours de randonnée</h2>
      {!trail ? (
        <Button className="mt-3" variant="secondaire" disabled={disabled} onClick={() => onChange(emptyTrail)}>Ajouter un parcours</Button>
      ) : (
        <fieldset disabled={disabled} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Nom du parcours" htmlFor="trail-name" required>
            <Input id="trail-name" maxLength={255} value={trail.name}
              onChange={event => onChange({ ...trail, name: event.target.value })} />
          </Field>
          <Field label="Difficulté" htmlFor="trail-difficulty" required>
            <Select id="trail-difficulty" value={trail.difficulty}
              onChange={event => onChange({ ...trail, difficulty: event.target.value as TrailFields['difficulty'] })}>
              {Object.entries(difficulties).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          {numberFields.map(([key, label, step]) => (
            <Field key={key} label={label} htmlFor={`trail-${key}`} required>
              <Input id={`trail-${key}`} type="number" min={0} step={step} value={trail[key]}
                onChange={event => onChange({ ...trail, [key]: Number(event.target.value) })} />
            </Field>
          ))}
          <Field label="Description du parcours" htmlFor="trail-description">
            <Textarea id="trail-description" maxLength={4000} value={trail.description}
              onChange={event => onChange({ ...trail, description: event.target.value })} />
          </Field>
          {!!files?.length && <Field label="Fichier GPX existant" htmlFor="trail-media">
            <Select id="trail-media" value={files.some(item => item.id === trail.gpxMediaId) ? trail.gpxMediaId : ''}
              onChange={event => { onFile(null); onChange({ ...trail, gpxMediaId: event.target.value || undefined }) }}>
              <option value="">Sélectionner un fichier</option>
              {files.map(item => <option key={item.id} value={item.id}>{item.nom}</option>)}
            </Select>
          </Field>}
          <Field label="Fichier GPX à importer" htmlFor="trail-file" required={!trail.gpxMediaId}
            hint={file?.name ?? (trail.gpxMediaId ? 'Un fichier GPX est associé au parcours.' : 'Fichier .gpx de 5 Mio maximum.')}>
            <Input key={trail.gpxMediaId ?? ''} id="trail-file" type="file" accept=".gpx,application/gpx+xml"
              onChange={event => onFile(event.target.files?.[0] ?? null)} />
          </Field>
          <div className="sm:col-span-2">
            <Button variant="danger" onClick={() => { onFile(null); onChange(null) }}>Retirer le parcours</Button>
          </div>
        </fieldset>
      )}
    </section>
  )
}
