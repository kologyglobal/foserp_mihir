import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import { env, getClientHeaders, assertApiConfigured } from '@/config/env'
import {
  ApiError,
  SESSION_EXPIRED_MESSAGE,
  getUserFriendlyMessage,
  mapLoginErrorMessage,
} from '@/api/errors'
import type { ApiEnvelope, SecureSession } from '@/types/api'

type SessionAccessor = {
  getSession: () => SecureSession | null
  setSession: (session: SecureSession | null) => Promise<void>
  onSessionExpired: (message: string) => void
}

let sessionAccessor: SessionAccessor | null = null
let refreshPromise: Promise<string | null> | null = null

export function bindSessionAccessor(accessor: SessionAccessor): void {
  sessionAccessor = accessor
}

function getAccessor(): SessionAccessor {
  if (!sessionAccessor) {
    throw new Error('API client session accessor is not bound. Mount AppProviders first.')
  }
  return sessionAccessor
}

function createAxios(): AxiosInstance {
  assertApiConfigured()
  return axios.create({
    baseURL: env.apiBaseUrl,
    timeout: env.apiTimeoutMs,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getClientHeaders(),
    },
  })
}

const axiosInstance = (() => {
  try {
    return createAxios()
  } catch {
    // Allow module import before env is set (e.g. unit scripts); recreate on first request.
    return axios.create({
      timeout: env.apiTimeoutMs,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getClientHeaders(),
      },
    })
  }
})()

function ensureBaseUrl(): void {
  assertApiConfigured()
  if (axiosInstance.defaults.baseURL !== env.apiBaseUrl) {
    axiosInstance.defaults.baseURL = env.apiBaseUrl
  }
}

function accessTokenNeedsRefresh(session: SecureSession): boolean {
  if (!session.accessTokenExpiresAt) return true
  return Date.now() >= session.accessTokenExpiresAt - env.accessTokenSkewMs
}

async function performRefresh(): Promise<string | null> {
  const accessor = getAccessor()
  const session = accessor.getSession()
  if (!session?.refreshToken) {
    await accessor.setSession(null)
    accessor.onSessionExpired(SESSION_EXPIRED_MESSAGE)
    return null
  }

  try {
    ensureBaseUrl()
    const res = await axios.post<ApiEnvelope<{
      accessToken: string
      refreshToken: string
      expiresIn: number
    }>>(
      `${env.apiBaseUrl}/auth/refresh-token`,
      { refreshToken: session.refreshToken },
      {
        timeout: env.apiTimeoutMs,
        headers: {
          'Content-Type': 'application/json',
          ...getClientHeaders(),
        },
      },
    )

    const body = res.data
    if (!body.success || !body.data?.accessToken) {
      throw new ApiError(body.message || SESSION_EXPIRED_MESSAGE, {
        status: 401,
        kind: 'session_expired',
      })
    }

    const next: SecureSession = {
      ...session,
      accessToken: body.data.accessToken,
      refreshToken: body.data.refreshToken,
      accessTokenExpiresAt: Date.now() + (body.data.expiresIn || 15 * 60 * 1000),
    }
    await accessor.setSession(next)
    return next.accessToken
  } catch {
    await accessor.setSession(null)
    accessor.onSessionExpired(SESSION_EXPIRED_MESSAGE)
    return null
  }
}

/** Single-flight refresh — concurrent callers share one request. */
export async function ensureFreshAccessToken(): Promise<string | null> {
  const session = getAccessor().getSession()
  if (!session?.accessToken) return null
  if (!accessTokenNeedsRefresh(session)) return session.accessToken
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<ApiEnvelope<unknown>>
    if (ax.code === 'ECONNABORTED') {
      return new ApiError('The request timed out. Please try again.', {
        status: 0,
        kind: 'timeout',
      })
    }
    if (!ax.response) {
      return new ApiError(
        'Cannot reach the server. Check your connection and API URL.',
        { status: 0, kind: 'network' },
      )
    }

    const status = ax.response.status
    const data = ax.response.data
    const message =
      (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
        ? data.message
        : ax.message) || `API error ${status}`
    const code =
      data && typeof data === 'object' && 'code' in data && data.code != null
        ? String(data.code)
        : null
    const fieldErrors =
      data && typeof data === 'object' && Array.isArray((data as ApiEnvelope<unknown>).errors)
        ? ((data as ApiEnvelope<unknown>).errors ?? [])
        : []

    if (status === 401) {
      return new ApiError(
        message === 'Invalid or expired access token' ? SESSION_EXPIRED_MESSAGE : message,
        { status, code, kind: 'session_expired', fieldErrors: fieldErrors ?? [] },
      )
    }

    return new ApiError(message, { status, code, fieldErrors: fieldErrors ?? [] })
  }

  return new ApiError(getUserFriendlyMessage(error), { kind: 'unknown' })
}

