import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import { TreasuryAccountNotFoundError } from '../treasury.errors.js'
import { disabledAdapter } from './adapters/disabled.adapter.js'
import { genericRestLiveAdapter } from './adapters/generic-rest.adapter.js'
import { stubAdaptersByProvider } from './adapters/not-implemented.adapter.js'
import { createSandboxFsAdapter } from './adapters/sandbox-fs.adapter.js'
import { createSftpLiveAdapter } from './adapters/sftp-live.adapter.js'
import { ingestConnectorFetchedFile } from './bank-connector-ingest.service.js'
import * as consentRepo from './bank-connector-consent.repository.js'
import { BANK_CONNECTOR_PROVIDER_CATALOG } from './bank-connector.enums.js'
import {
  BankConnectorCodeConflictError,
  BankConnectorNotConfiguredError,
  BankConnectorNotImplementedError,
  BankConnectorProbeFailedError,
  BankConnectorProviderDisabledError,
  BankConnectorValidationError,
} from './bank-connector.errors.js'
import type { BankConnectorAdapter, BankConnectorAdapterContext } from './bank-connector.interface.js'
import * as repo from './bank-connector.repository.js'
import { assertSafeCredentialEnvKey, isSandboxConnectorsEnabled } from './bank-connector.secrets.js'
import type {
  BankConnectorLifecycleInput,
  CreateBankConnectorInput,
  ListBankConnectorsQuery,
  UpdateBankConnectorInput,
} from './bank-connector.schemas.js'
import type { BankConnectorConfigJson, BankConnectorProbeResult } from './bank-connector.types.js'
import { toBankConnectorConsentDto, toBankConnectorDto } from './bank-connector.types.js'

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

async function assertTreasuryAccountBank(tenantId: string, legalEntityId: string, id: string): Promise<void> {
  const acct = await prisma.treasuryAccount.findFirst({ where: { id, tenantId, legalEntityId } })
  if (!acct) throw new TreasuryAccountNotFoundError(`Treasury account ${id} not found in this legal entity`)
  if (acct.accountType !== 'BANK') {
    throw new BankConnectorValidationError('Bank connectors require a BANK treasury account', [
      { field: 'treasuryAccountId', message: 'Must reference a BANK treasury account' },
    ])
  }
}

function readConfig(row: { configJson: unknown }): BankConnectorConfigJson | null {
  if (row.configJson && typeof row.configJson === 'object' && !Array.isArray(row.configJson)) {
    return row.configJson as BankConnectorConfigJson
  }
  return null
}

function wantsSandbox(config: BankConnectorConfigJson | null): boolean {
  if (!config) return false
  if (config.mode === 'SANDBOX') return true
  if (config.mode === 'LIVE') return false
  return Boolean(config.sandboxRoot?.trim())
}

function resolveAdapter(status: string, provider: string, config: BankConnectorConfigJson | null): BankConnectorAdapter {
  if (status === 'DISABLED') return disabledAdapter

  if (provider === 'OPEN_BANKING' || provider === 'MANUAL_FILE') {
    return stubAdaptersByProvider[provider as keyof typeof stubAdaptersByProvider] ?? disabledAdapter
  }

  if (wantsSandbox(config)) {
    if (!isSandboxConnectorsEnabled()) {
      return stubAdaptersByProvider[provider as keyof typeof stubAdaptersByProvider] ?? disabledAdapter
    }
    if (provider === 'MT940_SFTP' || provider === 'CAMT_SFTP' || provider === 'GENERIC_REST') {
      return createSandboxFsAdapter(provider)
    }
  }

  if (provider === 'GENERIC_REST') {
    return genericRestLiveAdapter
  }

  // Live SFTP only when explicitly mode=LIVE (avoids accidental outbound SSH).
  if ((provider === 'MT940_SFTP' || provider === 'CAMT_SFTP') && config?.mode === 'LIVE') {
    return createSftpLiveAdapter(provider)
  }

  return stubAdaptersByProvider[provider as keyof typeof stubAdaptersByProvider] ?? disabledAdapter
}

