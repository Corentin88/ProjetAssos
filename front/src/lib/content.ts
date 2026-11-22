import { useRef } from 'react'
import { useToast } from '../hooks/useToast'
import type { Article, Block } from '../types'
import { apiUrl, authErrorMessage, protectedRequest } from './auth'
import { setContent, setContentError } from './db'
import type { ContentSnapshot } from './db'

type Scope = 'public' | 'admin'
const requests = { public: 0, admin: 0 }

export async function loadContent(scope: Scope) {
  const revision = ++requests[scope]
  try {
    const data = scope === 'admin'
      ? await protectedRequest<ContentSnapshot>('/admin/content')
      : await fetch(apiUrl('/content'), { signal: AbortSignal.timeout(20000) }).then(async response => {
        if (!response.ok) throw new Error()
        return await response.json() as ContentSnapshot
      })
    if (revision === requests[scope]) setContent(scope, data)
  } catch {
    if (revision === requests[scope]) setContentError(scope)
  }
}

export function clearAdminContent() {
  requests.admin += 1
  setContent('admin')
}

async function mutate<T>(path: string, method: string, body?: object) {
  const result = await protectedRequest<T>(`/admin/content${path}`, method, body)
  await Promise.all([loadContent('public'), loadContent('admin')])
  return result
}

type ArticleInput = Pick<Article, 'titre' | 'blocks' | 'categorieIds' | 'tagIds' | 'coverMediaId'>
function articlePayload(input: ArticleInput) {
  return {
    ...input,
    blocks: input.blocks.map(({ type, text, url, mediaId, alt, items }: Block) => ({
      type, text, url, mediaId, alt, items,
    })),
  }
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

export function saveClassification(kind: 'categories' | 'tags', nom: string, id?: string) {
  return mutate(`/classification/${kind}${id ? `/${id}` : ''}`, id ? 'PATCH' : 'POST', { nom })
}

export function deleteClassification(kind: 'categories' | 'tags', id: string) {
  return mutate(`/classification/${kind}/${id}`, 'DELETE', { confirmed: true })
}

export function uploadMedia(image: File, nom: string, alt: string) {
  const form = new FormData()
  form.set('image', image)
  form.set('nom', nom)
  form.set('alt', alt)
  return mutate('/media', 'POST', form)
}

export function replaceMedia(id: string, image: File) {
  const form = new FormData()
  form.set('image', image)
  return mutate(`/media/${id}/replace`, 'POST', form)
}

export function saveMediaMetadata(id: string, nom: string, alt: string) {
  return mutate(`/media/${id}`, 'PATCH', { nom, alt })
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
