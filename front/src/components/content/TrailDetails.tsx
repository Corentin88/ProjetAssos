import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Download, Mountain } from 'lucide-react'
import type { Trail } from '../../types'
import { authErrorMessage, protectedRequest, useCurrentUser } from '../../lib/auth'
import { formatNombre } from '../../lib/format'
import { Alert } from '../ui/feedback'
import { Button, buttonClasses } from '../ui/form'

export const difficulties = { EASY: 'Facile', MEDIUM: 'Intermédiaire', HARD: 'Difficile' } as const

export function TrailDetails({ trail, articleId }: { trail: Trail; articleId?: string }) {
  const user = useCurrentUser()
  const location = useLocation()
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const download = async () => {
    setDownloading(true)
    setError('')
    try {
      const file = await protectedRequest<Blob>(`/articles/${articleId}/gpx`, 'GET', undefined, true)
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = 'parcours.gpx'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { setError(authErrorMessage(error)) }
    finally { setDownloading(false) }
  }

  return (
    <section aria-labelledby="titre-parcours" className="carte mt-6 p-4 sm:p-6">
      <h2 id="titre-parcours" className="flex items-center gap-2 text-xl text-forest">
        <Mountain aria-hidden="true" className="h-6 w-6" />
        {trail.name}
      </h2>
      {trail.description && <p className="mt-2 whitespace-pre-line">{trail.description}</p>}
      <dl className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div><dt className="font-bold">Distance</dt><dd>{formatNombre(trail.distance)} km</dd></div>
        <div><dt className="font-bold">Durée</dt><dd>{formatNombre(trail.duration)} min</dd></div>
        <div><dt className="font-bold">Difficulté</dt><dd>{difficulties[trail.difficulty]}</dd></div>
        <div><dt className="font-bold">Dénivelé positif</dt><dd>{formatNombre(trail.elevationGain)} m</dd></div>
        <div><dt className="font-bold">Dénivelé négatif</dt><dd>{formatNombre(trail.elevationLoss)} m</dd></div>
      </dl>
      <TrailMap segments={trail.mapPreview.segments} />
      {articleId && <div className="mt-4">
        {user?.statut === 'actif' ? (
          <Button onClick={download} disabled={downloading}><Download aria-hidden="true" className="h-5 w-5" /> Télécharger le GPX</Button>
        ) : !user ? (
          <Link to="/connexion" state={{ from: location.pathname + location.search + location.hash }}
            className={buttonClasses('secondaire')}>Se connecter pour télécharger le GPX</Link>
        ) : <p>Le téléchargement GPX est réservé aux comptes actifs.</p>}
        {error && <Alert kind="erreur" title="Téléchargement impossible">{error}</Alert>}
      </div>}
    </section>
  )
}

function TrailMap({ segments }: { segments: Trail['mapPreview']['segments'] }) {
  const first = segments[0]?.[0]
  if (!first) return null
  // Déplie les longitudes autour du premier point pour conserver la continuité du tracé.
  const points = segments.map(segment => segment.map(([lat, lon]) => [lat, first[1] + ((lon - first[1] + 540) % 360) - 180]))
  const bounds = points.flat().reduce(([south, west, north, east], [lat, lon]) =>
    [Math.min(south, lat), Math.min(west, lon), Math.max(north, lat), Math.max(east, lon)],
  [first[0], first[1], first[0], first[1]])
  const [south, west, north, east] = bounds
  const latitude = (north + south) / 2
  const longitude = (((east + west) / 2 + 540) % 360) - 180
  const correction = Math.max(0.001, Math.cos(latitude * Math.PI / 180))
  const scale = Math.min(580 / Math.max((east - west) * correction, 0.000001), 260 / Math.max(north - south, 0.000001))
  const zoom = Math.max(2, Math.min(17, Math.floor(Math.log2(360 / Math.max(east - west, north - south, 0.0001))) - 1))

  return (
    <figure className="rounded-xl border border-line bg-leaf-pale p-3">
      <svg role="img" aria-label="Carte du tracé de randonnée" viewBox="0 0 640 320" className="mx-auto block max-h-72 w-full">
        {points.map((segment, index) => (
          <polyline key={index} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
            className="text-forest" points={segment.map(([lat, lon]) =>
              `${320 + (lon - (east + west) / 2) * correction * scale},${160 + (latitude - lat) * scale}`).join(' ')}
          />
        ))}
      </svg>
      <figcaption className="text-sm">
        <a className="font-bold text-forest underline underline-offset-4"
          href={`https://www.openstreetmap.org/#map=${zoom}/${latitude}/${longitude}`}>Voir les environs sur OpenStreetMap</a>
      </figcaption>
    </figure>
  )
}
