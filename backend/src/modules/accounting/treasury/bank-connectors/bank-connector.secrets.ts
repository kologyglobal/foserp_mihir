/**
 * Phase 5D2 — resolve non-secret credential *references* from env.
 * Never logs secret values. configJson may store credentialEnvKey (the env var name only).
 */
import { env } from '../../../../config/env.js'
import { BankConnectorValidationError } from './bank-connector.errors.js'

const ENV_KEY_RE = /^[A-Z][A-Z0-9_]{2,127}$/

export function assertSafeCredentialEnvKey(key: string): string {
  const trimmed = key.trim()
  if (!ENV_KEY_RE.test(trimmed)) {
    throw new BankConnectorValidationError('credentialEnvKey must be an uppercase env var name', [
      { field: 'credentialEnvKey', message: 'Use A-Z, 0-9, underscore; e.g. BANK_CONNECTOR_API_KEY_HDFC' },
    ])
  }
  return trimmed
}

/** Returns the secret string or null if unset. Does not throw when missing. */
export function readCredentialFromEnv(credentialEnvKey: string | null | undefined): string | null {
  if (!credentialEnvKey) return null
  const key = assertSafeCredentialEnvKey(credentialEnvKey)
  const value = process.env[key]
  if (value == null || value.trim() === '') return null
  return value
}

export function isSandboxConnectorsEnabled(): boolean {
  // Read process.env at call time so tests can toggle without reloading env.ts.
  const raw = process.env.BANK_CONNECTOR_SANDBOX_ENABLED
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (env.BANK_CONNECTOR_SANDBOX_ENABLED === true) return true
  if (env.BANK_CONNECTOR_SANDBOX_ENABLED === false) return false
  return !env.isProd
}

export function getAllowedSandboxRoots(): string[] {
  const raw = process.env.BANK_CONNECTOR_SANDBOX_ROOTS ?? env.BANK_CONNECTOR_SANDBOX_ROOTS
  if (raw?.trim()) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

export function getAllowedRestHosts(): string[] {
  const raw = process.env.BANK_CONNECTOR_ALLOWED_HOSTS ?? env.BANK_CONNECTOR_ALLOWED_HOSTS
  if (raw?.trim()) {
    return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  }
  if (!env.isProd) return ['localhost', '127.0.0.1']
  return []
}

export function getAllowedSftpHosts(): string[] {
  const raw = process.env.BANK_CONNECTOR_SFTP_ALLOWED_HOSTS ?? env.BANK_CONNECTOR_SFTP_ALLOWED_HOSTS
  if (raw?.trim()) {
    return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  }
  if (!env.isProd) return ['localhost', '127.0.0.1']
  return []
}
