import { API_CONFIG } from '../../config/apiConfig'
import { ApiError } from './apiErrors'

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
  meta?: {
    page: number
    limit: number
    total: number
    totalPages: number
  } | null
  code?: string | null
  errors?: Array<{ field: string; message: string }> | null
  missingFields?: Array<{ field: string; label: string }> | null
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  tenantId: string
  tenantSlug: string
  /** Epoch ms when the access token should be treated as expired (client-side). */
  accessTokenExpiresAt?: number
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    roles: string[]
    permissions: string[]
  }
}

const TOKEN_KEY = 'fos-erp-auth'
const AUTH_SESSION_EVENT = 'fos-erp-auth-session'
/** Refresh slightly before real expiry to avoid mid-request 401 storms. */
const ACCESS_EXPIRY_SKEW_MS = 60_000
const DEFAULT_ACCESS_TTL_MS = 15 * 60_000

type AuthSessionListener = (session: AuthSession | null) => void
const sessionListeners = new Set<AuthSessionListener>()

export function subscribeAuthSession(listener: AuthSessionListener): () => void {
  sessionListeners.add(listener)
  return () => {
    sessionListeners.delete(listener)
  }
}

function notifyAuthSession(session: AuthSession | null): void {
  for (const listener of sessionListeners) {
    try {
      listener(session)
    } catch {
      // ignore listener errors
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_SESSION_EVENT, { detail: session }))
  }
}

export function getStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as AuthSession
    if (!session.accessTokenExpiresAt && session.accessToken) {
      return withAccessExpiry(session)
    }
    return session
  } catch {
    return null
  }
}

export function setStoredSession(session: AuthSession | null): void {
  if (!session) {
    localStorage.removeItem(TOKEN_KEY)
    notifyAuthSession(null)
    return
  }
  localStorage.setItem(TOKEN_KEY, JSON.stringify(session))
  notifyAuthSession(session)
}

export function withAccessExpiry(session: AuthSession, expiresInMs?: number): AuthSession {
  if (expiresInMs && expiresInMs > 0) {
    return {
      ...session,
      accessTokenExpiresAt: Date.now() + expiresInMs,
    }
  }
  const fromJwt = readJwtExpiryMs(session.accessToken)
  if (fromJwt) {
    return { ...session, accessTokenExpiresAt: fromJwt }
  }
  return {
    ...session,
    accessTokenExpiresAt: Date.now() + DEFAULT_ACCESS_TTL_MS,
  }
}

function readJwtExpiryMs(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number }
    return typeof json.exp === 'number' ? json.exp * 1000 : null
  } catch {
    return null
  }
}

function accessTokenNeedsRefresh(session: AuthSession | null): boolean {
  if (!session?.accessToken || !session.refreshToken) return false
  if (!session.accessTokenExpiresAt) return false
  return Date.now() >= session.accessTokenExpiresAt - ACCESS_EXPIRY_SKEW_MS
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const session = getStoredSession()
  if (!session?.refreshToken) return null

  let res: Response
  try {
    res = await fetch(`${API_CONFIG.baseUrl}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    })
  } catch {
    return null
  }

  if (!res.ok) {
    setStoredSession(null)
    return null
  }

  let body: ApiResponse<{ accessToken: string; refreshToken: string; expiresIn?: number }>
  try {
    body = (await res.json()) as ApiResponse<{
      accessToken: string
      refreshToken: string
      expiresIn?: number
    }>
  } catch {
    setStoredSession(null)
    return null
  }

  if (!body.success || !body.data?.accessToken || !body.data?.refreshToken) {
    setStoredSession(null)
    return null
  }

  const updated = withAccessExpiry(
    {
      ...session,
      accessToken: body.data.accessToken,
      refreshToken: body.data.refreshToken,
    },
    body.data.expiresIn,
  )
  setStoredSession(updated)
  return updated.accessToken
}

/** Single-flight refresh used by apiRequest and proactive refresh. */
export async function ensureFreshAccessToken(): Promise<string | null> {
  const session = getStoredSession()
  if (!session?.accessToken) return null

  if (!accessTokenNeedsRefresh(session) && session.accessToken) {
    return session.accessToken
  }

  if (!session.refreshToken) return session.accessToken

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null
    })
  }
  const token = await refreshPromise
  return token ?? getStoredSession()?.accessToken ?? null
}

function looksLikeHtml(text: string): boolean {
  const trimmed = text.trimStart().slice(0, 32).toLowerCase()
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')
}

const HTML_INSTEAD_OF_JSON_MESSAGE =
  'API returned a web page instead of JSON. The server is not routing /api/ to the backend (check nginx/.htaccess and that Node is running).'

async function parseErrorBody(res: Response): Promise<{
  message: string
  errors?: ApiResponse<unknown>['errors']
  code?: string | null
  missingFields?: ApiResponse<unknown>['missingFields']
}> {
  const raw = await res.text()
  if (looksLikeHtml(raw)) {
    return { message: HTML_INSTEAD_OF_JSON_MESSAGE }
  }
  try {
    const body = JSON.parse(raw) as ApiResponse<unknown>
    return {
      message: body.message || `API error ${res.status}`,
      errors: body.errors ?? undefined,
      code: body.code,
      missingFields: body.missingFields ?? undefined,
    }
  } catch {
    return { message: `API error ${res.status}` }
  }
}

async function parseJsonBody<T>(res: Response): Promise<ApiResponse<T>> {
  const raw = await res.text()
  if (looksLikeHtml(raw)) {
    throw new ApiError(HTML_INSTEAD_OF_JSON_MESSAGE, res.status || 502)
  }
  try {
    return JSON.parse(raw) as ApiResponse<T>
  } catch {
    throw new ApiError(
      `Invalid API response (expected JSON, got ${res.headers.get('content-type') ?? 'unknown'}). Is the backend running?`,
      res.status || 502,
    )
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  let session = getStoredSession()
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  let accessToken = session?.accessToken
  if (session && accessTokenNeedsRefresh(session)) {
    accessToken = (await ensureFreshAccessToken()) ?? accessToken
    session = getStoredSession()
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  let res = await fetch(`${API_CONFIG.baseUrl}${path}`, { ...options, headers })

  if (res.status === 401 && session?.refreshToken) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null
      })
    }
    const newToken = await refreshPromise
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`)
      res = await fetch(`${API_CONFIG.baseUrl}${path}`, { ...options, headers })
    } else {
      throw new ApiError('Session expired. Please sign in again.', 401)
    }
  }

  if (res.status === 401) {
    setStoredSession(null)
    const err = await parseErrorBody(res)
    throw new ApiError(
      err.message === 'Invalid or expired access token'
        ? 'Session expired. Please sign in again.'
        : err.message,
      401,
      err.errors ?? undefined,
      err.code ?? undefined,
      err.missingFields ?? undefined,
    )
  }

  const body = await parseJsonBody<T>(res)
  if (!res.ok || !body.success) {
    throw new ApiError(
      body.message || `API error ${res.status}`,
      res.status,
      body.errors ?? undefined,
      body.code ?? undefined,
      body.missingFields ?? undefined,
    )
  }
  return body
}

