import { useEffect, useState } from 'react'
import type { ComponentProps } from 'react'
import { protectedRequest } from '../../lib/auth'

export function ContentImage({ src, ...props }: ComponentProps<'img'>) {
  const protectedPath = src?.startsWith('/admin/content/media/') ? src : undefined
  const [loaded, setLoaded] = useState<{ path: string; url: string }>()
  useEffect(() => {
    if (!protectedPath) return
    let alive = true
    let objectUrl: string | undefined
    void protectedRequest<Blob>(protectedPath, 'GET', undefined, true).then(blob => {
      if (alive) {
        objectUrl = URL.createObjectURL(blob)
        setLoaded({ path: protectedPath, url: objectUrl })
      }
    }).catch(() => {})
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [protectedPath])
  return <img {...props} src={protectedPath ? (loaded?.path === protectedPath ? loaded.url : undefined) : src} />
}
