/**
 * API errors mapped from FOS envelope codes/status.
 * Never log tokens or raw Authorization headers.
 */

export type ApiErrorKind =
  | 'network'
  | 'offline'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'server'
  | 'session_expired'
  | 'account_disabled'
  | 'unknown'

export class ApiError extends Error {
  readonly status: number
  readonly code: string | null
  readonly kind: ApiErrorKind
  readonly fieldErrors: Array<{ field: string; message: string }>
  readonly isApiError = true as const

  constructor(
    message: string,
    options: {
      status?: number
      code?: string | null
      kind?: ApiErrorKind
      fieldErrors?: Array<{ field: string; message: string }>
    } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status ?? 0
    this.code = options.code ?? null
    this.kind = options.kind ?? mapStatusToKind(options.status ?? 0, options.code)
    this.fieldErrors = options.fieldErrors ?? []
  }
}

export const SESSION_EXPIRED_MESSAGE = 'Session expired. Please sign in again.'

export function mapStatusToKind(status: number, code?: string | null): ApiErrorKind {
  if (code === 'AUTH_ACCOUNT_INACTIVE' || code === 'AUTH_ACCOUNT_BLOCKED') {
    return 'account_disabled'
  }
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 422 || status === 400) return 'validation'
  if (status >= 500) return 'server'
  if (status === 0) return 'network'
  return 'unknown'
}

export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'offline':
        return 'You appear to be offline. Check your connection and try again.'
      case 'timeout':
        return 'The request timed out. Please try again.'
      case 'session_expired':
      case 'unauthorized':
        return error.message || SESSION_EXPIRED_MESSAGE
      case 'account_disabled':
        return 'This account is inactive or blocked. Contact your administrator.'
      case 'forbidden':
        return 'You are not authorised to perform this action.'
      case 'not_found':
        return error.message || 'The requested resource was not found.'
      case 'validation':
        return error.message || 'Please check the form and try again.'
      case 'server':
        return 'Something went wrong on the server. Please try again later.'
      case 'network':
        return 'Cannot reach the server. Check the API URL and that the backend is running.'
      default:
        return error.message || 'Something went wrong.'
    }
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}

/** Map login API messages to concise UX copy. */
export function mapLoginErrorMessage(message: string, status?: number): string {
  const lower = message.toLowerCase()
  if (lower.includes('inactive') || lower.includes('blocked') || lower.includes('suspended')) {
    return 'This account or tenant is inactive. Contact your administrator.'
  }
  if (lower.includes('invalid') || lower.includes('credentials') || status === 401) {
    return 'Invalid email or password for this organisation.'
  }
  if (lower.includes('locked')) {
    return 'Account temporarily locked due to failed sign-in attempts. Try again later.'
  }
  if (lower.includes('rate') || lower.includes('too many')) {
    return 'Too many sign-in attempts. Please wait a few minutes.'
  }
  return message || 'Sign-in failed.'
}
