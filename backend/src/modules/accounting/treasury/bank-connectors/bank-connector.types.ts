import type {
  BankConnector,
  BankConnectorConsent,
  BankConnectorProvider,
  BankConnectorStatus,
} from '@prisma/client'
import type { BankConnectorExpectedFormat, BankConnectorProbeStatusCode } from './bank-connector.enums.js'

/** Non-secret connector config. Credentials are env refs only (credentialEnvKey = env var name). */
export interface BankConnectorConfigJson {
  /** SANDBOX = local filesystem; LIVE = REST/SFTP. */
  mode?: 'SANDBOX' | 'LIVE'
  expectedFormat?: BankConnectorExpectedFormat
  remotePath?: string
  fileNamePattern?: string
  /** Absolute directory for sandbox filesystem adapters. */
  sandboxRoot?: string
  /** Env var *name* holding API bearer token (never the secret itself). */
  credentialEnvKey?: string
  /** Optional JSON list endpoint for GENERIC_REST. */
  listUrl?: string
  /** SFTP host override (else parse baseUrl). */
  host?: string
  port?: number
  /** SHA256 host key fingerprint (base64 or SHA256:…). Required in production for live SFTP. */
  hostKeyFingerprint?: string
  usernameEnvKey?: string
  passwordEnvKey?: string
  privateKeyEnvKey?: string
  passphraseEnvKey?: string
  /** Open Banking authorize base URL (non-secret). */
  authorizeUrl?: string
  notes?: string
}

export type BankConnectorConsentStatusCode =
  | 'DRAFT'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'REVOKED'
  | 'EXPIRED'

/** Safe consent summary — never includes tokenCiphertext. */
export interface BankConnectorConsentDto {
  id: string
  connectorId: string
  status: BankConnectorConsentStatusCode
  authorizationUrl: string | null
  redirectUri: string | null
  expiresAt: string | null
  revokedAt: string | null
  hasEncryptedToken: boolean
  createdAt: string
  updatedAt: string
}

export interface BankConnectorDto {
  id: string
  tenantId: string
  legalEntityId: string
  treasuryAccountId: string
  code: string
  name: string
  provider: BankConnectorProvider
  status: BankConnectorStatus
  baseUrl: string | null
  scheduleCron: string | null
  configJson: BankConnectorConfigJson | null
  lastTestAt: string | null
  lastTestStatus: BankConnectorProbeStatusCode | null
  lastTestMessage: string | null
  lastSyncAt: string | null
  lastSyncStatus: BankConnectorProbeStatusCode | null
  lastSyncMessage: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  /** True when ENABLED and last successful probe was OK. */
  isLiveConnected: boolean
  connectionLabel: 'Not connected' | 'Connected' | 'Coming soon' | 'Disabled' | 'Error'
  /** Latest Open Banking consent (OPEN_BANKING only); never includes tokens. */
  consent: BankConnectorConsentDto | null
}

export interface BankConnectorProbeResult {
  ok: boolean
  code:
    | 'OK'
    | 'BANK_CONNECTOR_NOT_IMPLEMENTED'
    | 'BANK_CONNECTOR_PROVIDER_DISABLED'
    | 'BANK_CONNECTOR_NOT_CONFIGURED'
    | 'BANK_CONNECTOR_PROBE_FAILED'
  message: string
  connectorId: string
  statementsCreated: number
  statementsSkipped?: number
  filesProcessed?: Array<{
    fileName: string
    statementId?: string
    skippedDuplicate?: boolean
    lineCount?: number
  }>
}

export function toBankConnectorConsentDto(row: BankConnectorConsent): BankConnectorConsentDto {
  return {
    id: row.id,
    connectorId: row.connectorId,
    status: row.status as BankConnectorConsentStatusCode,
    authorizationUrl: row.authorizationUrl,
    redirectUri: row.redirectUri,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    hasEncryptedToken: Boolean(row.tokenCiphertext),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toBankConnectorDto(
  row: BankConnector,
  consent: BankConnectorConsentDto | null = null,
): BankConnectorDto {
  const configJson =
    row.configJson && typeof row.configJson === 'object' && !Array.isArray(row.configJson)
      ? (row.configJson as BankConnectorConfigJson)
      : null

  const lastOk = row.lastTestStatus === 'OK'
  const isLiveConnected = row.status === 'ENABLED' && lastOk

  let connectionLabel: BankConnectorDto['connectionLabel'] = 'Coming soon'
  if (row.status === 'DISABLED') connectionLabel = 'Disabled'
  else if (row.status === 'ERROR' || row.lastTestStatus === 'ERROR') connectionLabel = 'Error'
  else if (isLiveConnected) connectionLabel = 'Connected'
  else if (row.provider === 'OPEN_BANKING' || row.provider === 'MANUAL_FILE') connectionLabel = 'Coming soon'
  else connectionLabel = 'Not connected'

  return {
    id: row.id,
    tenantId: row.tenantId,
    legalEntityId: row.legalEntityId,
    treasuryAccountId: row.treasuryAccountId,
    code: row.code,
    name: row.name,
    provider: row.provider,
    status: row.status,
    baseUrl: row.baseUrl,
    scheduleCron: row.scheduleCron,
    configJson,
    lastTestAt: row.lastTestAt?.toISOString() ?? null,
    lastTestStatus: (row.lastTestStatus as BankConnectorProbeStatusCode | null) ?? null,
    lastTestMessage: row.lastTestMessage,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    lastSyncStatus: (row.lastSyncStatus as BankConnectorProbeStatusCode | null) ?? null,
    lastSyncMessage: row.lastSyncMessage,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isLiveConnected,
    connectionLabel,
    consent,
  }
}
