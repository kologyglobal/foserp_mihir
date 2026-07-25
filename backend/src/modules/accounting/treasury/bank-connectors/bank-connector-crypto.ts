/**
 * Encrypt / decrypt connector consent tokens with FIELD_ENCRYPTION_KEY (AES-256-GCM).
 * Never returns plaintext from DTO paths.
 */
import { randomBytes } from 'node:crypto'
import {
  assertFieldEncryptionConfigured as assertSharedFieldEncryptionConfigured,
  decryptFieldSecret,
  encryptFieldSecret,
  isFieldEncryptionConfigured,
} from '../../../../utils/fieldEncryption.js'
import { BankConnectorValidationError } from './bank-connector.errors.js'

export { isFieldEncryptionConfigured }

export function assertFieldEncryptionConfigured(): void {
  try {
    assertSharedFieldEncryptionConfigured()
  } catch {
    throw new BankConnectorValidationError(
      'FIELD_ENCRYPTION_KEY is required to store Open Banking consent tokens',
      [{ field: 'accessToken', message: 'Configure FIELD_ENCRYPTION_KEY before authorizing consent' }],
    )
  }
}

/** Returns base64(iv || authTag || ciphertext). */
export function encryptConsentToken(plaintext: string): string {
  assertFieldEncryptionConfigured()
  return encryptFieldSecret(plaintext)
}

/** Internal only — never expose via API. */
export function decryptConsentToken(encrypted: string): string | null {
  return decryptFieldSecret(encrypted)
}

export function generateConsentState(): string {
  return randomBytes(24).toString('hex')
}
