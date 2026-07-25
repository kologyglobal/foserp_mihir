export type IndiaMartErrorCode =
  | 'AUTHENTICATION'
  | 'RATE_LIMIT'
  | 'REMOTE_TIMEOUT'
  | 'REMOTE_SERVER'
  | 'PAYLOAD_INVALID'
  | 'MAPPING_FAILED'
  | 'VALIDATION_FAILED'
  | 'DUPLICATE'
  | 'CRM_IMPORT_FAILED'
  | 'INTERNAL'
  | 'SSRF_BLOCKED'
  | 'NOT_CONFIGURED'
  | 'SYNC_IN_PROGRESS'

export class IndiaMartError extends Error {
  readonly code: IndiaMartErrorCode
  readonly details?: unknown
  readonly statusCode: number

  constructor(code: IndiaMartErrorCode, message: string, statusCode = 400, details?: unknown) {
    super(message)
    this.name = 'IndiaMartError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

export function classifyRemoteStatus(status: number, message?: string): IndiaMartError {
  if (status === 401 || status === 403) {
    return new IndiaMartError('AUTHENTICATION', message || 'IndiaMART authentication failed', 401)
  }
  if (status === 429) {
    return new IndiaMartError('RATE_LIMIT', message || 'IndiaMART rate limit exceeded. Retry after 5 minutes.', 429)
  }
  if (status >= 500) {
    return new IndiaMartError('REMOTE_SERVER', message || 'IndiaMART server error', 502)
  }
  return new IndiaMartError('PAYLOAD_INVALID', message || `IndiaMART request failed (${status})`, 400)
}
