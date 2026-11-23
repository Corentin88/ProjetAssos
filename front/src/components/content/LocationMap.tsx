import type { LocationBlockFields } from '../../types'
import { MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { OsmMap } from './OsmMap'
import type { OsmMapHandle } from './OsmMap'

function LocationBasemap({ latitude, longitude, label }: { latitude: number; longitude: number; label: string }) {
  const [handle, setMap] = useState<OsmMapHandle>()
  useEffect(() => {
    if (!handle) return
    const { map, leaflet } = handle
    map.setView([latitude, longitude], 15)
    const marker = leaflet.circleMarker([latitude, longitude], {
      radius: 8, color: 'white', weight: 3, fillColor: '#16473a', fillOpacity: 1,
    }).addTo(map)
    const zoom = leaflet.control.zoom({ zoomInTitle: 'Zoom avant', zoomOutTitle: 'Zoom arrière' }).addTo(map)
    return () => { marker.remove(); zoom.remove() }
  }, [handle, latitude, longitude])
  return <OsmMap label={label} className="h-64" onReady={setMap} />
}

export function LocationMap({ location }: { location: LocationBlockFields }) {
  const { latitude, longitude, title, address } = location
  if (latitude == null || longitude == null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  const limit = 85.0511
  const center = Math.min(limit - 0.005, Math.max(-limit + 0.005, latitude))
  const mapLink = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${center}/${longitude}`

  return (
    <figure className="grid gap-2">
      {Math.abs(latitude) <= limit ? (
        <LocationBasemap latitude={latitude} longitude={longitude}
          label={`Carte : ${title || address || `${latitude}, ${longitude}`}`} />
      ) : (
        <div role="img" aria-label={`Position polaire : ${latitude}, ${longitude}`}
          className="grid min-h-24 place-items-center rounded-xl border border-line bg-leaf-pale">
          <MapPin aria-hidden="true" className="h-8 w-8 text-forest" />
        </div>
      )}
      <figcaption className="flex flex-wrap gap-x-3 text-sm">
        <a className="font-bold underline underline-offset-4" href={mapLink}>Voir le lieu sur OpenStreetMap</a>
        <span>{latitude}, {longitude}</span>
      </figcaption>
    </figure>
  )
}

export function LocationDetails({ location }: { location: LocationBlockFields }) {
  return (
    <section aria-label={location.title || 'Carte et localisation'} className="grid gap-3">
      {location.title && <h2>{location.title}</h2>}
      {location.address && <p>{location.address}</p>}
      {location.description && <p className="whitespace-pre-line">{location.description}</p>}
      <LocationMap location={location} />
    </section>
  )
}
