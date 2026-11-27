import { useEffect, useId, useMemo, useState } from 'react'
import type { LatLngBoundsLiteral, LatLngTuple, LeafletMouseEvent } from 'leaflet'
import type { TrailMapPreview, TrailMapSettings, TrailSample } from '../../types'
import { useResource } from '../../lib/community'
import { formatNombre } from '../../lib/format'
import { defaultTrailMapSettings } from '../../lib/mapBlocks'
import { Button } from '../ui/form'
import { TrailProfile } from './TrailProfile'
import { OsmMap } from './OsmMap'
import type { OsmMapHandle } from './OsmMap'
const slopeStyles = [
  ['down', '#15803D', 'Descente'],
  ['flat', '#EAB308', 'Plat ou pente faible'],
  ['up', '#DC2626', 'Montée'],
  ['unknown', '#475569', 'Pente non calculable'],
] as const
const passageTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function routeGeometry(segments: TrailSample[][]) {
  let previousLongitude = segments[0][0].coordinates[1]
  const lines = segments.map(segment => segment.map(sample => {
    const [latitude, longitude] = sample.coordinates
    // Déplie les longitudes pour que le tracé reste continu à l’antiméridien.
    previousLongitude = longitude + 360 * Math.round((previousLongitude - longitude) / 360)
    const coordinates: LatLngTuple = [latitude, previousLongitude]
    return { sample, coordinates }
  }))
  const points = lines.flat()
  const latitudes = points.map(point => point.coordinates[0])
  const longitudes = points.map(point => point.coordinates[1])
  const bounds: LatLngBoundsLiteral = [
    [Math.min(...latitudes), Math.min(...longitudes)],
    [Math.max(...latitudes), Math.max(...longitudes)],
  ]
  const slopes: Record<(typeof slopeStyles)[number][0], LatLngTuple[][]> = { down: [], flat: [], up: [], unknown: [] }
  for (const line of lines) {
    let previousSlope: keyof typeof slopes | undefined
    for (let index = 1; index < line.length; index++) {
      const current = line[index]
      const start = line[index - 1].coordinates
      if (start[0] === current.coordinates[0] && start[1] === current.coordinates[1]) continue
      const slope = current.sample.slope ?? 'unknown'
      const group = slopes[slope]
      if (slope === previousSlope) group[group.length - 1].push(current.coordinates)
      else group.push([start, current.coordinates])
      previousSlope = slope
    }
  }
  return { points, bounds, slopes, lines: lines.map(line => line.map(point => point.coordinates)) }
}

export function TrailMap({ preview, path, secure = false, settings = defaultTrailMapSettings, showTimes = true, showAltitude = true, showDistance = true }: {
  preview?: TrailMapPreview | null
  path?: string
  secure?: boolean
  settings?: TrailMapSettings
  showTimes?: boolean
  showAltitude?: boolean
  showDistance?: boolean
}) {
  const { data, error } = useResource<Partial<TrailMapPreview>>(preview?.samples?.length ? undefined : path, secure)
  const samples = preview?.samples?.length ? preview.samples : data?.samples
  const segments = preview?.segments?.length ? preview.segments : data?.segments
  const route = useMemo(() => (samples?.length ? samples : (segments ?? []).map(segment => segment.map(coordinates => ({
    coordinates, distanceKm: null, elevation: null, time: null, slope: null, elevationBreak: true,
  })))).filter(segment => segment.length), [segments, samples])
  const pending = Boolean(path && !data && !samples?.length && !error)

  if (!route.length) return <p role={pending ? 'status' : undefined}>
    {pending ? 'Chargement du tracé GPX…' : 'Le tracé GPX est indisponible.'}
  </p>

  return <InteractiveTrail segments={route} pending={pending} unavailable={Boolean(error)}
    settings={settings} showTimes={showTimes} showAltitude={showAltitude} showDistance={showDistance} showMapLinks={secure} />
}

