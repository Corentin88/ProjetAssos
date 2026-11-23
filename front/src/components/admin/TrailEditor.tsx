import { useEffect, useRef, useState } from 'react'
import type { GpxMedia, Trail, TrailFields } from '../../types'
import { authErrorMessage, protectedRequest } from '../../lib/auth'
import { useResource } from '../../lib/community'
import { difficulties, TrailMap } from '../content/TrailDetails'
import { Button, Field, Input, Select, Textarea } from '../ui/form'

export const emptyTrail: TrailFields = {
  name: '', description: '', distance: 0, duration: 0,
  difficulty: 'EASY', elevationGain: 0, elevationLoss: 0,
}
const numberFields = [
  ['distance', 'Distance (km)', 'any'], ['duration', 'Durée (minutes)', '1'],
  ['elevationGain', 'Dénivelé positif (m)', 'any'], ['elevationLoss', 'Dénivelé négatif (m)', 'any'],
] as const

export function TrailEditor({ trail, file, onChange, onFile, disabled, errors }: {
  trail: (TrailFields & { gpxMediaId?: string }) | null
  file: File | null
  onChange: (trail: (TrailFields & { gpxMediaId?: string }) | null) => void
  onFile: (file: File | null) => void
  disabled: boolean
  errors: Record<string, string>
}) {
  const { data: files, error: filesError, refresh } = useResource<GpxMedia[]>(trail ? '/admin/content/gpx' : undefined, true)
  const selectedId = trail?.gpxMediaId
  const fileInput = useRef<HTMLInputElement>(null)
  const { data: storedPreview, error: storedError } = useResource<Trail['mapPreview']>(
    selectedId && !file ? `/admin/content/gpx/${selectedId}/preview` : undefined, true,
  )
  const [importPreview, setImportPreview] = useState<{
    file: File; data?: Trail['mapPreview']; error?: string
  }>()
  useEffect(() => {
    if (!file || !file.size || file.size > 5 * 1024 * 1024) return
    let actif = true
    const body = new FormData()
    body.set('file', file)
    protectedRequest<Trail['mapPreview']>('/admin/content/gpx/preview', 'POST', body).then(
      data => { if (actif) setImportPreview({ file, data }) },
      error => { if (actif) setImportPreview({ file, error: authErrorMessage(error) }) },
    )
    return () => { actif = false }
  }, [file])

  const preview = file ? (importPreview?.file === file ? importPreview.data : undefined) : storedPreview
  const fileError = errors['trail-file'] || (file && (!file.size || file.size > 5 * 1024 * 1024)
    ? 'Sélectionnez un fichier GPX non vide de 5 Mio maximum.'
    : file && importPreview?.file === file ? importPreview.error : undefined)

  return (
    <section aria-labelledby="edition-parcours" className="carte p-6">
      <h2 id="edition-parcours" className="text-xl text-forest">Parcours de randonnée</h2>
      {!trail ? (
        <Button className="mt-3" variant="secondaire" disabled={disabled} onClick={() => onChange(emptyTrail)}>Ajouter un parcours</Button>
      ) : (
        <fieldset disabled={disabled} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Nom du parcours" htmlFor="trail-name" required error={errors['trail-name']}>
            <Input id="trail-name" maxLength={255} value={trail.name}
              invalid={Boolean(errors['trail-name'])} describedBy={errors['trail-name'] ? 'trail-name-err' : undefined}
              onChange={event => onChange({ ...trail, name: event.target.value })} />
          </Field>
          <Field label="Difficulté" htmlFor="trail-difficulty" required>
            <Select id="trail-difficulty" value={trail.difficulty}
              onChange={event => onChange({ ...trail, difficulty: event.target.value as TrailFields['difficulty'] })}>
              {Object.entries(difficulties).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          {numberFields.map(([key, label, step]) => (
            <Field key={key} label={label} htmlFor={`trail-${key}`} required error={errors[`trail-${key}`]}>
              <Input id={`trail-${key}`} type="number" min={0} step={step}
                value={Number.isNaN(trail[key]) ? '' : trail[key]}
                invalid={Boolean(errors[`trail-${key}`])}
                describedBy={errors[`trail-${key}`] ? `trail-${key}-err` : undefined}
                onChange={event => onChange({ ...trail, [key]: event.target.valueAsNumber })} />
            </Field>
          ))}
          <Field label="Description du parcours" htmlFor="trail-description">
            <Textarea id="trail-description" maxLength={4000} value={trail.description}
              onChange={event => onChange({ ...trail, description: event.target.value })} />
          </Field>
          {!!files?.length && <Field label="Fichier GPX existant" htmlFor="trail-media">
            <Select id="trail-media" value={!file ? selectedId ?? '' : ''}
              onChange={event => {
                if (fileInput.current) fileInput.current.value = ''
                onFile(null)
                onChange({ ...trail, gpxMediaId: event.target.value || undefined })
              }}>
              <option value="">Sélectionner un fichier</option>
              {selectedId && !files.some(item => item.id === selectedId) && (
                <option value={selectedId}>Fichier GPX associé</option>
              )}
              {files.map(item => <option key={item.id} value={item.id}>{item.nom}</option>)}
            </Select>
          </Field>}
          {filesError && <div className="sm:col-span-2">
            <p role="alert">Impossible de charger les fichiers GPX existants.</p>
            <Button variant="secondaire" size="petit" onClick={() => void refresh()}>Réessayer</Button>
          </div>}
          <Field label="Fichier GPX à importer" htmlFor="trail-file" required={!trail.gpxMediaId} error={fileError}
            hint={file?.name ?? (trail.gpxMediaId ? 'Un fichier GPX est associé au parcours.' : 'Fichier .gpx de 5 Mio maximum.')}>
            <Input ref={fileInput} key={selectedId ?? ''} id="trail-file" type="file" accept=".gpx,application/gpx+xml"
              invalid={Boolean(fileError)} describedBy={`trail-file-hint${fileError ? ' trail-file-err' : ''}`}
              onChange={event => onFile(event.target.files?.[0] ?? null)} />
          </Field>
          <div className="sm:col-span-2">
            {preview ? <TrailMap segments={preview.segments} />
              : storedError ? <p role="alert">Aperçu du tracé indisponible. Essayez un autre fichier GPX.</p>
              : (file || selectedId) && !fileError ? <p role="status">Chargement de l’aperçu du tracé…</p>
              : null}
          </div>
          <div className="sm:col-span-2">
            <Button variant="danger" onClick={() => { onFile(null); onChange(null) }}>Retirer le parcours</Button>
          </div>
        </fieldset>
      )}
    </section>
  )
}
