import type { Article, Block, LocationBlockFields, TrailBlockFields, TrailMapSettings, TrailVisibility } from '../types'

export const emptyTrail: TrailBlockFields = {
  name: '', description: '', difficulty: null, distance: null, durationSeconds: null,
  departureAt: null, arrivalAt: null, elevationGain: null, elevationLoss: null, elevationMin: null, elevationMax: null,
}

export const defaultTrailVisibility: TrailVisibility = {
  distance: true, duration: true, dates: true, elevation: true, altitude: true,
  difficulty: true, description: true, map: true, download: true,
}

export const defaultTrailMapSettings: TrailMapSettings = { slopes: true, profile: true, initialMode: 'classic' }

export const emptyLocation: LocationBlockFields = {
  title: '', address: '', description: '', latitude: null, longitude: null,
}

export function editableArticleBlocks(article?: Article): Block[] {
  if (!article) return []
  const legacy = article.trail
  if (!legacy) return article.blocks
  const { name, description, difficulty, distance, elevationGain, elevationLoss, duration, gpxMediaId, mapPreview } = legacy
  return [...article.blocks, {
    id: `parcours-${article.id}`,
    type: 'randonnee',
    mediaId: gpxMediaId,
    trail: { ...emptyTrail, name, description, difficulty, distance, elevationGain, elevationLoss, durationSeconds: duration * 60 },
    mapPreview,
    visibility: defaultTrailVisibility,
  }]
}