function InteractiveTrail({ segments, pending, unavailable, settings, showTimes, showAltitude, showDistance, showMapLinks }: {
  segments: TrailSample[][]
  pending: boolean
  unavailable: boolean
  settings: TrailMapSettings
  showTimes: boolean
  showAltitude: boolean
  showDistance: boolean
  showMapLinks: boolean
}) {
  const geometry = useMemo(() => routeGeometry(segments), [segments])
  const [handle, setMap] = useState<OsmMapHandle>()
  const map = handle?.map
  const [mode, setMode] = useState<TrailMapSettings['initialMode']>()
  const [profileOpen, setProfileOpen] = useState(false)
  const [selected, setSelected] = useState<TrailSample>()
  const profileId = useId()
  const selectedPoint = geometry.points.find(point => point.sample === selected)
  const canSlope = settings.slopes && geometry.points.some(point => point.sample.slope != null)
  const canProfile = settings.profile && geometry.points.some(point => point.sample.elevation != null)
  const colored = canSlope && (mode ?? settings.initialMode) === 'slopes'
  const unavailableFeatures = [
    settings.slopes && !canSlope ? 'les pentes en couleur' : '',
    settings.profile && !canProfile ? 'le profil altimétrique' : '',
  ].filter(Boolean)
  const [southWest, northEast] = geometry.bounds
  const latitude = (southWest[0] + northEast[0]) / 2
  const longitude = (((southWest[1] + northEast[1]) / 2 + 180) % 360 + 360) % 360 - 180

  useEffect(() => {
    map?.fitBounds(geometry.bounds, { padding: [32, 32], maxZoom: 17, animate: false })
  }, [map, geometry.bounds])

  useEffect(() => {
    if (!handle) return
    const { map, leaflet: { layerGroup, polyline } } = handle
    const layers = layerGroup().addTo(map)
    polyline(geometry.lines, { color: 'white', weight: colored ? 10 : 8, opacity: 0.95, interactive: false }).addTo(layers)
    if (colored) {
      // Le liseré foncé garde la pente jaune lisible sur les tuiles claires.
      polyline(geometry.lines, { color: '#334155', weight: 7, opacity: 0.95, interactive: false }).addTo(layers)
      for (const [key, color] of slopeStyles) {
        if (!geometry.slopes[key].length) continue
        polyline(geometry.slopes[key], { color, weight: 5, opacity: 1, interactive: false }).addTo(layers)
      }
    } else {
      polyline(geometry.lines, { color: '#16473a', weight: 5, opacity: 1, interactive: false }).addTo(layers)
    }
    return () => { layers.remove() }
  }, [handle, geometry, colored])

  useEffect(() => {
    if (!handle) return
    const { map, leaflet: { layerGroup, marker, divIcon } } = handle
    const layers = layerGroup().addTo(map)
    const endpoints = [
      { point: geometry.points[0], label: 'Départ', text: 'D', background: 'bg-forest', anchor: 26 },
      { point: geometry.points[geometry.points.length - 1], label: 'Arrivée', text: 'A', background: 'bg-violet-800', anchor: -2 },
    ]
    // Les lettres sont décalées de part et d’autre du point pour rester lisibles sur une boucle.
    for (const { point, label, text, background, anchor } of endpoints) {
      marker(point.coordinates, {
        title: label, alt: label, autoPanOnFocus: false,
        icon: divIcon({
          className: '',
          html: `<span class="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white ${background} font-bold text-white">${text}</span>`,
          iconSize: [24, 24], iconAnchor: [anchor, 12],
        }),
      }).on('click', () => setSelected(point.sample)).addTo(layers)
    }

    let dragging = false
    const dragStart = () => { dragging = true }
    const dragEnd = () => { dragging = false }
    function pick(event: LeafletMouseEvent) {
      if (dragging) return
      let target: TrailSample | undefined
      let nearest = 24 ** 2
      for (const point of geometry.points) {
        const projected = map.latLngToContainerPoint(point.coordinates)
        const distance = (projected.x - event.containerPoint.x) ** 2 + (projected.y - event.containerPoint.y) ** 2
        if (distance < nearest) { nearest = distance; target = point.sample }
      }
      if (target) setSelected(target)
    }
    map.on('dragstart', dragStart).on('dragend', dragEnd).on('mousemove', pick).on('click', pick)
    return () => {
      map.off('dragstart', dragStart).off('dragend', dragEnd).off('mousemove', pick).off('click', pick)
      layers.remove()
    }
  }, [handle, geometry])

  useEffect(() => {
    if (!handle || !selectedPoint) return
    const dot = handle.leaflet.circleMarker(selectedPoint.coordinates, {
      radius: 7, color: 'white', weight: 3, fillColor: '#18262d', fillOpacity: 1,
      interactive: false, className: 'trail-selected-point',
    }).addTo(handle.map)
    return () => { dot.remove() }
  }, [handle, selectedPoint])

  return (
    <figure className="min-w-0 rounded-xl border border-line bg-leaf-pale p-3">
      <OsmMap label="Carte du tracé de randonnée" className="h-72 sm:h-96" onReady={setMap} onKeyDown={event => {
        if (!event.shiftKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
        event.preventDefault()
        event.stopPropagation()
        const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
        const index = selectedPoint ? geometry.points.indexOf(selectedPoint) : direction > 0 ? -1 : geometry.points.length
        setSelected(geometry.points[Math.max(0, Math.min(geometry.points.length - 1, index + direction))].sample)
      }} />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="petit" variant="secondaire" aria-label="Zoom avant sur le parcours" disabled={!map} onClick={() => map?.zoomIn()}>+</Button>
        <Button size="petit" variant="secondaire" aria-label="Zoom arrière sur le parcours" disabled={!map} onClick={() => map?.zoomOut()}>−</Button>
        <Button size="petit" variant="secondaire" disabled={!map} onClick={() => map?.fitBounds(geometry.bounds, { padding: [32, 32], maxZoom: 17 })}>Recentrer</Button>
        {canSlope && <div role="group" aria-label="Mode d’affichage du tracé" className="flex flex-wrap gap-2">
          <Button size="petit" variant={colored ? 'secondaire' : 'primaire'} aria-pressed={!colored}
            onClick={() => setMode('classic')}>Tracé classique</Button>
          <Button size="petit" variant={colored ? 'primaire' : 'secondaire'} aria-pressed={colored}
            onClick={() => setMode('slopes')}>Pentes en couleur</Button>
        </div>}
      </div>
      <div className="mt-2 grid gap-2 text-sm">
        <p>D indique le départ, A l’arrivée. Glissez pour déplacer la carte. Au clavier, Maj + flèches sélectionne un point.</p>
        {colored && <ul aria-label="Légende des pentes" className="flex flex-wrap gap-x-4 gap-y-1">
          {slopeStyles.filter(([key]) => key !== 'unknown' || geometry.slopes.unknown.length).map(([key, color, label]) =>
            <li key={key} className="flex items-center gap-2"><span aria-hidden="true" className="h-2 w-5 rounded border border-slate-700" style={{ backgroundColor: color }} />{label}</li>)}
        </ul>}
        {pending && <p role="status">Chargement des mesures du tracé…</p>}
        {unavailable && <p>Mesures détaillées indisponibles. Le tracé classique reste accessible.</p>}
        {!pending && !unavailable && unavailableFeatures.length > 0 && (
          <p>Données GPX insuffisantes pour {unavailableFeatures.join(' et ')}.</p>
        )}
        {selectedPoint && (showDistance || showAltitude || (showTimes && selected?.time)) && <p className="flex min-h-10 flex-wrap items-center gap-x-4 rounded border border-line bg-white px-2">
          {showDistance && selected?.distanceKm != null && <span>{formatNombre(selected.distanceKm)} km du départ</span>}
          {showAltitude && <span>{selected?.elevation != null ? `${formatNombre(selected.elevation)} m d’altitude` : 'Altitude non renseignée'}</span>}
          {showTimes && selected?.time && <span>Passage à {passageTime.format(new Date(selected.time))}</span>}
        </p>}
        {showMapLinks && <>
          <a className="w-fit font-bold text-forest underline underline-offset-4"
            href={`https://www.openstreetmap.org/#map=14/${latitude}/${longitude}`}>Voir les environs sur OpenStreetMap</a>
          <a className="w-fit underline underline-offset-4" href="https://www.openstreetmap.org/fixthemap">Signaler un problème sur la carte</a>
        </>}
      </div>
      {canProfile && <Button className="mt-3" size="petit" variant="secondaire" aria-expanded={profileOpen}
        aria-controls={profileId} onClick={() => setProfileOpen(open => !open)}>
        {profileOpen ? 'Masquer le profil altimétrique' : 'Afficher le profil altimétrique'}
      </Button>}
      <div id={profileId} hidden={!canProfile || !profileOpen}>
        {canProfile && profileOpen && <TrailProfile segments={segments} selected={selectedPoint?.sample} select={setSelected} />}
      </div>
    </figure>
  )
}
