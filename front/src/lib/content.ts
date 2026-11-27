import { useRef } from 'react'
import { useToast } from '../hooks/useToast'
import type { Article, Block, Category, CategoryVisual, LibraryImage, LibraryPdf, Media, MediaFolder } from '../types'
import { ApiError, apiUrl, authErrorMessage, protectedRequest } from './auth'
import { setContent, setContentError } from './db'
import type { ContentSnapshot } from './db'

type Scope = 'public' | 'admin'
const requests = { public: 0, admin: 0 }
const current: Record<Scope, Promise<void> | undefined> = { public: undefined, admin: undefined }
const loadedAt = { public: 0, admin: 0 }

export function ensureContent(scope: Scope) {
  if (current[scope]) return current[scope]
  if (Date.now() - loadedAt[scope] >= 15_000) return loadContent(scope)
}

export function loadContent(scope: Scope) {
  const revision = ++requests[scope]
  const task = (async () => {
    try {
      const data = scope === 'admin'
        ? await protectedRequest<ContentSnapshot>('/admin/content')
        : await fetch(apiUrl('/content'), { signal: AbortSignal.timeout(20000) }).then(async response => {
          if (!response.ok) throw new Error()
          return await response.json() as ContentSnapshot
        })
      if (revision === requests[scope]) {
        loadedAt[scope] = Date.now()
        setContent(scope, data)
      }
    } catch (error) {
      if (revision !== requests[scope]) return
      loadedAt[scope] = 0
      if (scope === 'admin' && error instanceof ApiError && [401, 403].includes(error.status)) setContent('admin')
      setContentError(scope)
    } finally {
      if (revision === requests[scope]) current[scope] = undefined
    }
  })()
  current[scope] = task
  return task
}

export function clearAdminContent() {
  requests.admin += 1
  current.admin = undefined
  loadedAt.admin = 0
  setContent('admin')
}

async function mutate<T>(path: string, method: string, body?: object) {
  const result = await protectedRequest<T>(`/admin/content${path}`, method, body)
  await Promise.all([loadContent('public'), loadContent('admin')])
  return result
}

type ArticleInput = Pick<Article, 'titre' | 'blocks' | 'categorieIds' | 'tagIds' | 'coverMediaId' | 'authorNameFormat'>
function articlePayload(input: ArticleInput) {
  return {
    ...input,
    // Le parcours historique est inclus dans les blocs transmis par l’éditeur.
    trail: null,
    blocks: input.blocks.map(({ type, text, url, mediaId, alt, decorative, items, slides, pdf, trail, visibility, mapSettings, location, viewPdf, downloadPdf }: Block) => ({
      type, text, url, mediaId, alt: decorative ? '' : alt, decorative, items: items?.filter(item => item.trim() !== ''),
      slides: slides?.map(slide => slide.decorative ? { ...slide, alt: '' } : slide), pdf, trail, visibility, mapSettings, location, viewPdf, downloadPdf,
    })),
  }
}

export function preparePdfVisual(id: string) {
  return protectedRequest<Media>(`/admin/content/media/${id}/pdf-visual`, 'POST')
}

export function saveArticle(input: ArticleInput, id?: string) {
  return mutate<Article>(id ? `/articles/${id}` : '/articles', id ? 'PATCH' : 'POST', articlePayload(input))
}

type Action = 'publish' | 'schedule' | 'cancel-schedule' | 'unpublish' | 'discard-work' |
  'trash' | 'restore-draft' | 'restore-published' | 'delete'

export function saveCarousel(articleIds: string[]) {
  return mutate<void>('/carousel', 'PATCH', { articleIds })
}

export function articleAction(id: string, action: Action, options?: { at?: string; confirmed?: boolean }) {
  return mutate<Article | { deleted: true }>(`/articles/${id}/actions`, 'POST', { action, ...options })
    .then(result => 'deleted' in result ? null : result)
}

export function saveClassification(kind: 'categories' | 'tags', nom: string, id?: string, visual?: CategoryVisual | null) {
  return mutate<Category>(`/classification/${kind}${id ? `/${id}` : ''}`, id ? 'PATCH' : 'POST', { nom, visual })
}

export function saveMediaClassification(id: string, categorieIds: string[], tagIds: string[]) {
  return mutate<void>(`/media/${id}/classification`, 'PATCH', { categorieIds, tagIds })
}

export function deleteClassification(kind: 'categories' | 'tags', id: string) {
  return mutate(`/classification/${kind}/${id}`, 'DELETE', { confirmed: true })
}

export function createMediaFolder(nom: string, parentId?: string) {
  return protectedRequest<MediaFolder>('/admin/content/media-folders', 'POST', { nom, parentId })
}

export function uploadMedia(image: File, nom: string, alt: string, folderId?: string, decorative?: boolean) {
  const form = new FormData()
  form.set('image', image)
  form.set('nom', nom)
  form.set('alt', decorative ? '' : alt)
  if (decorative) form.set('decorative', 'true')
  return protectedRequest<LibraryImage>(`/admin/content/media${folderId ? `?folderId=${folderId}` : ''}`, 'POST', form)
}

export const pdfTransferTimeoutMs = 5 * 60_000

export function uploadPdf(file: File, nom: string, folderId?: string) {
  const form = new FormData()
  const typedFile = !file.type || file.type === 'application/octet-stream' ? new Blob([file], { type: 'application/pdf' }) : file
  form.set('file', typedFile, file.name)
  form.set('nom', nom)
  return protectedRequest<LibraryPdf>(`/admin/content/media/pdf${folderId ? `?folderId=${folderId}` : ''}`, 'POST', form, false, pdfTransferTimeoutMs)
}

export function replaceMedia(id: string, image: File) {
  const form = new FormData()
  form.set('image', image)
  return mutate(`/media/${id}/replace`, 'POST', form)
}

export function saveMediaMetadata(id: string, nom: string, alt: string, decorative?: boolean) {
  return mutate(`/media/${id}`, 'PATCH', { nom, alt: decorative ? '' : alt, decorative })
}

export function removeMedia(id: string) {
  return mutate(`/media/${id}`, 'DELETE')
}

export function useContentAction() {
  const active = useRef(false)
  const { toast } = useToast()
  return async (action: () => Promise<void>) => {
    if (active.current) return
    active.current = true
    try {
      await action()
    } catch (error) {
      toast(authErrorMessage(error), 'erreur')
    } finally {
      active.current = false
    }
  }
}
