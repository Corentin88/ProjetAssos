import type { CategoryVisual } from '../../types'
import { mediaUrl } from '../../lib/assets'
import { getMedia } from '../../lib/selectors'
import { ContentImage } from './ContentImage'
import { categoryIcons } from './categoryIcons'

export function CategoryVisualMark({ visual, size = 'h-5 w-5' }: {
  visual?: CategoryVisual | null
  size?: string
}) {
  if (!visual) return null
  const Icon = categoryIcons.find(item => item.id === visual.icon)?.Icon
  if (Icon) return <Icon aria-hidden="true" className={`${size} shrink-0`} />
  const media = getMedia(visual.mediaId)
  return media ? <ContentImage src={mediaUrl(media.file)} alt="" className={`${size} shrink-0 rounded-md object-cover`} /> : null
}
