import { describe, expect, it } from 'vitest';
import { sampleGpx } from './gpx-details.js';
import type { GpxPoint } from './gpx-details.js';

function point(longitude: number, elevation?: number, time?: number): GpxPoint {
  return { coordinates: [0, longitude], elevation, time };
}

describe('Échantillonnage du GPX interactif', () => {
  it('classe les pentes et garde les vraies mesures, y compris en présence de doublons', () => {
    const time = Date.UTC(2026, 0, 1, 9);
    const [samples] = sampleGpx([[
      point(0, 120, time), point(0.001, 140), point(0.001, 140),
      point(0.002, 141), point(0.003, 118), point(0, 118),
    ]]);
    expect(samples.map(sample => sample.slope)).toEqual([null, 'up', null, 'flat', 'down', 'flat']);
    expect(samples[0]).toMatchObject({ distanceKm: 0, time: '2026-01-01T09:00:00.000Z' });
    expect(samples[1].time).toBeNull();
    expect(samples[5].coordinates).toEqual(samples[0].coordinates);
    expect(samples[5].distanceKm).toBeGreaterThan(0.6);
  });

  it('interrompt le profil en cas de lacune et cumule la distance sans relier les segments', () => {
    const [first, second] = sampleGpx([
      [point(0, 120), point(0.001), point(0.002, 140)],
      [point(10), point(10.001)],
    ]);
    expect(first.map(sample => sample.elevation)).toEqual([120, null, 140]);
    expect(first[2]).toMatchObject({ elevationBreak: true, slope: null });
    expect(second[0].distanceKm).toBe(first[2].distanceKm);
    expect(second[1].slope).toBeNull();
  });

  it('borne le nombre de points envoyés et conserve les extrémités du parcours', () => {
    const segments = Array.from({ length: 230 }, (_, index) =>
      Array.from({ length: 200 }, (_, position) => point(index * 0.1 + position * 0.0001, 75 + position)),
    );
    const samples = sampleGpx(segments);
    expect(samples.flat().length).toBeLessThanOrEqual(1200);
    expect(samples[0][0].coordinates).toEqual(segments[0][0].coordinates);
    expect(samples.at(-1)?.at(-1)?.coordinates).toEqual(segments.at(-1)?.at(-1)?.coordinates);
    expect(samples.at(-1)!.at(-1)!.distanceKm).toBeGreaterThan(500);
  });
});
