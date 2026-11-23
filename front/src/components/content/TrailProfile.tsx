import type { PointerEvent } from 'react'
import type { TrailSample } from '../../types'
import { formatNombre } from '../../lib/format'

export function TrailProfile({ segments, selected, select }: {
  segments: TrailSample[][]
  selected: TrailSample | undefined
  select: (point: TrailSample) => void
}) {
  const route = segments.flat()
  const measured = route.filter(point => point.elevation != null)
  if (!measured.length) return null
  const distance = route[route.length - 1]?.distanceKm ?? 0
  const elevations = measured.map(point => point.elevation!)
  const minimum = Math.floor(Math.min(...elevations) / 10) * 10
  const maximum = Math.max(minimum + 10, Math.ceil(Math.max(...elevations) / 10) * 10)
  const x = (point: TrailSample) => Number(point.distanceKm) / Math.max(distance, 0.001) * 600
  const y = (point: TrailSample) => (maximum - Number(point.elevation)) / (maximum - minimum) * 124 + 8
  const path = segments.map(segment => segment.map((point, index) => point.elevation == null ? ''
    : `${index === 0 || point.elevationBreak || segment[index - 1].elevation == null ? 'M' : 'L'}${x(point)} ${y(point)}`
  ).join(' ')).join(' ')
  const isolated = segments.flatMap(segment => segment.filter((point, index) =>
    point.elevation != null && (index === 0 || point.elevationBreak)
      && (!segment[index + 1] || segment[index + 1].elevationBreak)))

  function track(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const target = (event.clientX - rect.left) / rect.width * distance
    const closest = route.reduce((best, point) => {
      const gap = Math.abs(Number(point.distanceKm) - target)
      const bestGap = Math.abs(Number(best.distanceKm) - target)
      return gap < bestGap || (gap === bestGap && point === selected) ? point : best
    }, route[0])
    select(closest)
  }

  return (
    <div className="mt-3">
      <div className="grid grid-cols-[auto_1fr] gap-x-2">
        <div aria-hidden="true" className="flex flex-col justify-between py-1 text-xs text-bark">
          <span>{formatNombre(maximum)} m</span>
          <span>{formatNombre(minimum)} m</span>
        </div>
        <svg role="group" aria-label="Profil altimétrique, altitude en mètres et distance cumulée en kilomètres"
          viewBox="0 0 600 140" preserveAspectRatio="none" className="h-36 w-full touch-pan-y overflow-visible rounded border border-line bg-white"
          onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); track(event) }}
          onPointerMove={event => { if (event.pointerType === 'mouse' || event.buttons) track(event) }}>
          <path d="M0 8H600 M0 70H600 M0 132H600" stroke="currentColor" className="text-line" fill="none" />
          <path d={path} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" className="text-forest" />
          {isolated.map((point, index) => <path key={index} d={`M${x(point) - 2} ${y(point)}h4`} className="text-forest" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
          {selected && <>
            <path d={`M${x(selected)} 0v140`} stroke="currentColor" className="text-bark" vectorEffect="non-scaling-stroke" />
            {selected.elevation != null && <path d={`M${x(selected) - 4} ${y(selected)}h8`} className="text-bark" stroke="currentColor" strokeWidth="4" vectorEffect="non-scaling-stroke" />}
          </>}
        </svg>
        <div aria-hidden="true" className="col-start-2 flex justify-between text-xs text-bark">
          <span>0 km</span><span>{formatNombre(distance)} km</span>
        </div>
      </div>
      <input type="range" min={0} max={route.length - 1} value={selected ? Math.max(0, route.indexOf(selected)) : 0}
        aria-label="Point du profil altimétrique"
        aria-valuetext={selected?.distanceKm != null
          ? `${formatNombre(selected.distanceKm)} km du départ${selected.elevation == null ? '' : `, ${formatNombre(selected.elevation)} m d’altitude`}`
          : undefined}
        className="mt-1 min-h-11 w-full accent-forest" onChange={event => select(route[event.target.valueAsNumber])} />
    </div>
  )
}
