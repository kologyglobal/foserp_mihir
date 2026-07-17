import { createHash } from 'node:crypto'

const SECRET_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'accessToken',
  'refreshToken',
  'cookie',
])

function stripSecrets(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(stripSecrets)
  if (typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEYS.has(key)) continue
    out[key] = stripSecrets(val)
  }
  return out
}

/** Recursively serialize JSON with sorted object keys for deterministic hashing. */
export function canonicalJsonSerialize(value: unknown): string {
  const sanitized = stripSecrets(value)
  return JSON.stringify(sortKeys(sanitized))
}

function sortKeys(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(sortKeys)
  if (typeof value !== 'object') return value
  const obj = value as Record<string, unknown>
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys(obj[key])
  }
  return sorted
}

export function sha256Hex(value: unknown): string {
  const canonical = typeof value === 'string' ? value : canonicalJsonSerialize(value)
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}

export function hashPayload(value: unknown): string {
  return sha256Hex(value)
}
