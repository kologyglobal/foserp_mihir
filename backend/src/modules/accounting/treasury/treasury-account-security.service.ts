import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto'
import { env } from '../../../config/env.js'
import { TreasuryBankAccountSecurityUnavailableError } from './treasury.errors.js'

/**
 * Phase 5A1 — bank account number security.
 *
 * Plaintext account numbers are NEVER persisted or returned by any API response.
 * Only three derived fields ever leave this service:
 *   - `last4` / `masked`   — always safe to store and return.
 *   - `hash`               — HMAC-SHA256, write-only, used solely for duplicate detection.
 *   - `encrypted`          — AES-256-GCM ciphertext, write-only, present only when
 *                            `FIELD_ENCRYPTION_KEY` is configured; otherwise null.
 *
 * If neither `TREASURY_ACCOUNT_HMAC_SECRET` nor `FIELD_ENCRYPTION_KEY` is configured,
 * callers MUST reject persisting an account number (see `assertAccountNumberSecurityAvailable`)
 * — the account may still be created without one.
 */

export interface TreasuryAccountNumberSecurityResult {
  last4: string | null
  masked: string | null
  hash: string | null
  encrypted: string | null
}

function normalizeAccountNumber(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase()
}

function resolveHmacSecret(): string | null {
  return env.TREASURY_ACCOUNT_HMAC_SECRET ?? env.FIELD_ENCRYPTION_KEY ?? null
}

function resolveEncryptionKey(): Buffer | null {
  const raw = env.FIELD_ENCRYPTION_KEY
  if (!raw) return null
  // Accept 32-byte keys encoded as base64 or hex; fall back to a SHA-256 derivation
  // of the raw string so any non-empty secret can be used safely as an AES-256 key.
  try {
    const base64 = Buffer.from(raw, 'base64')
    if (base64.length === 32) return base64
  } catch {
    // fall through
  }
  try {
    const hex = Buffer.from(raw, 'hex')
    if (hex.length === 32) return hex
  } catch {
    // fall through
  }
  return createHmac('sha256', 'treasury-account-security-fallback-salt').update(raw).digest()
}

/** True when hashing (duplicate detection) is available — required before persisting any account number. */
export function isAccountNumberSecurityAvailable(): boolean {
  return resolveHmacSecret() !== null
}

/** Throws TREASURY_BANK_ACCOUNT_SECURITY_UNAVAILABLE when no hashing secret is configured. */
export function assertAccountNumberSecurityAvailable(): void {
  if (!isAccountNumberSecurityAvailable()) {
    throw new TreasuryBankAccountSecurityUnavailableError()
  }
}

export function maskAccountNumber(rawAccountNumber: string): { last4: string; masked: string } {
  const normalized = normalizeAccountNumber(rawAccountNumber)
  const last4 = normalized.slice(-4)
  const maskLength = Math.max(normalized.length - 4, 0)
  const masked = `${'X'.repeat(maskLength)}${last4}`
  return { last4, masked }
}

function hashAccountNumber(rawAccountNumber: string, tenantId: string, legalEntityId: string): string {
  const secret = resolveHmacSecret()
  if (!secret) throw new TreasuryBankAccountSecurityUnavailableError()
  const normalized = normalizeAccountNumber(rawAccountNumber)
  return createHmac('sha256', secret).update(`${tenantId}|${legalEntityId}|${normalized}`).digest('hex')
}

function encryptAccountNumber(rawAccountNumber: string): string | null {
  const key = resolveEncryptionKey()
  if (!key) return null
  const normalized = normalizeAccountNumber(rawAccountNumber)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

/** Internal-only — never called from any controller/response path. Kept for completeness/testing. */
export function decryptAccountNumber(encrypted: string): string | null {
  const key = resolveEncryptionKey()
  if (!key) return null
  const buf = Buffer.from(encrypted, 'base64')
  const iv = buf.subarray(0, 12)
  const authTag = buf.subarray(12, 28)
  const ciphertext = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/**
 * Derives all persisted fields for a bank account number. Throws
 * TREASURY_BANK_ACCOUNT_SECURITY_UNAVAILABLE if no hashing secret is configured —
 * callers should check `isAccountNumberSecurityAvailable()` first if they want to
 * allow account creation without a number instead of failing.
 */
export function deriveAccountNumberSecurityFields(
  rawAccountNumber: string,
  tenantId: string,
  legalEntityId: string,
): TreasuryAccountNumberSecurityResult {
  assertAccountNumberSecurityAvailable()
  const { last4, masked } = maskAccountNumber(rawAccountNumber)
  return {
    last4,
    masked,
    hash: hashAccountNumber(rawAccountNumber, tenantId, legalEntityId),
    encrypted: encryptAccountNumber(rawAccountNumber),
  }
}

/** Field names that must never appear in an API response, log line, or audit trail as plaintext-adjacent data. */
export const TREASURY_SENSITIVE_FIELD_NAMES = [
  'accountNumber',
  'accountNumberEncrypted',
  'accountNumberHash',
  'iban',
] as const

/** Strips sensitive treasury fields from any plain object before it is logged or audited. */
export function redactTreasurySensitiveFields<T extends Record<string, unknown>>(value: T): T {
  const clone: Record<string, unknown> = { ...value }
  for (const field of TREASURY_SENSITIVE_FIELD_NAMES) {
    if (field in clone) clone[field] = '[REDACTED]'
  }
  return clone as T
}
