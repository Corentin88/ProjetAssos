import type { Prisma } from '../../generated/prisma/client.js';
import type { BlockDto } from './content.dto.js';
import { ContentInputError } from './content-input.error.js';
import type { LocationBlockDto, TrailBlockFieldsDto, TrailMapSettingsDto, TrailVisibilityDto } from './map-blocks.dto.js';
import type { Point } from './gpx-details.js';

type MapPreview = {
  segments: Point[][];
  enrichedAvailable?: boolean;
  elevationSource?: 'gpx' | 'ign' | 'mixed' | null;
};
export const defaultMapSettings: TrailMapSettingsDto = { slopes: true, profile: true, initialMode: 'classic' };
type StoredTrail = TrailBlockFieldsDto & {
  visibility: TrailVisibilityDto;
  mapPreview: MapPreview | null;
  gpxMediaId: string | null;
  mapSettings?: TrailMapSettingsDto;
};
type StoredMapBlock =
  | { kind: 'randonnee'; trail: StoredTrail }
  | { kind: 'localisation'; location: LocationBlockDto };

export function mapBlockInput(block: BlockDto, position: number, mapPreview: MapPreview | null) {
  // Le discriminant JSON étend les blocs sans changer l’enum PostgreSQL.
  // La colonne media_id est réservée aux images par une contrainte SQL.
  const base = { type: 'PARAGRAPH' as const, position };
  if (block.type === 'localisation' && block.location) {
    const { title, address, description, latitude, longitude } = block.location;
    return {
      ...base,
      data: { kind: 'localisation', location: {
        title: title.trim(), address: address.trim(), description: description.trim(),
        latitude: latitude ?? null, longitude: longitude ?? null,
      } } satisfies Prisma.InputJsonObject,
    };
  }
  if (block.type !== 'randonnee' || !block.trail || !block.visibility)
    throw new ContentInputError(`Bloc ${position + 1} : renseignez les informations du bloc.`);
  const mapSettings = block.mapSettings ?? defaultMapSettings;
  if (!mapSettings.slopes && mapSettings.initialMode === 'slopes')
    throw new ContentInputError(`Bloc ${position + 1} : autorisez les pentes en couleur ou choisissez le tracé classique.`);
  const { name, description, distance, durationSeconds, estimatedDurationSeconds, departureAt, arrivalAt, elevationGain, elevationLoss, elevationMin, elevationMax, difficulty } = block.trail;
  const departure = departureAt ? Date.parse(departureAt) : null;
  const arrival = arrivalAt ? Date.parse(arrivalAt) : null;
  if (Number.isNaN(departure) || Number.isNaN(arrival))
    throw new ContentInputError(`Bloc ${position + 1} : vérifiez les dates et heures du parcours.`);
  if (departure !== null && arrival !== null && arrival < departure)
    throw new ContentInputError(`Bloc ${position + 1} : l’arrivée doit suivre le départ.`);
  if (elevationMin != null && elevationMax != null && elevationMax < elevationMin)
    throw new ContentInputError(`Bloc ${position + 1} : l’altitude maximale doit être supérieure ou égale à l’altitude minimale.`);
  return {
    ...base,
    data: { kind: 'randonnee', trail: {
      name: name.trim(), description: description.trim(), distance: distance ?? null,
      durationSeconds: durationSeconds ?? null,
      estimatedDurationSeconds: estimatedDurationSeconds ?? null,
      departureAt: departure === null ? null : new Date(departure).toISOString(),
      arrivalAt: arrival === null ? null : new Date(arrival).toISOString(),
      elevationGain: elevationGain ?? null, elevationLoss: elevationLoss ?? null,
      elevationMin: elevationMin ?? null, elevationMax: elevationMax ?? null, difficulty: difficulty ?? null,
      visibility: { ...block.visibility }, mapSettings: { ...mapSettings }, mapPreview, gpxMediaId: block.mediaId ?? null,
    } } satisfies Prisma.InputJsonObject,
  };
}

export function storedMapBlock(type: string, data: Prisma.JsonValue) {
  if (type !== 'PARAGRAPH' || !data || typeof data !== 'object' || Array.isArray(data)) return;
  if (data.kind === 'randonnee' || data.kind === 'localisation') return data as unknown as StoredMapBlock;
}

export function presentMapBlock(block: StoredMapBlock, id: string, admin: boolean) {
  if (block.kind === 'localisation') return { id, type: block.kind, location: block.location };
  const { visibility, mapPreview, gpxMediaId, mapSettings = defaultMapSettings, ...trail } = block.trail;
  return {
    id,
    type: block.kind,
    mediaId: admin ? gpxMediaId ?? undefined : undefined,
    gpxAvailable: Boolean(gpxMediaId && mapPreview?.segments.some(segment => segment.length >= 2)),
    elevationSource: admin || visibility.elevation || visibility.altitude || visibility.map ? mapPreview?.elevationSource : undefined,
    visibility,
    mapSettings,
    mapPreview: admin || visibility.map ? mapPreview : null,
    trail: admin ? trail : {
      name: trail.name,
      description: visibility.description ? trail.description : '',
      distance: visibility.distance ? trail.distance : null,
      durationSeconds: visibility.duration ? trail.durationSeconds : null,
      estimatedDurationSeconds: visibility.estimatedDuration ? trail.estimatedDurationSeconds ?? null : null,
      departureAt: visibility.dates && visibility.departure !== false ? trail.departureAt : null,
      arrivalAt: visibility.dates && visibility.arrival !== false ? trail.arrivalAt : null,
      elevationGain: visibility.elevation && visibility.elevationGain !== false ? trail.elevationGain : null,
      elevationLoss: visibility.elevation && visibility.elevationLoss !== false ? trail.elevationLoss : null,
      elevationMin: visibility.altitude && visibility.elevationMin !== false ? trail.elevationMin : null,
      elevationMax: visibility.altitude && visibility.elevationMax !== false ? trail.elevationMax : null,
      difficulty: visibility.difficulty ? trail.difficulty : null,
    },
  };
}
