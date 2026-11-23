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
import { contentLog, lockAdmin } from './content.shared.js';
import { ContentInputError } from './content-input.error.js';

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

type Point = [number, number];
export const gpxSizeLimit = 5 * 1024 * 1024;
const directory = 'storage/trails';

export function parseGpx(file: Buffer) {
  try {
    const parser = new SaxesParser({ xmlns: true });
    const path: string[] = [];
    const segments: Point[][] = [];
    let segment: Point[] | undefined;
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
      if (tag.uri !== namespace) return;
      if (location === 'gpx/trk/trkseg' || location === 'gpx/rte') segment = [];
      if (
        segment &&
        (location === 'gpx/trk/trkseg/trkpt' || location === 'gpx/rte/rtept')
      ) {
        const lat = tag.attributes.lat?.value;
        const lon = tag.attributes.lon?.value;
        const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
        if (
          !lat ||
          !lon ||
          !decimal.test(lat.trim()) ||
          !decimal.test(lon.trim())
        )
          throw new Error();
        const point: Point = [Number(lat), Number(lon)];
        if (
          !point.every(Number.isFinite) ||
          Math.abs(point[0]) > 90 ||
          Math.abs(point[1]) > 180
        )
          throw new Error();
        segment.push(point);
      }
    });
    parser.on('closetag', (tag) => {
      const location = path.join('/');
      if (
        tag.uri === namespace &&
        (location === 'gpx/trk/trkseg' || location === 'gpx/rte')
      ) {
        if (segment && segment.length >= 2) segments.push(segment);
        segment = undefined;
      }
      path.pop();
    });
    parser
      .write(new TextDecoder('utf-8', { fatal: true }).decode(file))
      .close();
    if (!segments.length) throw new Error();
    // La carte reçoit un tracé simplifié, sans métadonnées ni fichier d’origine.
    const segmentStride = Math.ceil(segments.length / 160);
    const selection = segments.filter(
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
        ),
      ),
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
    return files.map((file) => ({
      id: file.id,
      nom: file.name,
      tailleKo: Math.max(1, Math.round(Number(file.sizeBytes) / 1024)),
      usages: file._count.trails,
    }));
  }

  async upload(actor: Principal, file?: Buffer, originalName?: string) {
    const data = file ?? Buffer.alloc(0);
    parseGpxUpload(data);
    const path = `trails/${randomUUID()}.gpx`;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(gpxPath(path), data, { flag: 'wx', mode: 0o600 });
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockAdmin(tx, this.sessions, actor);
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
        return { id: media.id };
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

  private async readPreview(path: string) {
    const file = await readFile(gpxPath(path)).catch(() => {
      throw new ContentInputError('Le fichier GPX est indisponible. Sélectionnez un autre fichier.');
    });
    return parseGpx(file);
  }

  async data(tx: Prisma.TransactionClient, trail: TrailDto) {
    if (!trail.name.trim()) throw new ContentInputError('Renseignez le nom du parcours.');
    const media = await tx.media.findFirst({
      where: { id: trail.gpxMediaId, ...gpxLibrary },
    });
    if (!media) throw new ContentInputError('Le fichier GPX est indisponible. Sélectionnez un autre fichier.');
    const locked = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM media WHERE id = ${media.id}::uuid FOR KEY SHARE`;
    if (!locked.length) throw new ContentInputError('Le fichier GPX est indisponible. Sélectionnez un autre fichier.');
    return {
      ...trail,
      name: trail.name.trim(),
      description: trail.description.trim(),
      mapPreview: await this.readPreview(media.path),
    };
  }

  async download(articleId: string) {
    const trail = await this.prisma.trail.findFirst({
      where: {
        version: {
          articleId,
          kind: 'PUBLISHED',
          article: { status: 'PUBLISHED' },
        },
        gpxMedia: gpxLibrary,
      },
      include: { gpxMedia: { select: { path: true } } },
    });
    if (!trail) throw new NotFoundException();
    const file = await open(gpxPath(trail.gpxMedia.path), 'r').catch(() => {
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
