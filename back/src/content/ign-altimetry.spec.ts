import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupElevations, mergeElevations } from './ign-altimetry.js';
import type { GpxPoint } from './gpx-details.js';
import { parseGpx } from './trails.js';

function point(longitude: number, elevation?: number): GpxPoint {
  return { coordinates: [47, longitude], elevation };
}

afterEach(() => vi.unstubAllGlobals());

describe('Altitudes IGN', () => {
  it('ne contacte pas l’IGN si toutes les altitudes sont présentes', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await lookupElevations([[point(6, 210), point(6.001, 219)]])).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('lotit un GPX de 1 585 points et garde les altitudes embarquées et la géométrie', async () => {
    const segments = [Array.from({ length: 1585 }, (_, i) => point(6 + i / 100000, i === 0 ? 210 : undefined))];
    const fetch = vi.fn((_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { lon: string; resource: string };
      expect(body.resource).toBe('ign_rge_alti_wld');
      const coordinates = body.lon.split('|');
      expect(coordinates.length).toBeLessThanOrEqual(500);
      return Promise.resolve(Response.json({ elevations: coordinates.map(() => 220) }));
    });
    vi.stubGlobal('fetch', fetch);
    const anchors = await lookupElevations(segments);
    const [enriched] = mergeElevations(segments, anchors);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(enriched[0].elevation).toBe(210);
    expect(enriched[1584].elevation).toBe(220);
    expect(enriched.map(point => point.coordinates)).toEqual(segments[0].map(point => point.coordinates));
    expect(segments[0][1584].elevation).toBeUndefined();
  });

  it('préserve les lacunes de couverture et refuse une réponse HTTP 429', async () => {
    const segments = [[point(6), point(6.001), point(6.002), point(6.003), point(6.004)]];
    expect(mergeElevations(segments, [[0, 0, 210], [0, 2, null], [0, 4, 250]])[0].map(point => point.elevation))
      .toEqual([210, undefined, undefined, undefined, 250]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 429 })));
    await expect(lookupElevations(segments)).rejects.toThrow();
  });

  it('laisse les horaires mesurés vides et sépare la durée estimée', () => {
    const xml = '<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>' +
      '<trkpt lat="47" lon="6"><ele>200</ele></trkpt><trkpt lat="47" lon="6.01"><ele>300</ele></trkpt></trkseg></trk></gpx>';
    const { details, enrichment } = parseGpx(Buffer.from(xml));
    expect(enrichment).toBe('complete');
    expect(details).toMatchObject({ departureAt: null, arrivalAt: null, durationSeconds: null, elevationGain: 100 });
    expect(details.estimatedDurationSeconds).toBeGreaterThan(0);
  });
});
