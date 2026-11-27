import { open, readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../../generated/prisma/client.js';
import type { SessionService } from '../auth/session.service.js';
import type { PrismaService } from '../prisma/prisma.module.js';
import { TrailsService } from './trails.js';

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  open: vi.fn(),
  readFile: vi.fn(),
}));

const id = '00000000-0000-4000-a000-000000000000';
function original(withAltitudes = false) {
  return Buffer.from('<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>' +
    `<trkpt lat="48" lon="7">${withAltitudes ? '<ele>348.83</ele>' : ''}</trkpt>` +
    `<trkpt lat="48.01" lon="7.02">${withAltitudes ? '<ele>432.93</ele>' : ''}</trkpt>` +
    '</trkseg></trk></gpx>');
}

function fixture(bytes: Buffer<ArrayBuffer>, elevations: Prisma.JsonValue, allowed = true) {
  vi.mocked(readFile).mockResolvedValue(bytes);
  vi.mocked(open).mockResolvedValue({
    stat: async () => ({ size: bytes.length, isFile: () => true }),
    createReadStream: () => Readable.from([bytes]),
  } as unknown as Awaited<ReturnType<typeof open>>);
  const findFirst = vi.fn().mockResolvedValue(allowed
    ? { type: 'PARAGRAPH', data: { kind: 'randonnee', trail: { gpxMediaId: id } } }
    : null);
  const prisma = {
    articleBlock: { findFirst },
    media: { findFirst: vi.fn().mockResolvedValue({ path: `trails/${id}.gpx`, gpxElevations: elevations }) },
  } as unknown as PrismaService;
  const service = new TrailsService(prisma, {} as SessionService);
  return { service, findFirst };
}

async function download(service: TrailsService) {
  const { stream, size } = await service.download(id, id);
  const chunks = await stream.toArray() as Buffer[];
  const downloaded = Buffer.concat(chunks);
  expect(downloaded.length).toBe(size);
  return downloaded;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('Téléchargement automatique du GPX publié', () => {
  it('sert les altitudes originales complètes, même en présence d’un cache', async () => {
    const bytes = original(true);
    const { service } = fixture(bytes, [[0, 0, 500]]);
    expect(await download(service)).toEqual(bytes);
  });

  it('sert une variante enrichie valide sans appel IGN et préserve le fichier original', async () => {
    const bytes = original();
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { service } = fixture(bytes, [[0, 0, 348.83], [0, 1, 432.93]]);
    const enriched = await download(service);
    expect(enriched.toString()).toContain('<ele>348.83</ele>');
    expect(enriched.toString()).toContain('<ele>432.93</ele>');
    expect(bytes).toEqual(original());
    expect(open).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([null, [[0, 0, null]], [[0, 500, 348]], [[0, 0, 'invalide']], [[0, 0, 348], [0, 0, null]]])(
    'revient à l’original en cas de cache absent ou inutilisable (%j)',
    (elevations) => {
      const bytes = original();
      return expect(download(fixture(bytes, elevations).service)).resolves.toEqual(bytes);
    },
  );

  it('exige une version publiée avec le téléchargement activé avant de lire les fichiers', async () => {
    const { service, findFirst } = fixture(original(), [[0, 0, 348]], false);
    await expect(service.download(id, id)).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id,
        version: { articleId: id, kind: 'PUBLISHED', article: { status: 'PUBLISHED' } },
        AND: expect.arrayContaining([{ data: { path: ['trail', 'visibility', 'download'], equals: true } }]),
      }),
    }));
    expect(readFile).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
