import { useSyncExternalStore } from 'react'
import type { ApiAvatar, Avatar, User } from '../types'

const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace(/\/+$/, '')
const sessionLock = `projetassos-auth:${api}`

type ApiProfile = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'USER' | 'ADMIN'
  status: 'ACTIVE' | 'SUSPENDED'
  createdAt: string
  lastActiveAt: string | null
  pendingEmail: string | null
  authMethods: ('password' | 'google')[]
  avatar: ApiAvatar
  hasPersonalAvatar?: boolean
  googleAvatar?: string | null
}

type ApiPublicProfile = {
  id: string
  firstName: string
  lastInitial: string
  createdAt: string
  avatar: ApiAvatar
  commentCount: number
}

type Access = { accessToken: string; expiresIn: number }
type Snapshot = { status: 'loading' | 'ready' | 'unavailable'; user: User | null }

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly retryAfter = 0) {
    super(message)
  }
}

export function authErrorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Un problème est survenu. Réessayez.'
}

let snapshot: Snapshot = { status: 'loading', user: null }
let access: { token: string; expiresAt: number } | null = null
let restoring: Promise<User | null> | null = null
let transition = Promise.resolve()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useAuthSession() {
  return useSyncExternalStore(subscribe, () => snapshot)
}

export function useCurrentUser() {
  return useAuthSession().user
}

function publish(next: Snapshot) {
  snapshot = next
  listeners.forEach(listener => listener())
}

export function mapAvatar(avatar: ApiAvatar): Avatar {
  switch (avatar.kind) {
    case 'PERSONAL': return { type: 'image', url: avatar.url }
    case 'GOOGLE': return { type: 'google', url: avatar.url }
    case 'PRESET': return { type: 'initiales', colorIndex: avatar.preset }
    default: return { type: 'defaut' }
  }
}

function mapProfile(profile: ApiProfile): User {
  return {
    id: profile.id,
    prenom: profile.firstName,
    nom: profile.lastName,
    email: profile.email,
    role: profile.role === 'ADMIN' ? 'administrateur' : 'utilisateur',
    statut: profile.status === 'ACTIVE' ? 'actif' : 'suspendu',
    avatar: mapAvatar(profile.avatar),
    hasPersonalAvatar: profile.hasPersonalAvatar ?? profile.avatar.kind === 'PERSONAL',
    googleAvatar: profile.googleAvatar ?? undefined,
    authMethods: profile.authMethods.map(method => method === 'password' ? 'motdepasse' : 'google'),
    createdAt: profile.createdAt,
    lastActivityAt: profile.lastActiveAt ?? profile.createdAt,
    pendingEmail: profile.pendingEmail ?? undefined,
  }
}

function locked<T>(action: () => Promise<T>): Promise<T> {
  // Une rotation utilise un cookie partagé entre les onglets. Le verrou évite de rejouer le même jeton.
  const result = transition.then(() => navigator.locks ? navigator.locks.request(sessionLock, action) : action())
  transition = result.then(() => {}, () => {})
  return result
}

export function apiUrl(path: string) {
  return `${api}${path}`
}

