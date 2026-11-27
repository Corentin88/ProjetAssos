import { useRef, useState } from 'react'
import type { Block, GpxPreview, TrailBlockFields, TrailMeasurements, TrailVisibility } from '../../types'
import { ApiError, authErrorMessage, protectedRequest } from '../../lib/auth'
import { useResource } from '../../lib/community'
import { toInputDateTime } from '../../lib/format'
import { defaultTrailMapSettings, defaultTrailVisibility, emptyTrail } from '../../lib/mapBlocks'
import { difficulties } from '../content/TrailDetails'
import { TrailMap } from '../content/TrailMap'
import { Button, Field, Input, Select, Textarea } from '../ui/form'
import { MediaPicker } from './MediaPicker'

const numberFields = [
  ['distance', 'Distance (km)', 0, 'any'],
  ['durationSeconds', 'Durée écoulée (secondes)', 0, 1],
  ['estimatedDurationSeconds', 'Durée de marche estimée (secondes)', 0, 1],
  ['elevationGain', 'Dénivelé positif (m)', 0, 'any'],
  ['elevationLoss', 'Dénivelé négatif (m)', 0, 'any'],
  ['elevationMin', 'Altitude minimale (m)', undefined, 'any'],
  ['elevationMax', 'Altitude maximale (m)', undefined, 'any'],
] as const
const dateFields = [['departureAt', 'Départ'], ['arrivalAt', 'Arrivée']] as const
const visibilityLabels = {
  distance: 'Distance', duration: 'Durée écoulée', dates: 'Dates et heures', elevation: 'Dénivelés',
  altitude: 'Altitudes', difficulty: 'Difficulté', description: 'Description', map: 'Carte', download: 'Téléchargement GPX',
} satisfies Partial<Record<keyof TrailVisibility, string>>
const pairedVisibility = [
  ['dates', 'Horaires', [['departure', 'Départ'], ['arrival', 'Arrivée']]],
  ['elevation', 'Dénivelés', [['elevationGain', 'Dénivelé positif'], ['elevationLoss', 'Dénivelé négatif']]],
  ['altitude', 'Altitudes', [['elevationMin', 'Altitude minimale'], ['elevationMax', 'Altitude maximale']]],
] as const
const measurementKeys = [...numberFields.map(([key]) => key), ...dateFields.map(([key]) => key)] as const

function prefillTrail(trail: TrailBlockFields, next: TrailMeasurements, previous?: TrailMeasurements): TrailBlockFields {
  const measurements = Object.fromEntries(measurementKeys.map(key => [
    key, trail[key] == null || trail[key] === previous?.[key] ? next[key] ?? null : trail[key],
  ]))
  return {
    ...trail,
    ...measurements,
    name: !trail.name.trim() || trail.name === previous?.name ? next.name || trail.name : trail.name,
  }
}

function getGpxPreview(id: string) {
  return protectedRequest<GpxPreview>(`/admin/content/gpx/${id}/preview`)
}

