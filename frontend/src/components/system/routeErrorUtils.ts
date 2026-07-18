import { isRouteErrorResponse } from 'react-router-dom'

export type RouteErrorKind =
  | 'not-found'
  | 'permission-denied'
  | 'unauthenticated'
  | 'chunk-load'
  | 'api'
  | 'crash'

const CHUNK_LOAD_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /loading chunk [\d]+ failed/i,
  /loading css chunk/i,
  /importing a module script failed/i,
  /error loading dynamically imported module/i,
  /chunkloaderror/i,
]

/** True when a dynamic import / Vite chunk failed to load (stale deploy, network blip). */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false
  if (typeof error === 'object' && error !== null && 'name' in error) {
    const name = String((error as { name?: string }).name)
    if (name === 'ChunkLoadError' || name === 'CSSChunkLoadError') return true
  }
  const message = error instanceof Error ? error.message : String(error)
  return CHUNK_LOAD_PATTERNS.some((re) => re.test(message))
}

function looksLikeApiError(error: unknown): boolean {
  if (isRouteErrorResponse(error)) {
    const status = error.status
    return status >= 400 && status !== 401 && status !== 403 && status !== 404
  }
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('api') ||
    msg.includes('timeout') ||
    msg.includes('http') ||
    /\b[45]\d{2}\b/.test(msg)
  )
}

export function classifyRouteError(error: unknown): RouteErrorKind {
  if (isChunkLoadError(error)) return 'chunk-load'

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) return 'not-found'
    if (error.status === 403) return 'permission-denied'
    if (error.status === 401) return 'unauthenticated'
    if (error.status >= 400) return 'api'
  }

  if (looksLikeApiError(error)) return 'api'
  return 'crash'
}

export function formatRouteErrorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    const data =
      typeof error.data === 'string'
        ? error.data
        : error.data && typeof error.data === 'object' && 'message' in error.data
          ? String((error.data as { message: unknown }).message)
          : ''
    return [error.status, error.statusText, data].filter(Boolean).join(' — ')
  }
  if (error instanceof Error) return error.message || 'Unknown error'
  return String(error ?? 'Unknown error')
}
