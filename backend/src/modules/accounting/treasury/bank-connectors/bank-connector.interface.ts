/**
 * Bank connector adapter contract (Phase 5D1 scaffold + 5D2 live/sandbox pull).
 */

export type BankConnectorStatementFormatHint = 'MT940' | 'CAMT053' | 'CSV' | 'OTHER' | 'UNKNOWN'

export interface BankConnectorRemoteFile {
  name: string
  path: string
  sizeBytes?: number
  modifiedAt?: string
}

export interface BankConnectorFetchedFile {
  buffer: Buffer
  fileName: string
  formatHint: BankConnectorStatementFormatHint
}

export interface BankConnectorAdapterContext {
  connectorId: string
  tenantId: string
  legalEntityId: string
  treasuryAccountId: string
  provider: string
  baseUrl: string | null
  /** Non-secret config only (may include credentialEnvKey = env var *name*). */
  configJson: Record<string, unknown> | null
}

export type BankConnectorAdapterProbeCode =
  | 'OK'
  | 'NOT_IMPLEMENTED'
  | 'PROVIDER_DISABLED'
  | 'NOT_CONFIGURED'
  | 'ERROR'

export interface BankConnectorAdapter {
  readonly providerCode: string

  testConnection(ctx: BankConnectorAdapterContext): Promise<{
    ok: boolean
    code: BankConnectorAdapterProbeCode
    message: string
  }>

  listRemoteFiles?(ctx: BankConnectorAdapterContext): Promise<BankConnectorRemoteFile[]>

  fetchStatementFile?(
    ctx: BankConnectorAdapterContext,
    remotePath: string,
  ): Promise<BankConnectorFetchedFile>
}
