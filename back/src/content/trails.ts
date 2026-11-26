import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IsEnum,
  IsInt,
  IsNumber,
  isISO8601,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SaxesParser } from 'saxes';
import { Prisma, TrailDifficulty } from '../../generated/prisma/client.js';
import { SessionService } from '../auth/session.service.js';
import type { Principal } from '../auth/session.service.js';
import { PrismaService } from '../prisma/prisma.module.js';
import { contentLog, lockAdmin, lockMediaFolder } from './content.shared.js';
import { ContentInputError } from './content-input.error.js';
import { describeGpx, sampleGpx } from './gpx-details.js';
import type { GpxPoint } from './gpx-details.js';
import { defaultMapSettings, storedMapBlock } from './map-blocks.js';

export class TrailDto {
  @IsString() @MaxLength(255) name: string;
  @IsString() @MaxLength(4000) description: string;
  @IsNumber() @Min(0) distance: number;
  @IsNumber() @Min(0) elevationGain: number;
  @IsNumber() @Min(0) elevationLoss: number;
  @IsInt() @Min(0) @Max(2147483647) duration: number;
  @IsEnum(TrailDifficulty) difficulty: TrailDifficulty;
  @IsUUID() gpxMediaId: string;
}

export const gpxSizeLimit = 5 * 1024 * 1024;
const directory = 'storage/trails';
const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const pointPaths = ['gpx/trk/trkseg/trkpt', 'gpx/rte/rtept'];
const namePaths = ['gpx/trk/name', 'gpx/rte/name', 'gpx/metadata/name', 'gpx/name'];

export function parseGpx(file: Buffer, interactive = true) {
  try {
    const parser = new SaxesParser({ xmlns: true });
    const path: string[] = [];
    const segments: GpxPoint[][] = [];
    let segment: GpxPoint[] | undefined;
    const names = new Map<string, string>();
    let content = '';
    let namespace = '';
    parser.on('error', (error) => {
      throw error;
    });
    parser.on('doctype', () => {
      throw new Error();
    });
    parser.on('processinginstruction', () => {
      throw new Error();
    });
    parser.on('opentag', (tag) => {
      if (path.length >= 64) throw new Error();
      path.push(path.length === 0 || tag.uri === namespace ? tag.local : '');
      if (path.length === 1) {
        namespace = tag.uri;
        if (
          tag.local !== 'gpx' ||
          ![
            'http://www.topografix.com/GPX/1/0',
            'http://www.topografix.com/GPX/1/1',
          ].includes(namespace)
        )
          throw new Error();
      }
      const location = path.join('/');
      if (namePaths.includes(location) || pointPaths.some(point => location === point + '/ele' || location === point + '/time'))
        content = '';
      if (tag.uri !== namespace) return;
      if (location === 'gpx/trk/trkseg' || location === 'gpx/rte') segment = [];
      if (
        segment &&
        pointPaths.includes(location)
      ) {
        const lat = tag.attributes.lat?.value;
        const lon = tag.attributes.lon?.value;
        if (
          !lat ||
          !lon ||
          !decimal.test(lat.trim()) ||
          !decimal.test(lon.trim())
        )
          throw new Error();
        const point: GpxPoint['coordinates'] = [Number(lat), Number(lon)];
        if (
          !point.every(Number.isFinite) ||
          Math.abs(point[0]) > 90 ||
          Math.abs(point[1]) > 180
        )
          throw new Error();
        segment.push({ coordinates: point });
      }
    });
    const captureText = (value: string) => {
      const location = path.join('/');
      if (namePaths.includes(location) || pointPaths.some(point => location === point + '/ele' || location === point + '/time'))
        content += value.slice(0, Math.max(0, 1024 - content.length));
    };
    parser.on('text', captureText);
    parser.on('cdata', captureText);
    parser.on('closetag', (tag) => {
      const location = path.join('/');
      if (namePaths.includes(location) && content.trim() && !names.has(location))
        names.set(location, [...content.trim()].slice(0, 255).join(''));
      const point = segment?.at(-1);
      if (point && pointPaths.some(path => location === path + '/ele')) {
        const raw = content.trim();
        const elevation = Number(raw);
        if (decimal.test(raw) && Number.isFinite(elevation)) point.elevation = elevation;
      }
      if (point && pointPaths.some(path => location === path + '/time')) {
        const raw = content.trim();
        const time = Date.parse(raw);
        if (/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/i.test(raw)
          && isISO8601(raw, { strict: true, strictSeparator: true })
          && Number.isFinite(time)) point.time = time;
      }
      if (
        tag.uri === namespace &&
        (location === 'gpx/trk/trkseg' || location === 'gpx/rte')
      ) {
        if (segment?.length) segments.push(segment);
        segment = undefined;
      }
      path.pop();
    });
    parser
      .write(new TextDecoder('utf-8', { fatal: true }).decode(file))
      .close();
    const drawable = segments.filter(points => points.length >= 2);
    if (!drawable.length) throw new Error();
    // La carte reçoit un tracé simplifié, sans métadonnées ni fichier d’origine.
    const segmentStride = Math.ceil(drawable.length / 160);
    const selection = drawable.filter(
      (_points, index) => index % segmentStride === 0,
    );
    const stride = Math.ceil(
      selection.reduce((sum, points) => sum + points.length, 0) / 400,
    );
    return {
      segments: selection.map((points) =>
        points.filter(
          (_point, index) =>
            index % stride === 0 || index === points.length - 1,
        ).map(point => point.coordinates),
      ),
      details: describeGpx(namePaths.map(path => names.get(path)).find(Boolean) ?? '', segments),
      samples: interactive ? sampleGpx(segments) : [],
    };
  } catch {
    throw new ContentInputError('Sélectionnez un fichier GPX valide contenant un tracé ou un itinéraire d’au moins deux points.');
  }
}

