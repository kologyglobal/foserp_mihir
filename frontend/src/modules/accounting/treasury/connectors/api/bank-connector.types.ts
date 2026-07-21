export type BankConnectorProvider =
  | 'MANUAL_FILE'
  | 'GENERIC_REST'
  | 'MT940_SFTP'
  | 'CAMT_SFTP'
  | 'OPEN_BANKING'

export type BankConnectorStatus = 'DISABLED' | 'ENABLED' | 'ERROR'

export type BankConnectorExpectedFormat = 'MT940' | 'CAMT053' | 'CSV' | 'OTHER'

export interface BankConnectorConfigJson {
  mode?: 'SANDBOX' | 'LIVE'
  expectedFormat?: BankConnectorExpectedFormat
  remotePath?: string
  fileNamePattern?: string
  sandboxRoot?: string
  credentialEnvKey?: string
  listUrl?: string
  host?: string
  port?: number
  hostKeyFingerprint?: string
  usernameEnvKey?: string
  passwordEnvKey?: string
  privateKeyEnvKey?: string
  passphraseEnvKey?: string
  authorizeUrl?: string
  notes?: string
}

export type BankConnectorConsentStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'REVOKED'
  | 'EXPIRED'

export interface BankConnectorConsentDto {
  id: string
  connectorId: string
  status: BankConnectorConsentStatus
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
  lastTestStatus: string | null
  lastTestMessage: string | null
  lastSyncAt: string | null
  lastSyncStatus: string | null
  lastSyncMessage: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  isLiveConnected: boolean
  connectionLabel: 'Not connected' | 'Connected' | 'Coming soon' | 'Disabled' | 'Error'
  consent: BankConnectorConsentDto | null
}

export interface BankConnectorProviderCatalogItem {
  provider: BankConnectorProvider
  label: string
  description: string
  implemented: boolean
  connectionMode: 'NONE' | 'REST' | 'SFTP' | 'OAUTH'
  consentSupported?: boolean
  statusHint: 'NOT_IMPLEMENTED' | 'AVAILABLE'
}

export interface CreateBankConnectorInput {
  legalEntityId: string
  treasuryAccountId: string
  code: string
  name: string
  provider: BankConnectorProvider
  baseUrl?: string | null
  scheduleCron?: string | null
  configJson?: BankConnectorConfigJson | null
}

export interface UpdateBankConnectorInput {
  name?: string
  treasuryAccountId?: string
  baseUrl?: string | null
  scheduleCron?: string | null
  configJson?: BankConnectorConfigJson | null
  expectedUpdatedAt: string
}

export interface ListBankConnectorsQuery {
  legalEntityId?: string
  treasuryAccountId?: string
  provider?: BankConnectorProvider
  status?: BankConnectorStatus
  search?: string
  page?: number
  limit?: number
}

export interface BankConnectorProbeResult {
  ok: boolean
  code: string
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

export const PROVIDER_LABELS: Record<BankConnectorProvider, string> = {
  MANUAL_FILE: 'Manual file (legacy)',
  GENERIC_REST: 'Generic REST',
  MT940_SFTP: 'MT940 over SFTP',
  CAMT_SFTP: 'CAMT.053 over SFTP',
  OPEN_BANKING: 'Open Banking / PSD2',
}