function toAdapterContext(row: {
  id: string
  tenantId: string
  legalEntityId: string
  treasuryAccountId: string
  provider: string
  baseUrl: string | null
  configJson: unknown
}): BankConnectorAdapterContext {
  return {
    connectorId: row.id,
    tenantId: row.tenantId,
    legalEntityId: row.legalEntityId,
    treasuryAccountId: row.treasuryAccountId,
    provider: row.provider,
    baseUrl: row.baseUrl,
    configJson: readConfig(row) as Record<string, unknown> | null,
  }
}

function mapProbeStatus(
  code: string,
): 'OK' | 'NOT_IMPLEMENTED' | 'PROVIDER_DISABLED' | 'NOT_CONFIGURED' | 'ERROR' {
  if (code === 'OK') return 'OK'
  if (code === 'PROVIDER_DISABLED') return 'PROVIDER_DISABLED'
  if (code === 'NOT_CONFIGURED') return 'NOT_CONFIGURED'
  if (code === 'NOT_IMPLEMENTED') return 'NOT_IMPLEMENTED'
  return 'ERROR'
}

export function listProviders() {
  return BANK_CONNECTOR_PROVIDER_CATALOG.map((p) => ({
    ...p,
    statusHint: p.implemented ? ('AVAILABLE' as const) : ('NOT_IMPLEMENTED' as const),
  }))
}

export async function listBankConnectors(tenantId: string, query: ListBankConnectorsQuery) {
  if (query.legalEntityId) await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const result = await repo.listConnectors(tenantId, query)
  const consents = await consentRepo.findLatestConsentsForConnectors(
    tenantId,
    result.items.map((i) => i.id),
  )
  return {
    ...result,
    items: result.items.map((row) => {
      const c = consents.get(row.id)
      return toBankConnectorDto(row, c ? toBankConnectorConsentDto(c) : null)
    }),
  }
}

export async function getBankConnector(tenantId: string, id: string) {
  const row = await repo.getConnector(tenantId, id)
  const consent = await consentRepo.findLatestConsent(tenantId, id)
  return toBankConnectorDto(row, consent ? toBankConnectorConsentDto(consent) : null)
}