export function parseGpxUpload(file?: Buffer) {
  if (!file?.length || file.length > gpxSizeLimit)
    throw new ContentInputError('Sélectionnez un fichier GPX de 5 Mio maximum.');
  return parseGpx(file);
}

export const gpxLibrary = {
  type: 'GPX',
  format: 'GPX',
  path: { startsWith: 'trails/' },
} satisfies Prisma.MediaWhereInput;

const gpxBlocks = {
  type: 'PARAGRAPH',
  data: { path: ['kind'], equals: 'randonnee' },
} satisfies Prisma.ArticleBlockWhereInput;

export function gpxBlockUsage(tx: Prisma.TransactionClient, id: string) {
  return tx.articleBlock.count({
    where: { AND: [gpxBlocks, { data: { path: ['trail', 'gpxMediaId'], equals: id } }] },
  });
}

export function gpxPath(key: string) {
  const filename = /^trails\/([a-f0-9-]{36}\.gpx)$/i.exec(key)?.[1];
  if (!filename) throw new NotFoundException();
  return join(directory, filename);
}

@Injectable()
export class TrailsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  async list() {
    const files = await this.prisma.media.findMany({
      where: gpxLibrary,
      select: {
        id: true,
        name: true,
        sizeBytes: true,
        _count: { select: { trails: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    const blocks = await this.prisma.$queryRaw<{ id: string | null; count: bigint }[]>`
      SELECT data #>> '{trail,gpxMediaId}' AS id, COUNT(*) AS count
      FROM article_blocks
      WHERE type = 'PARAGRAPH' AND data ->> 'kind' = 'randonnee'
      GROUP BY 1
    `;
    const usages = new Map(blocks.map(({ id, count }) => [id, Number(count)]));
    return files.map((file) => ({
      id: file.id,
      nom: file.name,
      tailleKo: Math.max(1, Math.round(Number(file.sizeBytes) / 1024)),
      usages: file._count.trails + (usages.get(file.id) ?? 0),
    }));
  }

  async upload(actor: Principal, file?: Buffer, originalName?: string, folderId?: string) {
    const data = file ?? Buffer.alloc(0);
    const preview = parseGpxUpload(data);
    const path = `trails/${randomUUID()}.gpx`;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(gpxPath(path), data, { flag: 'wx', mode: 0o600 });
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockAdmin(tx, this.sessions, actor);
        await lockMediaFolder(tx, folderId);
        const name =
          originalName
            ?.replace(/[\x00-\x1f\x7f]/g, '')
            .trim()
            .slice(0, 255) || 'Parcours GPX';
        const media = await tx.media.create({
          data: {
            name,
            type: 'GPX',
            format: 'GPX',
            path,
            sizeBytes: BigInt(data.length),
            folderId,
          },
        });
        await contentLog(
          tx,
          actor.userId,
          'MEDIA',
          media.id,
          'CREATE',
          'Fichier GPX importé.',
        );
        return { id: media.id, preview };
      });
    } catch (error) {
      const stored = await this.prisma.media
        .findUnique({ where: { path } })
        .catch(() => undefined);
      if (stored === null) await unlink(gpxPath(path)).catch(() => {});
      throw error;
    }
  }

  async preview(id: string) {
    const media = await this.prisma.media.findFirst({
      where: { id, ...gpxLibrary },
      select: { path: true },
    });
    if (!media) throw new NotFoundException();
    return this.readPreview(media.path);
  }

  private async readPreview(path: string, interactive = true) {
    const file = await readFile(gpxPath(path)).catch(() => {
      throw new ContentInputError('Le fichier GPX est indisponible. Sélectionnez un autre fichier.');
    });
    return parseGpx(file, interactive);
  }

  async blockPreview(tx: Prisma.TransactionClient, mediaId: string) {
    const media = await tx.media.findFirst({
      where: { id: mediaId, ...gpxLibrary },
    });
    if (!media) throw new ContentInputError('Le fichier GPX est indisponible. Sélectionnez un autre fichier.');
    const locked = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM media WHERE id = ${media.id}::uuid FOR KEY SHARE`;
    if (!locked.length) throw new ContentInputError('Le fichier GPX est indisponible. Sélectionnez un autre fichier.');
    const { segments } = await this.readPreview(media.path, false);
    return { segments };
  }

  async data(tx: Prisma.TransactionClient, trail: TrailDto) {
    if (!trail.name.trim()) throw new ContentInputError('Renseignez le nom du parcours.');
    return {
      ...trail,
      name: trail.name.trim(),
      description: trail.description.trim(),
      mapPreview: await this.blockPreview(tx, trail.gpxMediaId),
    };
  }

  async download(articleId: string, blockId?: string) {
    const { path } = await this.publishedTrail(articleId, blockId, 'download');
    return this.openDownload(path);
  }

  async map(articleId: string, blockId?: string) {
    const { path, trail } = await this.publishedTrail(articleId, blockId, 'map');
    const { samples } = await this.readPreview(path);
    const settings = trail?.mapSettings ?? defaultMapSettings;
    const withElevation = !trail || settings.profile || trail.visibility.altitude;
    return { samples: samples.map(segment => segment.map(point => ({
      ...point,
      elevation: withElevation ? point.elevation : null,
      elevationBreak: withElevation && point.elevationBreak,
      time: !trail || trail.visibility.dates ? point.time : null,
      slope: settings.slopes ? point.slope : null,
    }))) };
  }

  private async publishedTrail(articleId: string, blockId: string | undefined, access: 'map' | 'download') {
    const version = {
      articleId,
      kind: 'PUBLISHED',
      article: { status: 'PUBLISHED' },
    } satisfies Prisma.ArticleVersionWhereInput;
    if (blockId) {
      const block = await this.prisma.articleBlock.findFirst({
        where: {
          id: blockId,
          AND: [
            gpxBlocks,
            { data: { path: ['trail', 'visibility', access], equals: true } },
          ],
          version,
        },
        select: { type: true, data: true },
      });
      const mapBlock = block && storedMapBlock(block.type, block.data);
      if (mapBlock?.kind !== 'randonnee' || !mapBlock.trail.gpxMediaId) throw new NotFoundException();
      const media = await this.prisma.media.findFirst({
        where: { id: mapBlock.trail.gpxMediaId, ...gpxLibrary },
        select: { path: true },
      });
      if (!media) throw new NotFoundException();
      return { path: media.path, trail: mapBlock.trail };
    }
    const trail = await this.prisma.trail.findFirst({
      where: {
        version,
        gpxMedia: gpxLibrary,
      },
      include: { gpxMedia: { select: { path: true } } },
    });
    if (!trail) throw new NotFoundException();
    return { path: trail.gpxMedia.path };
  }

  private async openDownload(path: string | undefined) {
    if (!path) throw new NotFoundException();
    const file = await open(gpxPath(path), 'r').catch(() => {
      throw new NotFoundException();
    });
    try {
      const stats = await file.stat();
      if (!stats.isFile() || stats.size < 1 || stats.size > gpxSizeLimit)
        throw new NotFoundException();
      return { stream: file.createReadStream(), size: stats.size };
    } catch {
      await file.close().catch(() => {});
      throw new NotFoundException();
    }
  }
}
