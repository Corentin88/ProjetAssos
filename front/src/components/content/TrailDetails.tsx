import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Clock3, Download, Mountain, Route } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ElevationSource, Trail, TrailBlockFields, TrailMapSettings, TrailVisibility } from '../../types'
import { authErrorMessage, protectedRequest, useCurrentUser } from '../../lib/auth'
import { formatDateTime, formatNombre } from '../../lib/format'
import { defaultTrailMapSettings, defaultTrailVisibility } from '../../lib/mapBlocks'
import { Alert } from '../ui/feedback'
import { Button, buttonClasses } from '../ui/form'
import { TrailMap } from './TrailMap'

export const difficulties = { EASY: 'Facile', MEDIUM: 'Intermédiaire', HARD: 'Difficile' } as const

function elapsedTime(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds / 60) % 60
  const remainder = seconds % 60
  return [hours && `${hours} h`, minutes && `${minutes} min`, remainder && `${remainder} s`]
    .filter(Boolean).join(' ') || '0 s'
}

type TrailMeasure = { label: string; value: ReactNode; icon?: LucideIcon }

function TrailMeasures({ label, measures, primary = false }: {
  label: string
  measures: TrailMeasure[]
  primary?: boolean
}) {
  const visible = measures.filter(measure => measure.value != null)
  if (!visible.length) return null
  return (
    <div className={primary ? '' : 'rounded-xl border border-line bg-white px-3 py-2.5 sm:px-4'}>
      {!primary && <h3 className="mb-2 text-base font-bold text-forest">{label}</h3>}
      <dl aria-label={label} className={`grid min-w-0 gap-2 sm:gap-4 ${visible.length > 1 ? (primary ? 'grid-cols-2' : 'sm:grid-cols-2') : ''}`}>
        {visible.map(({ label: name, value, icon: Icon }) => (
          <div key={name} className={primary ? 'min-w-0 rounded-xl bg-leaf-pale p-2.5 sm:p-4' : 'min-w-0'}>
            <dt className="flex items-center gap-2 text-sm font-semibold text-bark">
              {Icon && <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-forest" />}
              {name}
            </dt>
            <dd className={`m-0 mt-1 text-forest ${primary ? 'text-lg font-bold leading-tight sm:text-2xl' : 'font-semibold'}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function TrailDetails({ trail, mapPreview, visibility = defaultTrailVisibility,
  mapSettings = defaultTrailMapSettings, mediaId, gpxAvailable, elevationSource, articleId, blockId }: {
  trail: Trail | TrailBlockFields
  mapPreview?: Trail['mapPreview'] | null
  visibility?: TrailVisibility
  mapSettings?: TrailMapSettings
  mediaId?: string
  gpxAvailable?: boolean
  elevationSource?: ElevationSource
  articleId?: string
  blockId?: string
}) {
  const user = useCurrentUser()
  const location = useLocation()
  const headingId = useId()
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const download = async () => {
    setDownloading(true)
    setError('')
    try {
      const path = blockId ? `/articles/${articleId}/blocks/${blockId}/gpx` : `/articles/${articleId}/gpx`
      const file = await protectedRequest<Blob>(path, 'GET', undefined, true)
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = 'parcours.gpx'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { setError(authErrorMessage(error)) }
    finally { setDownloading(false) }
  }

  const route = 'durationSeconds' in trail
    ? trail : { ...trail, durationSeconds: trail.duration * 60, estimatedDurationSeconds: null, departureAt: null, arrivalAt: null, elevationMin: null, elevationMax: null }
  const preview = mapPreview ?? ('mapPreview' in trail ? trail.mapPreview : null)
  const gpxId = mediaId ?? ('gpxMediaId' in trail ? trail.gpxMediaId : undefined)
  const hasTrace = Boolean(preview?.segments.some(segment => segment.length >= 2))
  const canDownload = gpxAvailable ?? (hasTrace && Boolean(articleId || gpxId))
  const mapPath = articleId
    ? `/articles/${articleId}${blockId ? `/blocks/${blockId}` : ''}/gpx/map`
    : gpxId ? `/admin/content/gpx/${gpxId}/preview` : undefined
  const mesure = (enabled: boolean, value: number | null, unit: string, sign = '') =>
    enabled && value != null ? `${value === 0 ? '' : sign}${formatNombre(value)} ${unit}` : null
  const date = (enabled: boolean, value: string | null) =>
    enabled && value ? <time dateTime={value}>{formatDateTime(value)}</time> : null
  const primary = [
    { label: 'Distance', value: mesure(visibility.distance, route.distance, 'km'), icon: Route },
    { label: 'Durée écoulée', value: visibility.duration && route.durationSeconds != null ? elapsedTime(route.durationSeconds) : null, icon: Clock3 },
    { label: 'Durée de marche estimée', value: visibility.estimatedDuration && route.estimatedDurationSeconds != null
      ? elapsedTime(route.estimatedDurationSeconds) : null, icon: Clock3 },
  ]
  const times = [
    { label: 'Départ', value: date(visibility.dates && visibility.departure !== false, route.departureAt) },
    { label: 'Arrivée', value: date(visibility.dates && visibility.arrival !== false, route.arrivalAt) },
  ]
  const elevation = [
    { label: 'Dénivelé positif (D+)', value: mesure(visibility.elevation && visibility.elevationGain !== false, route.elevationGain, 'm', '+') },
    { label: 'Dénivelé négatif (D−)', value: mesure(visibility.elevation && visibility.elevationLoss !== false, route.elevationLoss, 'm', '−') },
  ]
  const arrondiAltitude = (value: number | null) => value == null ? null : Math.round(value)
  const altitude = [
    { label: 'Altitude minimale', value: mesure(visibility.altitude && visibility.elevationMin !== false, arrondiAltitude(route.elevationMin), 'm') },
    { label: 'Altitude maximale', value: mesure(visibility.altitude && visibility.elevationMax !== false, arrondiAltitude(route.elevationMax), 'm') },
  ]

  return (
    <section aria-labelledby={headingId} className="carte mt-6 grid min-w-0 gap-4 p-4 sm:p-6">
      <header className="min-w-0 [overflow-wrap:anywhere]">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
          <h2 id={headingId} className="flex min-w-0 items-start gap-2 text-xl text-forest">
            <Mountain aria-hidden="true" className="h-6 w-6 shrink-0" />
            {route.name || 'Parcours de randonnée'}
          </h2>
          {visibility.difficulty && route.difficulty && (
            <span className="rounded-full border border-line bg-sand px-2.5 py-1 text-sm font-semibold text-forest">
              <span className="sr-only">Difficulté </span>{difficulties[route.difficulty]}
            </span>
          )}
        </div>
        {visibility.description && route.description && <p className="mt-2 whitespace-pre-line">{route.description}</p>}
      </header>
      <TrailMeasures label="Statistiques principales" measures={primary} primary />
      <TrailMeasures label="Horaires" measures={times} />
      <TrailMeasures label="Dénivelés" measures={elevation} />
      <TrailMeasures label="Altitudes" measures={altitude} />
      {(elevationSource === 'ign' || elevationSource === 'mixed') &&
        <p className="text-sm text-mist">{elevationSource === 'mixed' ? 'Altitudes GPX complétées par l’IGN RGE ALTI.' : 'Altitudes estimées à partir du modèle IGN RGE ALTI.'}</p>}
      {visibility.map && (hasTrace || gpxAvailable || gpxId) && <TrailMap preview={preview} path={mapPath} secure={!articleId}
        settings={mapSettings} showDistance={visibility.distance} showTimes={visibility.dates}
        showAltitude={visibility.altitude || mapSettings.profile} />}
      {visibility.map && !articleId && !hasTrace && !gpxId && <p>Associez un fichier GPX dans l’éditeur pour afficher le tracé.</p>}
      {visibility.download && canDownload && blockId && !articleId && (
        <Button className="mt-4" disabled><Download aria-hidden="true" className="h-5 w-5" /> Télécharger le parcours GPX</Button>
      )}
      {visibility.download && canDownload && articleId && <div className="mt-4">
        {user?.statut === 'actif' ? (
          <Button onClick={() => void download()} disabled={downloading}>
            <Download aria-hidden="true" className="h-5 w-5" /> Télécharger le parcours GPX
          </Button>
        ) : !user ? (
          <Link to="/connexion" state={{ from: location.pathname + location.search + location.hash }}
            className={buttonClasses('secondaire')}>Se connecter pour télécharger le GPX</Link>
        ) : <p>Le téléchargement GPX est réservé aux comptes actifs.</p>}
        {error && <Alert kind="erreur" title="Téléchargement impossible">{error}</Alert>}
      </div>}
    </section>
  )
}