export async function createBankConnector(req: Request, tenantId: string, input: CreateBankConnectorInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? null
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  await assertTreasuryAccountBank(tenantId, input.legalEntityId, input.treasuryAccountId)

  const code = input.code.toUpperCase()
  const existing = await repo.findByCode(tenantId, code)
  if (existing) throw new BankConnectorCodeConflictError()

  const safeConfig = sanitizeConfigJson(input.configJson ?? null)

  const record = await repo.createConnector({
    tenantId,
    legalEntityId: input.legalEntityId,
    treasuryAccountId: input.treasuryAccountId,
    code,
    name: input.name,
    provider: input.provider,
    status: 'DISABLED',
    baseUrl: input.baseUrl ?? null,
    scheduleCron: input.scheduleCron ?? null,
    configJson: safeConfig,
    createdBy: userId,
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'bank_connector',
    entityId: record.id,
    action: 'CREATE',
    newValues: toBankConnectorDto(record),
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return toBankConnectorDto(record)
}

export async function updateBankConnector(req: Request, tenantId: string, id: string, input: UpdateBankConnectorInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? null
  const before = await repo.getConnector(tenantId, id)

  if (input.treasuryAccountId) {
    await assertTreasuryAccountBank(tenantId, before.legalEntityId, input.treasuryAccountId)
  }

  const record = await repo.updateConnector(tenantId, id, {
    name: input.name,
    treasuryAccountId: input.treasuryAccountId,
    baseUrl: input.baseUrl,
    scheduleCron: input.scheduleCron,
    configJson: input.configJson !== undefined ? sanitizeConfigJson(input.configJson ?? null) : undefined,
    updatedBy: userId,
    expectedUpdatedAt: new Date(input.expectedUpdatedAt),
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'bank_connector',
    entityId: record.id,
    action: 'UPDATE',
    oldValues: toBankConnectorDto(before),
    newValues: toBankConnectorDto(record),
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return toBankConnectorDto(record)
}

export async function enableBankConnector(req: Request, tenantId: string, id: string, input: BankConnectorLifecycleInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? null
  const before = await repo.getConnector(tenantId, id)
  const record = await repo.updateConnector(tenantId, id, {
    status: 'ENABLED',
    updatedBy: userId,
    expectedUpdatedAt: new Date(input.expectedUpdatedAt),
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'bank_connector',
    entityId: record.id,
    action: 'ENABLE',
    oldValues: { status: before.status },
    newValues: { status: record.status },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return toBankConnectorDto(record)
}

export async function disableBankConnector(req: Request, tenantId: string, id: string, input: BankConnectorLifecycleInput) {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? null
  const before = await repo.getConnector(tenantId, id)
  const record = await repo.updateConnector(tenantId, id, {
    status: 'DISABLED',
    updatedBy: userId,
    expectedUpdatedAt: new Date(input.expectedUpdatedAt),
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'bank_connector',
    entityId: record.id,
    action: 'DISABLE',
    oldValues: { status: before.status },
    newValues: { status: record.status },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return toBankConnectorDto(record)
}

export async function testBankConnectorConnection(
  req: Request,
  tenantId: string,
  id: string,
): Promise<BankConnectorProbeResult> {
  const userId = req.context?.userId ?? null
  const row = await repo.getConnector(tenantId, id)
  const config = readConfig(row)
  const adapter = resolveAdapter(row.status, row.provider, config)
  const result = await adapter.testConnection(toAdapterContext(row))
  const probeStatus = mapProbeStatus(result.code)

  await repo.updateConnector(tenantId, id, {
    lastTestAt: new Date(),
    lastTestStatus: probeStatus,
    lastTestMessage: result.message.slice(0, 500),
    status: result.ok ? row.status : row.status === 'DISABLED' ? 'DISABLED' : row.status,
    updatedBy: userId,
    expectedUpdatedAt: row.updatedAt,
  })

  if (result.ok) {
    return {
      ok: true,
      code: 'OK',
      message: result.message,
      connectorId: id,
      statementsCreated: 0,
    }
  }

  if (result.code === 'PROVIDER_DISABLED') {
    throw new BankConnectorProviderDisabledError(result.message)
  }
  if (result.code === 'NOT_CONFIGURED') {
    throw new BankConnectorNotConfiguredError(result.message)
  }
  if (result.code === 'NOT_IMPLEMENTED') {
    throw new BankConnectorNotImplementedError(result.message)
  }
  throw new BankConnectorProbeFailedError(result.message)
}

export async function syncBankConnector(
  req: Request,
  tenantId: string,
  id: string,
): Promise<BankConnectorProbeResult> {
  const audit = auditMeta(req)
  const userId = req.context?.userId ?? null
  const row = await repo.getConnector(tenantId, id)
  const config = readConfig(row)

  if (row.status === 'DISABLED') {
    await repo.updateConnector(tenantId, id, {
      lastSyncAt: new Date(),
      lastSyncStatus: 'PROVIDER_DISABLED',
      lastSyncMessage: 'Connector is disabled — sync skipped',
      updatedBy: userId,
      expectedUpdatedAt: row.updatedAt,
    })
    throw new BankConnectorProviderDisabledError('Bank connector is disabled — sync is not available')
  }

  const adapter = resolveAdapter(row.status, row.provider, config)
  if (!adapter.listRemoteFiles || !adapter.fetchStatementFile) {
    await repo.updateConnector(tenantId, id, {
      lastSyncAt: new Date(),
      lastSyncStatus: 'NOT_IMPLEMENTED',
      lastSyncMessage: 'Provider does not support statement sync',
      updatedBy: userId,
      expectedUpdatedAt: row.updatedAt,
    })
    throw new BankConnectorNotImplementedError('Provider does not support statement sync yet')
  }

  const ctx = toAdapterContext(row)
  let files
  try {
    files = await adapter.listRemoteFiles(ctx)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to list remote files'
    await repo.updateConnector(tenantId, id, {
      lastSyncAt: new Date(),
      lastSyncStatus: 'ERROR',
      lastSyncMessage: message.slice(0, 500),
      updatedBy: userId,
      expectedUpdatedAt: row.updatedAt,
    })
    throw new BankConnectorProbeFailedError(message)
  }

  if (files.length === 0) {
    await repo.updateConnector(tenantId, id, {
      lastSyncAt: new Date(),
      lastSyncStatus: 'OK',
      lastSyncMessage: 'No remote statement files found',
      updatedBy: userId,
      expectedUpdatedAt: row.updatedAt,
    })
    return {
      ok: true,
      code: 'OK',
      message: 'No remote statement files found',
      connectorId: id,
      statementsCreated: 0,
      statementsSkipped: 0,
      filesProcessed: [],
    }
  }

  const filesProcessed: NonNullable<BankConnectorProbeResult['filesProcessed']> = []
  let statementsCreated = 0
  let statementsSkipped = 0

  for (const remote of files) {
    const fetched = await adapter.fetchStatementFile(ctx, remote.path)
    const ingested = await ingestConnectorFetchedFile({
      req,
      tenantId,
      legalEntityId: row.legalEntityId,
      treasuryAccountId: row.treasuryAccountId,
      connectorId: id,
      file: fetched,
    })
    if (ingested.skippedDuplicate) {
      statementsSkipped += 1
      filesProcessed.push({
        fileName: fetched.fileName,
        statementId: ingested.statementId || undefined,
        skippedDuplicate: true,
        lineCount: ingested.lineCount,
      })
    } else {
      statementsCreated += 1
      filesProcessed.push({
        fileName: fetched.fileName,
        statementId: ingested.statementId,
        skippedDuplicate: false,
        lineCount: ingested.lineCount,
      })
    }
  }

  const message = `Sync complete — created ${statementsCreated}, skipped ${statementsSkipped}`
  const refreshed = await repo.getConnector(tenantId, id)
  await repo.updateConnector(tenantId, id, {
    lastSyncAt: new Date(),
    lastSyncStatus: 'OK',
    lastSyncMessage: message.slice(0, 500),
    lastTestAt: refreshed.lastTestAt ?? new Date(),
    lastTestStatus: refreshed.lastTestStatus === 'OK' ? 'OK' : refreshed.lastTestStatus,
    updatedBy: userId,
    expectedUpdatedAt: refreshed.updatedAt,
  })

  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'bank_connector',
    entityId: id,
    action: 'SYNC',
    newValues: { statementsCreated, statementsSkipped, filesProcessed },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return {
    ok: true,
    code: 'OK',
    message,
    connectorId: id,
    statementsCreated,
    statementsSkipped,
    filesProcessed,
  }
}

export function buildProbeFailure(
  connectorId: string,
  code: BankConnectorProbeResult['code'],
  message: string,
): BankConnectorProbeResult {
  return { ok: false, code, message, connectorId, statementsCreated: 0 }
}

const SECRET_KEYS = new Set([
  'password',
  'secret',
  'clientSecret',
  'client_secret',
  'apiKey',
  'api_key',
  'token',
  'accessToken',
  'refreshToken',
  'privateKey',
  'certificate',
])

function sanitizeConfigJson(
  config: CreateBankConnectorInput['configJson'] | null | undefined,
): BankConnectorConfigJson | null {
  if (!config || typeof config !== 'object') return null
  const out: BankConnectorConfigJson = {}
  for (const [k, v] of Object.entries(config)) {
    if (SECRET_KEYS.has(k)) continue
    if (k === 'credentialEnvKey' && typeof v === 'string' && v.trim()) {
      out.credentialEnvKey = assertSafeCredentialEnvKey(v)
      continue
    }
    ;(out as Record<string, unknown>)[k] = v
  }
  return out
}
