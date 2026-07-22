/**
 * Encrypt / decrypt connector consent tokens with FIELD_ENCRYPTION_KEY (AES-256-GCM).
 * Never returns plaintext from DTO paths.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { env } from '../../../../config/env.js'
import { BankConnectorValidationError } from './bank-connector.errors.js'

function resolveEncryptionKey(): Buffer | null {
  const raw = env.FIELD_ENCRYPTION_KEY ?? process.env.FIELD_ENCRYPTION_KEY
  if (!raw?.trim()) return null
  try {
    const base64 = Buffer.from(raw, 'base64')
    if (base64.length === 32) return base64
  } catch {
    /* fall through */
  }
  try {
    const hex = Buffer.from(raw, 'hex')
    if (hex.length === 32) return hex
  } catch {
    /* fall through */
  }
  return createHash('sha256').update(raw).digest()
}

export function isFieldEncryptionConfigured(): boolean {
  return resolveEncryptionKey() !== null
}

export function assertFieldEncryptionConfigured(): void {
  if (!isFieldEncryptionConfigured()) {
    throw new BankConnectorValidationError(
      'FIELD_ENCRYPTION_KEY is required to store Open Banking consent tokens',
      [{ field: 'accessToken', message: 'Configure FIELD_ENCRYPTION_KEY before authorizing consent' }],
    )
  }
}

/** Returns base64(iv || authTag || ciphertext). */
export function encryptConsentToken(plaintext: string): string {
  assertFieldEncryptionConfigured()
  const key = resolveEncryptionKey()!
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

/** Internal only — never expose via API. */
export function decryptConsentToken(encrypted: string): string | null {
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

export function generateConsentState(): string {
  return randomBytes(24).toString('hex')
}