export function TrailEditor({ block, onChange, onBusy, errors }: {
  block: Block
  onChange: (patch: Partial<Block>) => void
  onBusy?: (id: string, busy: boolean) => void
  errors?: Record<string, string>
}) {
  const trail = block.trail ?? emptyTrail
  const visibility = block.visibility ?? defaultTrailVisibility
  const settings = block.mapSettings ?? defaultTrailMapSettings
  const fieldId = (field: string) => `blk-${block.id}-${field}`
  const [failedFile, setFailedFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [imported, setImported] = useState<{ id: string; name: string }>()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [analysis, setAnalysis] = useState<{ id: string; preview: GpxPreview }>()
  const fileInput = useRef<HTMLInputElement>(null)
  const pendingUpload = useRef<{ file: File; id: string }>()
  const lastExtraction = useRef<{ id: string; details: TrailMeasurements }>()

  async function chooseGpx(load: () => Promise<{ id: string; preview: GpxPreview }>, localFile?: File, selectedName?: string) {
    setError('')
    setFailedFile(null)
    setBusy(true)
    onBusy?.(block.id, true)
    try {
      const previous = lastExtraction.current
      const priorDetails = block.mediaId && previous?.id !== block.mediaId
        ? await getGpxPreview(block.mediaId).then(value => value.details).catch(() => undefined)
        : previous?.details
      const { id, preview } = await load()
      if (!preview?.details || !preview.segments?.some(segment => segment.length >= 2))
        throw new ApiError(502, 'Le serveur n’a pas renvoyé de tracé GPX exploitable. Réessayez.')
      onChange({
        mediaId: id,
        mapPreview: { segments: preview.segments, samples: preview.samples },
        trail: prefillTrail(trail, preview.details, priorDetails),
      })
      lastExtraction.current = { id, details: preview.details }
      setAnalysis({ id, preview })
      const name = localFile?.name ?? selectedName
      if (name) setImported({ id, name })
      if (localFile) pendingUpload.current = undefined
      else if (fileInput.current) fileInput.current.value = ''
    } catch (error) {
      setFailedFile(localFile ?? null)
      setError(`${localFile ? 'Import GPX impossible.' : 'Association du GPX impossible.'} ${authErrorMessage(error)}`)
    } finally {
      setBusy(false)
      onBusy?.(block.id, false)
    }
  }

  function upload(file: File) {
    if (!file.size || file.size > 5 * 1024 * 1024) {
      setFailedFile(null)
      setError('Sélectionnez un fichier GPX non vide de 5 Mio maximum.')
      return
    }
    void chooseGpx(async () => {
      if (pendingUpload.current?.file === file) {
        const { id } = pendingUpload.current
        return { id, preview: await getGpxPreview(id) }
      }
      const body = new FormData()
      body.set('file', file)
      const { id, preview } = await protectedRequest<{ id: string; preview?: GpxPreview }>('/admin/content/gpx', 'POST', body)
      pendingUpload.current = { file, id }
      return { id, preview: preview?.details ? preview : await getGpxPreview(id) }
    }, file)
  }

  const gpxError = error || errors?.[fieldId('file')]
  const nameError = errors?.[fieldId('name')]
  const localName = imported?.id === block.mediaId ? imported?.name : undefined
  const { data: associatedFile } = useResource<{ nom: string }>(
    block.mediaId && !localName ? `/admin/content/media/${block.mediaId}` : undefined, true,
  )
  const associatedName = localName ?? associatedFile?.nom
  const localAnalysis = analysis?.id === block.mediaId ? analysis?.preview : undefined
  const { data: savedAnalysis, error: analysisError } = useResource<GpxPreview>(
    block.mediaId && !localAnalysis ? `/admin/content/gpx/${block.mediaId}/preview` : undefined, true,
  )
  const altitude = localAnalysis ?? savedAnalysis

  return (
    <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2" disabled={busy} aria-busy={busy}>
      <legend className="sr-only">Données du parcours</legend>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondaire" onClick={() => setPickerOpen(true)}>Choisir un GPX</Button>
        {block.mediaId && <Button variant="blanc" onClick={() => {
            setError('')
            setFailedFile(null)
            lastExtraction.current = undefined
            if (fileInput.current) fileInput.current.value = ''
            onChange({ mediaId: undefined, mapPreview: null })
        }}>Retirer le GPX</Button>}
      </div>
      <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} titre="Choisir un parcours GPX"
        type="GPX" selectionActive={block.mediaId} onChoose={item => {
          void chooseGpx(async () => ({ id: item.id, preview: await getGpxPreview(item.id) }), undefined, item.nom)
        }} />
      <Field label="Fichier GPX à importer" htmlFor={fieldId('file')} error={gpxError}
        hint="La sélection lance l’import et préremplit les mesures disponibles. 5 Mio maximum."
      >
        <Input ref={fileInput} id={fieldId('file')} type="file" accept=".gpx,application/gpx+xml"
          invalid={Boolean(gpxError)} describedBy={`${fieldId('file')}-hint${gpxError ? ` ${fieldId('file')}-err` : ''}`}
          onChange={event => {
            const file = event.target.files?.[0]
            if (file) upload(file)
          }} />
        {failedFile && <Button variant="secondaire" size="petit" onClick={() => upload(failedFile)}>Réessayer l’import GPX</Button>}
        {block.mediaId && <p role="status">{associatedName ? `Fichier associé : ${associatedName}` : 'Fichier GPX associé.'}</p>}
      </Field>
      {busy && <p className="sm:col-span-2" role="status">Analyse du GPX et vérification des altitudes IGN…</p>}
      {block.mediaId && !busy && <div className="space-y-2 sm:col-span-2">
        <p role="status">
          {analysisError ? 'Analyse du GPX indisponible.' : !altitude ? 'Chargement de l’analyse du GPX…'
            : altitude.enrichment === 'failed' ? 'Enrichissement IGN indisponible. Le GPX reste associé.'
            : altitude.enrichment === 'partial' ? 'Couverture IGN partielle. Certaines altitudes restent manquantes.'
            : altitude.enrichment === 'pending' ? 'Altitudes incomplètes. Enrichissement IGN disponible.'
            : 'Analyse altimétrique terminée.'}
        </p>
        {altitude && <>
          <p className="text-sm text-mist">{altitude.elevationSource === 'mixed' ? 'Altitudes du GPX complétées par l’IGN RGE ALTI.'
            : altitude.elevationSource === 'ign' ? 'Altitudes calculées à partir du modèle de terrain IGN RGE ALTI.'
            : altitude.elevationSource === 'gpx' ? 'Altitudes extraites du GPX.' : 'Aucune altitude disponible.'}
            {altitude.details.departureAt === null && ' Aucun horaire dans le fichier.'}</p>
          {altitude.enrichment !== 'complete' && <Button variant="secondaire" size="petit" onClick={() => {
            const id = block.mediaId
            if (id) void chooseGpx(async () => ({
              id, preview: await protectedRequest<GpxPreview>(`/admin/content/gpx/${id}/elevation`, 'POST'),
            }))
          }}>{altitude.enrichment === 'pending' ? 'Enrichir les altitudes avec l’IGN' : 'Réessayer l’enrichissement altimétrique'}</Button>}
        </>}
      </div>}
      <Field label="Nom du parcours" htmlFor={fieldId('name')} required error={nameError}>
        <Input id={fieldId('name')} value={trail.name} maxLength={255} invalid={Boolean(nameError)}
          describedBy={nameError ? `${fieldId('name')}-err` : undefined}
          onChange={event => onChange({ trail: { ...trail, name: event.target.value } })} />
      </Field>
      <Field label="Difficulté" htmlFor={fieldId('difficulty')}>
        <Select id={fieldId('difficulty')} value={trail.difficulty ?? ''}
          onChange={event => onChange({ trail: { ...trail, difficulty: (event.target.value || null) as TrailBlockFields['difficulty'] } })}>
          <option value="">Non renseignée</option>
          {Object.entries(difficulties).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </Select>
      </Field>
      {numberFields.map(([key, label, min, step]) => {
        const id = fieldId(key)
        const error = errors?.[id]
        return (
          <Field key={key} label={label} htmlFor={id} error={error}>
            <Input id={id} type="number" min={min} step={step} value={trail[key] ?? ''}
              invalid={Boolean(error)} describedBy={error ? `${id}-err` : undefined} onChange={event => {
                const value = event.target.valueAsNumber
                onChange({ trail: { ...trail, [key]: Number.isFinite(value) ? value : null } })
              }} />
          </Field>
        )
      })}
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" className="h-5 w-5 accent-forest" checked={visibility.estimatedDuration ?? false}
          onChange={event => onChange({ visibility: { ...visibility, estimatedDuration: event.target.checked } })} />
        Afficher la durée de marche estimée (5 km/h sur le plat + 1 h par 600 m de montée)
      </label>
      {dateFields.map(([key, label]) => {
        const id = fieldId(key)
        const error = errors?.[id]
        const timestamp = trail[key]
        return (
          <Field key={key} label={`${label} (heure locale)`} htmlFor={id} error={error}>
            <Input id={id} type="datetime-local" step={1}
              value={timestamp ? `${toInputDateTime(timestamp)}:${String(new Date(timestamp).getSeconds()).padStart(2, '0')}` : ''}
              invalid={Boolean(error)} describedBy={error ? `${id}-err` : undefined}
              onChange={event => {
                const date = new Date(event.target.value)
                onChange({ trail: { ...trail, [key]: Number.isFinite(date.getTime()) ? date.toISOString() : null } })
              }} />
          </Field>
        )
      })}
      <Field label="Description du parcours" htmlFor={fieldId('description')} className="sm:col-span-2">
        <Textarea id={fieldId('description')} value={trail.description} maxLength={4000}
          onChange={event => onChange({ trail: { ...trail, description: event.target.value } })} />
      </Field>
      <fieldset className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
        <legend className="mb-2 font-bold">Informations visibles dans l’article</legend>
        {(Object.keys(visibilityLabels) as (keyof typeof visibilityLabels)[]).map(key => (
          <label key={key} className="flex min-h-11 items-center gap-2">
            <input type="checkbox" checked={visibility[key]} className="h-5 w-5 accent-forest"
              onChange={event => onChange({ visibility: { ...visibility, [key]: event.target.checked } })} />
            {visibilityLabels[key]}
          </label>
        ))}
        {pairedVisibility.map(([group, label, fields]) => (
          <fieldset key={group} className="rounded-lg border border-line px-3" disabled={!visibility[group]}>
            <legend className="px-1 font-bold">{label}</legend>
            {fields.map(([key, fieldLabel]) => (
              <label key={key} className="flex min-h-11 items-center gap-2">
                <input type="checkbox" checked={visibility[key] !== false} className="h-5 w-5 accent-forest disabled:opacity-50"
                  onChange={event => onChange({ visibility: { ...visibility, [key]: event.target.checked } })} />
                {fieldLabel}
              </label>
            ))}
          </fieldset>
        ))}
      </fieldset>
      <fieldset className="grid gap-2 sm:col-span-2">
        <legend className="mb-2 font-bold">Options de la carte du parcours</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" checked={settings.slopes} className="h-5 w-5 accent-forest"
            onChange={event => onChange({ mapSettings: { ...settings, slopes: event.target.checked,
              initialMode: event.target.checked ? settings.initialMode : 'classic' } })} />
          Autoriser les pentes en couleur
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" checked={settings.profile} className="h-5 w-5 accent-forest"
            onChange={event => onChange({ mapSettings: { ...settings, profile: event.target.checked } })} />
          Autoriser le profil altimétrique
        </label>
        <Field label="Mode initial de la carte" htmlFor={fieldId('map-mode')} required>
          <Select id={fieldId('map-mode')} value={settings.initialMode}
            onChange={event => onChange({ mapSettings: { ...settings, initialMode: event.target.value === 'slopes' ? 'slopes' : 'classic' } })}>
            <option value="classic">Tracé classique</option>
            <option value="slopes" disabled={!settings.slopes}>Pentes en couleur</option>
          </Select>
        </Field>
      </fieldset>
      {(block.mediaId || block.mapPreview) && <div className="sm:col-span-2">
        <TrailMap key={`${block.mediaId}-${settings.initialMode}-${settings.slopes}-${settings.profile}`}
          preview={block.mapPreview} path={block.mediaId ? `/admin/content/gpx/${block.mediaId}/preview` : undefined} secure
          settings={settings} showDistance={visibility.distance} showTimes={visibility.dates}
          showAltitude={visibility.altitude || settings.profile} />
      </div>}
    </fieldset>
  )
}
