import type { ZodError } from 'zod'
import type { FieldErrorMap, InvalidSubmitErrors } from './types'

/** Normalize Record / string[] / ZodError into a field → message map. */
export function normalizeFieldErrors(errors: InvalidSubmitErrors): FieldErrorMap {
  if (!errors) return {}

  if (Array.isArray(errors)) {
    const map: FieldErrorMap = {}
    errors.forEach((msg, i) => {
      if (msg?.trim()) map[`_msg_${i}`] = msg.trim()
    })
    return map
  }

  // ZodError (duck-typed to avoid hard import coupling in callers)
  if (typeof errors === 'object' && 'issues' in errors && Array.isArray((errors as ZodError).issues)) {
    const map: FieldErrorMap = {}
    for (const issue of (errors as ZodError).issues) {
      const key = issue.path.length ? issue.path.map(String).join('.') : `_zod_${Object.keys(map).length}`
      if (!map[key]) map[key] = issue.message
    }
    return map
  }

  const map: FieldErrorMap = {}
  for (const [key, value] of Object.entries(errors as FieldErrorMap)) {
    if (value?.trim()) map[key] = value.trim()
  }
  return map
}

/** Flatten field errors to ordered message list (for ValidationSummary / toast). */
export function fieldErrorsToMessages(
  errors: FieldErrorMap,
  fieldOrder?: string[],
): string[] {
  const keys = Object.keys(errors)
  if (!keys.length) return []
  if (!fieldOrder?.length) return keys.map((k) => errors[k]).filter(Boolean)

  const ordered: string[] = []
  const seen = new Set<string>()
  for (const key of fieldOrder) {
    if (errors[key] && !seen.has(key)) {
      ordered.push(errors[key])
      seen.add(key)
    }
  }
  for (const key of keys) {
    if (!seen.has(key) && errors[key]) ordered.push(errors[key])
  }
  return ordered
}

/** Pick the first invalid field key using optional preferred order. */
export function firstInvalidFieldKey(
  errors: FieldErrorMap,
  fieldOrder?: string[],
): string | undefined {
  const keys = Object.keys(errors)
  if (!keys.length) return undefined
  if (fieldOrder?.length) {
    for (const key of fieldOrder) {
      if (errors[key]) return key
    }
  }
  // Prefer real field keys over synthetic `_msg_*` / `_zod_*`
  const real = keys.find((k) => !k.startsWith('_'))
  return real ?? keys[0]
}

/**
 * Convert React Hook Form `FieldErrors` into a flat string map.
 * Nested paths are joined with `.` (e.g. `lines.0.qty`).
 */
export function rhfErrorsToFieldMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rhfErrors: Record<string, any>,
  prefix = '',
): FieldErrorMap {
  const out: FieldErrorMap = {}
  for (const [key, value] of Object.entries(rhfErrors ?? {})) {
    if (!value) continue
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value.message === 'string' && value.message) {
      out[path] = value.message
      continue
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, rhfErrorsToFieldMap(value, path))
    }
  }
  return out
}
