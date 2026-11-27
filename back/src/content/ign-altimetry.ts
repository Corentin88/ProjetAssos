import { setTimeout as pause } from 'node:timers/promises';
import { distanceKm } from './gpx-details.js';
import type { GpxPoint } from './gpx-details.js';

export type ElevationAnchor = [segment: number, point: number, metres: number | null];
const endpoint = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json';
const batchSize = 500;
let nextRequest = 0;

export async function lookupElevations(segments: GpxPoint[][]): Promise<ElevationAnchor[]> {
  const missing = segments.reduce((sum, segment) => sum + segment.filter(point => point.elevation === undefined).length, 0);
  if (!missing) return [];
  const stride = Math.ceil(missing / 2000);
  const samples: { segment: number; point: number; coordinates: GpxPoint['coordinates'] }[] = [];
  let index = 0;
  segments.forEach((segment, segmentIndex) => segment.forEach(({ coordinates, elevation }, point) => {
    if (elevation !== undefined) return;
    if (index++ % stride === 0 || point === 0 || point === segment.length - 1)
      samples.push({ segment: segmentIndex, point, coordinates });
  }));
  if (samples.length > 3000) throw new Error('Trop de segments GPX pour un enrichissement automatique.');
  const timeout = AbortSignal.timeout(14_000);
  const anchors: ElevationAnchor[] = [];
  for (let start = 0; start < samples.length; start += batchSize) {
    const batch = samples.slice(start, start + batchSize);
    // Espacer les départs de 250 ms, sous le plafond IGN de 5 requêtes/s.
    const at = Math.max(Date.now(), nextRequest);
    nextRequest = at + 250;
    await pause(Math.max(0, at - Date.now()), undefined, { signal: timeout });
    const response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal: AbortSignal.any([timeout, AbortSignal.timeout(4000)]),
      body: JSON.stringify({
        lon: batch.map(entry => entry.coordinates[1].toFixed(7)).join('|'),
        lat: batch.map(entry => entry.coordinates[0].toFixed(7)).join('|'),
        resource: 'ign_rge_alti_wld', delimiter: '|', zonly: 'true',
      }),
    });
    if (!response.ok) throw new Error('Service altimétrique indisponible.');
    const body = await response.json() as { elevations?: unknown };
    if (!Array.isArray(body.elevations) || body.elevations.length !== batch.length)
      throw new Error('Réponse altimétrique incomplète.');
    for (const [i, entry] of batch.entries()) {
      const elevation: unknown = body.elevations[i];
      if (typeof elevation !== 'number' || !Number.isFinite(elevation))
        throw new Error('Altitude IGN invalide.');
      anchors.push([entry.segment, entry.point, elevation === -99999 ? null : elevation]);
    }
  }
  return anchors;
}

export function mergeElevations(segments: GpxPoint[][], anchors: ElevationAnchor[]) {
  const bySegment = new Map<number, Map<number, number | null>>();
  for (const [segment, point, altitude] of anchors) {
    const elevations = bySegment.get(segment) ?? new Map<number, number | null>();
    elevations.set(point, altitude);
    bySegment.set(segment, elevations);
  }
  return segments.map((segment, index) => {
    const elevations = bySegment.get(index);
    if (!elevations) return segment;
    const points = segment.map(point => ({ ...point }));
    let previous: { index: number; metres: number } | undefined;
    for (const [i, point] of points.entries()) {
      const metres = point.elevation ?? elevations.get(i);
      if (metres === undefined) continue;
      if (metres === null) {
        previous = undefined;
        continue;
      }
      point.elevation = metres;
      if (previous && i - previous.index > 1) {
        let distance = 0;
        const offsets = points.slice(previous.index + 1, i + 1).map((entry, offset) => {
          distance += distanceKm(points[previous!.index + offset].coordinates, entry.coordinates);
          return distance;
        });
        for (let j = previous.index + 1; j < i; j++) {
          const fraction = distance ? offsets[j - previous.index - 1] / distance : 0;
          points[j].elevation = previous.metres + fraction * (metres - previous.metres);
        }
      }
      previous = { index: i, metres };
    }
    return points;
  });
}
