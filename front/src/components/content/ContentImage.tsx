import { useEffect, useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import { protectedRequest } from '../../lib/auth'

export function ContentImage({ src, ...props }: ComponentProps<'img'>) {
  const protectedPath = src?.startsWith('/admin/content/media/') ? src : undefined
  const [loaded, setLoaded] = useState<{ path: string; url: string }>()
  const ref = useRef<HTMLImageElement>(null)
  useEffect(() => {
    if (!protectedPath) return
    let alive = true
    let objectUrl: string | undefined
    function load() {
      if (!protectedPath) return
      void protectedRequest<Blob>(protectedPath, 'GET', undefined, true).then(blob => {
        if (alive) {
          objectUrl = URL.createObjectURL(blob)
          setLoaded({ path: protectedPath, url: objectUrl })
        }
      }).catch(() => {})
    }
    // Les miniatures protégées passent par fetch, hors du chargement différé natif.
    const observer = props.loading === 'lazy' && ref.current && typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(entries => {
          if (!entries.some(entry => entry.isIntersecting)) return
          observer?.disconnect()
          load()
        }, { rootMargin: '160px' })
      : undefined
    if (observer && ref.current) observer.observe(ref.current)
    else load()
    return () => {
      alive = false
      observer?.disconnect()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [protectedPath, props.loading])
  return <img {...props} ref={ref} src={protectedPath ? (loaded?.path === protectedPath ? loaded.url : undefined) : src} />
}
