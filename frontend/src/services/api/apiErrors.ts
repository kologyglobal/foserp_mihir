export class ApiError extends Error {
  readonly statusCode: number
  readonly code?: string
  readonly fieldErrors?: Array<{ field: string; message: string }>
  readonly missingFields?: Array<{ field: string; label: string }>

  constructor(
    message: string,
    statusCode: number,
    fieldErrors?: Array<{ field: string; message: string }>,
    code?: string,
    missingFields?: Array<{ field: string; label: string }>,
  ) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.fieldErrors = fieldErrors
    this.code = code
    this.missingFields = missingFields
  }
}

export function formatApiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'STAGE_REQUIREMENTS_INCOMPLETE') {
      const fromMissing = err.missingFields?.map((m) => m.label) ?? []
      const fromFields = err.fieldErrors?.map((e) => e.message || e.field) ?? []
      const labels = (fromMissing.length > 0 ? fromMissing : fromFields).join(', ')
      return labels
        ? `Stage requirements incomplete. Missing: ${labels}`
        : err.message
    }
    if (err.fieldErrors?.length) {
      return err.fieldErrors.map((e) => `${e.field}: ${e.message}`).join('; ')
    }
    return err.message
  }
  return err instanceof Error ? err.message : 'Request failed'
}

/** True for HTTP 403 / PERMISSION_DENIED API failures (and matching message text). */
export function isPermissionDeniedError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.statusCode === 403 || err.code === 'PERMISSION_DENIED'
  }
  if (typeof err === 'string') {
    return /permission_denied|missing permission/i.test(err)
  }
  if (err instanceof Error) {
    return /permission_denied|missing permission/i.test(err.message)
  }
  return false
}

/** Extract `tenant.view` from messages like `Missing permission: tenant.view`. */
export function parseMissingPermissionKey(err: unknown): string | null {
  const message =
    err instanceof ApiError
      ? err.message
      : typeof err === 'string'
        ? err
        : err instanceof Error
          ? err.message
          : ''
  const match = message.match(/Missing permission:\s*([a-z0-9_.]+)/i)
  return match?.[1] ?? null
}

/** Map API stage-gate payload into completeness missing rows. */
export function stageMissingFieldsFromApiError(
  err: unknown,
): Array<{ field: string; label: string }> | undefined {
  if (!(err instanceof ApiError) || err.code !== 'STAGE_REQUIREMENTS_INCOMPLETE') return undefined
  if (err.missingFields?.length) return err.missingFields
  if (!err.fieldErrors?.length) return undefined
  return err.fieldErrors.map((e) => ({
    field: e.field,
    label: e.message?.trim() || e.field,
  }))
}
