import type { ZodError, ZodIssue } from 'zod'
import type { FieldErrorMap } from './types'
import { normalizeFieldErrors } from './normalizeErrors'

/**
 * Convert a ZodError into a flat field → message map for `handleInvalidSubmit`.
 * Nested paths join with `.` (e.g. `lines.0.qty`).
 */
export function zodErrorToFieldMap(error: ZodError): FieldErrorMap {
  return normalizeFieldErrors(error)
}

/** True when value looks like a ZodError. */
export function isZodError(value: unknown): value is ZodError {
  return (
    typeof value === 'object' &&
    value != null &&
    'issues' in value &&
    Array.isArray((value as ZodError).issues)
  )
}

/**
 * Parse with a Zod schema; on failure return field map (never throws).
 * On success return null.
 */
export function safeParseToFieldErrors<T>(
  schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: ZodError } },
  data: unknown,
): { data: T; errors: null } | { data: null; errors: FieldErrorMap } {
  const result = schema.safeParse(data)
  if (result.success) return { data: result.data, errors: null }
  return { data: null, errors: zodErrorToFieldMap(result.error) }
}

/** First issue message, or a fallback. */
export function firstZodMessage(error: ZodError, fallback = 'Please fix the highlighted fields'): string {
  const issue = error.issues[0] as ZodIssue | undefined
  return issue?.message?.trim() || fallback
}
