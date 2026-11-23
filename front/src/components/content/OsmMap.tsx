import { useEffect, useRef, useState } from 'react'
import type { KeyboardEventHandler } from 'react'
import type { Map as LeafletMap } from 'leaflet'

export type OsmMapHandle = { map: LeafletMap; leaflet: typeof import('leaflet') }

export function OsmMap({ label, className, onReady, onKeyDown }: {
  label: string
  className: string
  onReady: (handle: OsmMapHandle) => void
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>
}) {
  const container = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [tileError, setTileError] = useState(false)
  const [mapError, setMapError] = useState(false)

  useEffect(() => {
    const node = container.current
    if (!node) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const node = container.current
    if (!visible || !node) return
    let cancelled = false
    let dispose: (() => void) | undefined
    // Les pages sans carte ne chargent ni le moteur ni sa feuille de styles.
    void Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([leaflet]) => {
      if (cancelled) return
      const map = leaflet.map(node, {
        zoomControl: false, minZoom: 2, maxZoom: 19,
        scrollWheelZoom: true, doubleClickZoom: true, touchZoom: true,
      })
      const resize = new ResizeObserver(() => map.invalidateSize({ pan: false }))
      dispose = () => { resize.disconnect(); map.remove() }
      const tiles = leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        referrerPolicy: 'strict-origin-when-cross-origin',
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      })
      map.attributionControl.setPrefix(false)
      let failed = false
      tiles.on('loading', () => { failed = false })
      tiles.on('tileerror', () => { failed = true; setTileError(true) })
      tiles.on('load', () => setTileError(failed))
      tiles.addTo(map)
      resize.observe(node)
      onReady({ map, leaflet })
    }).catch(() => { if (!cancelled) setMapError(true) })
    return () => { cancelled = true; dispose?.() }
  }, [visible, onReady])

  return (
    <>
      <div ref={container} role="region" aria-label={label} onKeyDownCapture={onKeyDown}
        className={`relative isolate z-0 w-full rounded-lg border border-line ${className}`}
        style={{ backgroundColor: 'var(--color-leaf-pale)' }} />
      {mapError && <p role="status" className="mt-2 text-sm">Impossible de charger la carte. Réessayez en rechargeant la page.</p>}
      {tileError && <p role="status" className="mt-2 text-sm">Le fond OpenStreetMap ne s’affiche pas entièrement. Les repères restent visibles.</p>}
    </>
  )
}