export type RequestOptions = {
  /** Skip Authorization header (login/refresh). */
  skipAuth?: boolean
  /** Treat path as absolute under base (default true joins baseURL). */
  headers?: Record<string, string>
  params?: Record<string, string | number | boolean | undefined>
  timeoutMs?: number
  /** Retry once on network failure (not on 4xx). Default 0 for writes, 1 for GET. */
  retries?: number
  signal?: AbortSignal
}

async function rawRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  data?: unknown,
  options: RequestOptions = {},
  isRetry = false,
): Promise<ApiEnvelope<T>> {
  ensureBaseUrl()
  const accessor = getAccessor()
  const headers: Record<string, string> = {
    ...getClientHeaders(),
    ...(options.headers ?? {}),
  }

  if (!options.skipAuth) {
    let session = accessor.getSession()
    let token = session?.accessToken
    if (session && accessTokenNeedsRefresh(session)) {
      token = (await ensureFreshAccessToken()) ?? undefined
      session = accessor.getSession()
      if (!token) {
        throw new ApiError(SESSION_EXPIRED_MESSAGE, { status: 401, kind: 'session_expired' })
      }
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  const config: AxiosRequestConfig = {
    method,
    url: path.startsWith('/') ? path : `/${path}`,
    data,
    params: options.params,
    headers,
    timeout: options.timeoutMs ?? env.apiTimeoutMs,
    signal: options.signal,
  }

  try {
    const res = await axiosInstance.request<ApiEnvelope<T>>(config)
    const body = res.data
    if (!body || typeof body !== 'object' || body.success === false) {
      throw new ApiError(
        (body && 'message' in body && body.message) || `API error ${res.status}`,
        {
          status: res.status,
          code: body && 'code' in body ? (body.code as string | null) : null,
          fieldErrors: body && Array.isArray(body.errors) ? body.errors : [],
        },
      )
    }
    return body
  } catch (error) {
    const apiError = toApiError(error)

    if (
      !options.skipAuth &&
      apiError.status === 401 &&
      !isRetry &&
      accessor.getSession()?.refreshToken
    ) {
      const newToken = await ensureFreshAccessToken()
      if (newToken) {
        return rawRequest<T>(method, path, data, options, true)
      }
      throw new ApiError(SESSION_EXPIRED_MESSAGE, { status: 401, kind: 'session_expired' })
    }

    const maxRetries = options.retries ?? (method === 'GET' ? 1 : 0)
    if (
      !isRetry &&
      maxRetries > 0 &&
      (apiError.kind === 'network' || apiError.kind === 'timeout')
    ) {
      return rawRequest<T>(method, path, data, { ...options, retries: maxRetries - 1 }, true)
    }

    throw apiError
  }
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    rawRequest<T>('GET', path, undefined, options),
  post: <T>(path: string, data?: unknown, options?: RequestOptions) =>
    rawRequest<T>('POST', path, data, options),
  put: <T>(path: string, data?: unknown, options?: RequestOptions) =>
    rawRequest<T>('PUT', path, data, options),
  patch: <T>(path: string, data?: unknown, options?: RequestOptions) =>
    rawRequest<T>('PATCH', path, data, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    rawRequest<T>('DELETE', path, undefined, options),
}

/**
 * Build tenant-scoped path: `/t/:tenantSlug/…`
 * Prefer session slug; allow override for multi-tenant tooling.
 */
export function tenantPath(resource: string, tenantSlug?: string): string {
  const slug =
    tenantSlug ?? getAccessor().getSession()?.tenantSlug ?? env.defaultTenantSlug
  if (!slug) {
    throw new ApiError('Tenant is not selected. Sign in again.', {
      status: 400,
      kind: 'validation',
    })
  }
  const cleaned = resource.startsWith('/') ? resource : `/${resource}`
  return `/t/${slug}${cleaned}`
}

export async function loginRequest(input: {
  tenantSlug: string
  email: string
  password: string
}): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: import('@/types/api').AuthUser
}> {
  ensureBaseUrl()
  try {
    const body = await apiClient.post<{
      accessToken: string
      refreshToken: string
      expiresIn: number
      user: import('@/types/api').AuthUser
    }>('/auth/login', input, { skipAuth: true, retries: 0 })
    return body.data
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ApiError(mapLoginErrorMessage(error.message, error.status), {
        status: error.status,
        code: error.code,
        kind: error.kind,
        fieldErrors: error.fieldErrors,
      })
    }
    throw error
  }
}

export async function logoutRequest(refreshToken?: string): Promise<void> {
  try {
    await apiClient.post(
      '/auth/logout',
      refreshToken ? { refreshToken } : {},
      { retries: 0 },
    )
  } catch {
    // Best-effort — always clear local session
  }
}

export { axiosInstance }
