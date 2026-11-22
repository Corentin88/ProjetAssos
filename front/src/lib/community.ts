import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { AssociationPage, Block, Comment, ContactMessage, UserNotification } from '../types'
import { authErrorMessage, protectedRequest, request, useCurrentUser } from './auth'

export function useResource<T>(path: string | undefined, secure = false) {
  const user = useCurrentUser()
  const key = path && (!secure || user) ? `${secure ? user?.id : 'public'}:${path}` : undefined
  const revision = useRef(0)
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>()
  const refresh = useCallback(async () => {
    const current = ++revision.current
    if (!key || !path) return
    try {
      const data = await (secure ? protectedRequest<T>(path) : request<T>(path))
      if (current === revision.current) setResult({ key, data })
    } catch (error) {
      if (current === revision.current) setResult({ key, error: authErrorMessage(error) })
    }
  }, [key, path, secure])
  useEffect(() => {
    void refresh()
    return () => { revision.current += 1 }
  }, [refresh])
  return { data: result?.key === key ? result?.data : undefined,
    error: result?.key === key ? result?.error : undefined, refresh }
}

export const isDeletedComment = (comment: Comment) => comment.deletedByAuthor || Boolean(comment.deletedByAdmin || comment.moderation)

export function createComment(articleId: string, contenu: string, parentId: string | null) {
  return protectedRequest<Comment>(`/articles/${articleId}/comments`, 'POST', { contenu, parentId })
}
export function editComment(id: string, contenu: string, admin = false) {
  return protectedRequest(`${admin ? '/admin' : ''}/comments/${id}`, 'PATCH', { contenu })
}
export function deleteComment(id: string) {
  return protectedRequest(`/comments/${id}`, 'DELETE')
}
export const moderationReasons = {
  'Spam': 'SPAM',
  'Insulte / comportement inapproprié': 'INAPPROPRIATE',
  'Contenu hors sujet': 'OFF_TOPIC',
  'Contenu illégal': 'ILLEGAL',
  'Autre': 'OTHER',
} as const
export function moderateComment(id: string, reason: keyof typeof moderationReasons, precision?: string) {
  return protectedRequest(`/admin/comments/${id}/moderation`, 'POST', { motif: moderationReasons[reason], precision })
}

const emptyNotifications: UserNotification[] = []
let notices = { owner: '', data: emptyNotifications, error: '' }
const subscribers = new Set<() => void>()
let notificationRequest = 0

function subscribe(listener: () => void) {
  subscribers.add(listener)
  return () => { subscribers.delete(listener) }
}
function publishNotifications(next: typeof notices) {
  notices = next
  subscribers.forEach(listener => listener())
}
export async function loadNotifications(owner?: string) {
  const revision = ++notificationRequest
  if (!owner) { publishNotifications({ owner: '', data: emptyNotifications, error: '' }); return }
  try {
    const data = await protectedRequest<UserNotification[]>('/me/notifications')
    if (revision === notificationRequest) publishNotifications({ owner, data: data.filter(item => item.userId === owner), error: '' })
  } catch (error) {
    if (revision === notificationRequest) publishNotifications({
      owner, data: notices.owner === owner ? notices.data : emptyNotifications, error: authErrorMessage(error),
    })
  }
}
export function useNotifications() {
  const user = useCurrentUser()
  const state = useSyncExternalStore(subscribe, () => notices)
  return state.owner === user?.id ? state : { data: emptyNotifications, error: '' }
}
export async function changeNotifications(owner: string, action: 'read' | 'delete', id?: string) {
  const path = `/me/notifications${id ? `/${id}` : ''}${action === 'read' ? '/read' : ''}`
  await protectedRequest(path, action === 'read' ? 'PATCH' : 'DELETE')
  await loadNotifications(owner)
}

export function blockPayload(blocks: Block[]) {
  return blocks.map(({ type, text, url, mediaId, alt, items }) => ({ type, text, url, mediaId, alt, items }))
}
export function saveAssociation(blocks: Block[], coordonnees: AssociationPage['coordonnees']) {
  return protectedRequest<AssociationPage>('/admin/association', 'PATCH', { blocks: blockPayload(blocks), coordonnees })
}
export function sendContact(data: Pick<ContactMessage, 'prenom' | 'nom' | 'email' | 'sujet' | 'message'> & { site_web: string; consentement: boolean }) {
  return request('/contact', 'POST', data)
}