export async function request<T>(path: string, method = 'GET', data?: object, token?: string, binary = false): Promise<T> {
  const headers = new Headers()
  if (data && !(data instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let response: Response
  try {
    response = await fetch(apiUrl(path), {
      method, headers, credentials: 'include',
      body: data instanceof FormData ? data : data === undefined ? undefined : JSON.stringify(data),
      signal: AbortSignal.timeout(25_000),
    })
  } catch {
    throw new ApiError(0, 'Impossible de joindre le serveur. Réessayez.')
  }
  if (!response.ok) {
    const body: { message?: string } | null = await response.json().catch(() => null)
    const message = typeof body?.message === 'string' ? body.message : 'La demande a échoué. Réessayez.'
    throw new ApiError(response.status, message, Math.max(0, Number(response.headers.get('Retry-After')) || 0))
  }
  if (response.status === 204 || response.status === 202) return undefined as T
  if (binary) return await response.blob() as T
  return (await response.json()) as T
}

async function accept(tokens: Access) {
  const profile = mapProfile(await request<ApiProfile>('/profiles/me', 'GET', undefined, tokens.accessToken))
  access = { token: tokens.accessToken, expiresAt: Date.now() + tokens.expiresIn * 1000 }
  publish({ status: 'ready', user: profile })
  return profile
}

function clearSession(status: Snapshot['status'] = 'ready') {
  access = null
  publish({ status, user: null })
}

export function restoreSession() {
  if (!restoring) {
    restoring = locked(async () => {
      try {
        return await accept(await request<Access>('/auth/refresh', 'POST'))
      } catch (error) {
        clearSession(error instanceof ApiError && error.status === 401 ? 'ready' : 'unavailable')
        return null
      }
    }).finally(() => { restoring = null })
  }
  return restoring
}

function requireSameAccount(expectedId: string | undefined) {
  if (!access || !expectedId || snapshot.user?.id !== expectedId) {
    throw new ApiError(401, 'Votre session a expiré. Reconnectez-vous.')
  }
  return access.token
}

async function activeToken() {
  const expectedId = snapshot.user?.id
  if (!access || access.expiresAt - Date.now() < 10_000) await restoreSession()
  return requireSameAccount(expectedId)
}

export async function protectedRequest<T>(path: string, method = 'GET', data?: object, binary = false): Promise<T> {
  const expectedId = snapshot.user?.id
  const token = await activeToken()
  try {
    return await request<T>(path, method, data, token, binary)
  } catch (error) {
    if (method !== 'GET' || !(error instanceof ApiError) || error.status !== 401) throw error
    await restoreSession()
    return request<T>(path, method, data, requireSameAccount(expectedId), binary)
  }
}

export async function revalidateSession() {
  const previous = snapshot.user
  if (!previous) return
  try {
    const profile = mapProfile(await protectedRequest<ApiProfile>('/profiles/me'))
    // Ignorer une réponse arrivée après un changement de compte ou de profil.
    if (snapshot.user === previous) publish({ status: 'ready', user: profile })
  } catch {
    // Une indisponibilité passagère laisse l’écran en place. Un échec de renouvellement efface la session.
  }
}

export function login(email: string, password: string) {
  return locked(async () => accept(await request<Access>('/auth/login', 'POST', { email, password })))
}

export function register(firstName: string, lastName: string, email: string, password: string) {
  return locked(async () => accept(await request<Access>('/auth/register', 'POST', { firstName, lastName, email, password })))
}

export async function logout() {
  const expectedId = snapshot.user?.id
  const token = await activeToken().catch(error => {
    if (snapshot.status === 'ready' && snapshot.user === null) return null
    throw error
  })
  if (!token) return
  await locked(async () => {
    try {
      await request('/auth/logout', 'POST', undefined, requireSameAccount(expectedId))
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error
    }
    if (snapshot.user?.id === expectedId) clearSession()
  })
}

export async function updateProfile(firstName: string, lastName: string) {
  const profile = mapProfile(await protectedRequest<ApiProfile>('/profiles/me', 'PATCH', { firstName, lastName }))
  if (snapshot.user?.id === profile.id) publish({ status: 'ready', user: profile })
}

export async function updateAvatar(avatar: Avatar) {
  const body = avatar.type === 'initiales' ? { kind: 'PRESET', preset: avatar.colorIndex }
    : { kind: avatar.type === 'image' ? 'PERSONAL' : avatar.type === 'google' ? 'GOOGLE' : 'DEFAULT' }
  await saveAvatar('PATCH', body)
}

export function uploadAvatar(file: File) {
  const form = new FormData()
  form.set('image', file)
  return saveAvatar('POST', form)
}

async function saveAvatar(method: 'PATCH' | 'POST', body: object) {
  const profile = mapProfile(await protectedRequest<ApiProfile>('/profiles/me/avatar', method, body))
  if (snapshot.user?.id === profile.id) publish({ status: 'ready', user: profile })
}

export async function requestEmailChange(email: string) {
  await protectedRequest('/auth/email/change', 'POST', { email })
  await revalidateSession()
}

export function requestPasswordReset(email: string) {
  return request('/auth/password/forgot', 'POST', { email })
}

export async function resetPassword(token: string, password: string, passwordConfirmation: string) {
  await request('/auth/password/reset', 'POST', { token, password, passwordConfirmation })
  await revalidateSession()
}

export async function changePassword(currentPassword: string, password: string, passwordConfirmation: string) {
  const userId = snapshot.user?.id
  await protectedRequest('/auth/password/change', 'POST', { currentPassword, password, passwordConfirmation })
  if (snapshot.user?.id === userId) clearSession()
}

export async function deleteOwnAccount() {
  const userId = snapshot.user?.id
  await protectedRequest('/users/me', 'DELETE', { confirmed: true })
  if (snapshot.user?.id === userId) clearSession()
}

export async function startGoogle(link = false) {
  try {
    const { authorizationUrl } = link
      ? await protectedRequest<{ authorizationUrl: string }>('/auth/google/link', 'POST')
      : await request<{ authorizationUrl: string }>('/auth/google/start', 'POST')
    const url = new URL(authorizationUrl)
    if (url.origin !== 'https://accounts.google.com') throw new Error()
    window.location.assign(url.href)
  } catch (error) {
    if (error instanceof ApiError && error.status === 503) {
      throw new ApiError(503, 'La connexion Google n’est pas encore configurée.')
    }
    throw error
  }
}

export async function unlinkGoogle() {
  const userId = snapshot.user?.id
  await protectedRequest('/auth/google/link', 'DELETE')
  if (snapshot.user?.id === userId) clearSession()
}

export async function getPublicProfile(id: string) {
  const profile = await protectedRequest<ApiPublicProfile>(`/profiles/${encodeURIComponent(id)}`)
  return {
    id: profile.id, prenom: profile.firstName, nom: profile.lastInitial,
    avatar: mapAvatar(profile.avatar), createdAt: profile.createdAt, commentCount: profile.commentCount,
  }
}

export async function fetchAvatar(path: string, signal: AbortSignal) {
  if (!/^\/api\/v1\/profiles\/[a-f0-9-]{36}\/avatar(?:\?v=[a-f0-9-]{36})?$/i.test(path)) throw new Error('Avatar invalide')
  const token = await activeToken()
  const response = await fetch(`${api}${path.slice('/api/v1'.length)}`, {
    headers: { Authorization: `Bearer ${token}` }, credentials: 'include', signal,
  })
  if (!response.ok) throw new Error('Avatar indisponible')
  return response.blob()
}
