import type { Request } from 'express'
import { randomUUID } from 'node:crypto'
import { prisma } from '../../../../config/prisma.js'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import { TreasuryAccountNotFoundError } from '../treasury.errors.js'
import { disabledAdapter } from './adapters/disabled.adapter.js'
import { genericRestLiveAdapter } from './adapters/generic-rest.adapter.js'
import { stubAdaptersByProvider } from './adapters/not-implemented.adapter.js'
import { resolveOpenBankingAisAdapter } from './adapters/open-banking-ais.adapter.js'
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
  BankConnectorSyncInProgressError,
  BankConnectorValidationError,
} from './bank-connector.errors.js'
import type { BankConnectorAdapter, BankConnectorAdapterContext } from './bank-connector.interface.js'
import * as repo from './bank-connector.repository.js'
import { assertSafeCredentialEnvKey, isSandboxConnectorsEnabled } from './bank-connector.secrets.js'
import { isConnectorDueForCron, isValidScheduleCron } from './bank-connector-cron.js'
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
  if (config.mode === 'SANDBOX' || config.mode === 'SIMULATED') return true
  if (config.mode === 'LIVE') return false
  return Boolean(config.sandboxRoot?.trim())
}

function resolveAdapter(status: string, provider: string, config: BankConnectorConfigJson | null): BankConnectorAdapter {
  if (status === 'DISABLED') return disabledAdapter

  if (provider === 'MANUAL_FILE') {
    return stubAdaptersByProvider.MANUAL_FILE
  }

  if (provider === 'OPEN_BANKING') {
    return resolveOpenBankingAisAdapter(config)
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

async function assertOpenBankingConsentAuthorized(tenantId: string, connectorId: string): Promise<void> {
  const consent = await consentRepo.findLatestConsent(tenantId, connectorId)
  if (!consent || consent.status !== 'AUTHORIZED') {
    throw new BankConnectorValidationError(
      'OPEN_BANKING sync requires an AUTHORIZED consent (complete consent start → callback first)',
      [{ field: 'consent', message: `Current status is ${consent?.status ?? 'none'}` }],
    )
  }
}

function assertScheduleCron(value: string | null | undefined): void {
  if (value == null || value.trim() === '') return
  if (!isValidScheduleCron(value)) {
    throw new BankConnectorValidationError('scheduleCron must be a 5-field cron expression', [
      { field: 'scheduleCron', message: 'Example: every 15 minutes (5-field cron)' },
    ])
  }
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
  assertScheduleCron(input.scheduleCron)

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
  if (input.scheduleCron !== undefined) assertScheduleCron(input.scheduleCron)

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
  // Consent only when we would actually probe AIS (not when DISABLED stub wins first).
  if (row.provider === 'OPEN_BANKING' && row.status !== 'DISABLED') {
    await assertOpenBankingConsentAuthorized(tenantId, id)
  }

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

export type SyncBankConnectorAudit = {
  userId: string | null
  ipAddress?: string | null | undefined
  userAgent?: string | null | undefined
}

/**
 * Core sync used by HTTP and the scheduled cron worker.
 * OPEN_BANKING requires AUTHORIZED consent; SIMULATED AIS pulls from sandbox drop folder.
 * Acquires a distributed MySQL lease so multi-instance cron/manual sync cannot overlap.
 */
export async function syncBankConnectorCore(params: {
  tenantId: string
  connectorId: string
  userId: string | null
  audit?: SyncBankConnectorAudit
  trigger?: 'MANUAL' | 'SCHEDULED'
}): Promise<BankConnectorProbeResult> {
  const { tenantId, connectorId: id, userId } = params
  const audit = params.audit ?? { userId }
  const trigger = params.trigger ?? 'MANUAL'
  const lockToken = randomUUID()

  const acquired = await repo.tryAcquireSyncLock(id, lockToken)
  if (!acquired) {
    const current = await repo.getConnector(tenantId, id)
    throw new BankConnectorSyncInProgressError(
      'Bank connector sync is already in progress on another instance',
      current.syncLockUntil?.toISOString() ?? null,
    )
  }

  try {
    let row = await repo.getConnector(tenantId, id)

    if (trigger === 'SCHEDULED') {
      if (
        !row.scheduleCron ||
        !isConnectorDueForCron({
          scheduleCron: row.scheduleCron,
          lastSyncAt: row.lastSyncAt,
        })
      ) {
        return {
          ok: true,
          code: 'OK',
          message: 'Connector no longer due after lock acquisition — skipped',
          connectorId: id,
          statementsCreated: 0,
          statementsSkipped: 0,
          filesProcessed: [],
        }
      }
    }

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

    if (row.provider === 'OPEN_BANKING') {
      await assertOpenBankingConsentAuthorized(tenantId, id)
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
      row = await repo.getConnector(tenantId, id)
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
      row = await repo.getConnector(tenantId, id)
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
      const stillOwned = await repo.heartbeatSyncLock(id, lockToken)
      if (!stillOwned) {
        throw new BankConnectorSyncInProgressError(
          'Bank connector sync lease was lost during file processing',
          null,
        )
      }
      const fetched = await adapter.fetchStatementFile(ctx, remote.path)
      const ingested = await ingestConnectorFetchedFile({
        tenantId,
        legalEntityId: row.legalEntityId,
        treasuryAccountId: row.treasuryAccountId,
        connectorId: id,
        uploadedBy: userId,
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
      action: trigger === 'SCHEDULED' ? 'SYNC_SCHEDULED' : 'SYNC',
      newValues: { statementsCreated, statementsSkipped, filesProcessed, trigger },
      ipAddress: audit.ipAddress ?? null,
      userAgent: audit.userAgent ?? null,
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
  } finally {
    await repo.releaseSyncLock(id, lockToken)
  }
}

export async function syncBankConnector(
  req: Request,
  tenantId: string,
  id: string,
): Promise<BankConnectorProbeResult> {
  const audit = auditMeta(req)
  return syncBankConnectorCore({
    tenantId,
    connectorId: id,
    userId: req.context?.userId ?? null,
    audit: {
      userId: audit.userId ?? null,
      ipAddress: audit.ipAddress ?? null,
      userAgent: audit.userAgent ?? null,
    },
    trigger: 'MANUAL',
  })
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
