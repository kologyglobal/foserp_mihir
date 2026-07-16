export class ApiError extends Error {
  readonly statusCode: number
  readonly fieldErrors?: Array<{ field: string; message: string }>

  constructor(
    message: string,
    statusCode: number,
    fieldErrors?: Array<{ field: string; message: string }>,
  ) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.fieldErrors = fieldErrors
  }
}

export function formatApiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.fieldErrors?.length) {
      return err.fieldErrors.map((e) => `${e.field}: ${e.message}`).join('; ')
    }
    return err.message
  }
  return err instanceof Error ? err.message : 'Request failed'
}
