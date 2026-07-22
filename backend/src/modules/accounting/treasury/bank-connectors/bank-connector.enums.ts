import { z } from 'zod'

export const BANK_CONNECTOR_PROVIDERS = [
  'MANUAL_FILE',
  'GENERIC_REST',
  'MT940_SFTP',
  'CAMT_SFTP',
  'OPEN_BANKING',
] as const

export type BankConnectorProviderCode = (typeof BANK_CONNECTOR_PROVIDERS)[number]

export const BANK_CONNECTOR_STATUSES = ['DISABLED', 'ENABLED', 'ERROR'] as const

export type BankConnectorStatusCode = (typeof BANK_CONNECTOR_STATUSES)[number]

export const BANK_CONNECTOR_PROBE_STATUSES = [
  'NOT_CONFIGURED',
  'NOT_IMPLEMENTED',
  'PROVIDER_DISABLED',
  'OK',
  'ERROR',
] as const

export type BankConnectorProbeStatusCode = (typeof BANK_CONNECTOR_PROBE_STATUSES)[number]

export const BANK_CONNECTOR_EXPECTED_FORMATS = ['MT940', 'CAMT053', 'CSV', 'OTHER'] as const

export type BankConnectorExpectedFormat = (typeof BANK_CONNECTOR_EXPECTED_FORMATS)[number]

const envKey = z
  .string()
  .trim()
  .max(128)
  .regex(/^[A-Z][A-Z0-9_]{2,127}$/, 'must be an uppercase env var name')

/** Provider catalog for admin UI. */
export const BANK_CONNECTOR_PROVIDER_CATALOG = [
  {
    provider: 'MANUAL_FILE' as const,
    label: 'Manual file upload (legacy)',
    description: 'Statements arrive via existing file import — not a live connector.',
    implemented: false,
    connectionMode: 'NONE' as const,
    consentSupported: false,
  },
  {
    provider: 'GENERIC_REST' as const,
    label: 'Generic REST bank API',
    description: 'HTTP pull from allow-listed hosts. Secrets via credentialEnvKey → env.',
    implemented: true,
    connectionMode: 'REST' as const,
    consentSupported: false,
  },
  {
    provider: 'MT940_SFTP' as const,
    label: 'MT940 over SFTP',
    description: 'Live SFTP pull of MT940 files (or sandbox filesystem).',
    implemented: true,
    connectionMode: 'SFTP' as const,
    consentSupported: false,
  },
  {
    provider: 'CAMT_SFTP' as const,
    label: 'CAMT.053 over SFTP',
    description: 'Live SFTP pull of CAMT.053 files (or sandbox filesystem).',
    implemented: true,
    connectionMode: 'SFTP' as const,
    consentSupported: false,
  },
  {
    provider: 'OPEN_BANKING' as const,
    label: 'Open Banking / PSD2',
    description: 'Consent lifecycle scaffold — AIS statement pull not implemented yet.',
    implemented: false,
    connectionMode: 'OAUTH' as const,
    consentSupported: true,
  },
] as const

export { envKey as bankConnectorEnvKeySchema }