export function tenantPath(resource: string): string {
  const session = getStoredSession()
  const slug = session?.tenantSlug ?? API_CONFIG.tenantSlug
  return `/t/${slug}${resource}`
}

/** Authenticated blob download (CSV exports, attachment files). */
export async function apiDownloadBlob(path: string): Promise<{ blob: Blob; filename?: string }> {
  let session = getStoredSession()
  const headers = new Headers()

  let accessToken = session?.accessToken
  if (session && accessTokenNeedsRefresh(session)) {
    accessToken = (await ensureFreshAccessToken()) ?? accessToken
    session = getStoredSession()
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  let res = await fetch(`${API_CONFIG.baseUrl}${path}`, { headers })

  if (res.status === 401 && session?.refreshToken) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null
      })
    }
    const newToken = await refreshPromise
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`)
      res = await fetch(`${API_CONFIG.baseUrl}${path}`, { headers })
    } else {
      throw new ApiError('Session expired. Please sign in again.', 401)
    }
  }

  if (!res.ok) {
    if (res.status === 401) setStoredSession(null)
    let message = `Download failed (${res.status})`
    try {
      const body = (await res.json()) as ApiResponse<unknown>
      if (body.message) {
        message =
          body.message === 'Invalid or expired access token'
            ? 'Session expired. Please sign in again.'
            : body.message
      }
    } catch {
      // non-JSON error body
    }
    throw new ApiError(message, res.status)
  }

  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename="([^"]+)"/)
  const blob = await res.blob()
  return { blob, filename: match?.[1] }
}

/** Authenticated blob download for POST endpoints that accept a filter body (e.g. report exports). */
export async function apiPostDownloadBlob(
  path: string,
  body: unknown = {},
): Promise<{ blob: Blob; filename?: string }> {
  let session = getStoredSession()
  const headers = new Headers({ 'Content-Type': 'application/json' })

  let accessToken = session?.accessToken
  if (session && accessTokenNeedsRefresh(session)) {
    accessToken = (await ensureFreshAccessToken()) ?? accessToken
    session = getStoredSession()
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const init: RequestInit = { method: 'POST', headers, body: JSON.stringify(body ?? {}) }
  let res = await fetch(`${API_CONFIG.baseUrl}${path}`, init)

  if (res.status === 401 && session?.refreshToken) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null
      })
    }
    const newToken = await refreshPromise
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`)
      res = await fetch(`${API_CONFIG.baseUrl}${path}`, { ...init, headers })
    } else {
      throw new ApiError('Session expired. Please sign in again.', 401)
    }
  }

  if (!res.ok) {
    if (res.status === 401) setStoredSession(null)
    let message = `Export failed (${res.status})`
    try {
      const body2 = (await res.json()) as ApiResponse<unknown>
      if (body2.message) {
        message =
          body2.message === 'Invalid or expired access token'
            ? 'Session expired. Please sign in again.'
            : body2.message
      }
    } catch {
      // non-JSON error body
    }
    throw new ApiError(message, res.status)
  }

  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename="([^"]+)"/)
  const blob = await res.blob()
  return { blob, filename: match?.[1] }
}
