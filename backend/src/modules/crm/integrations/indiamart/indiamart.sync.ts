import { randomUUID } from 'node:crypto'
import type { IndiaMartConnection, Prisma } from '@prisma/client'
import { createAuditLog } from '../../../../services/audit.service.js'
import { getIndiaMartProviderAdapter } from './indiamart.adapter.js'
import { buildConnectionConfig } from './indiamart.credentials.js'
import { matchEnquiryAgainstCrm } from './indiamart.deduplication.js'
import { IndiaMartError } from './indiamart.errors.js'
import { importEnquiryAsLead } from './indiamart.lead-import.js'
import {
  buildDedupeFingerprint,
  normalizeCompanyName,
  normalizeEmail,
  normalizeIndiaMartEnquiry,
  normalizeMobile,
} from './indiamart.normalizer.js'
import * as repo from './indiamart.repository.js'
import type { IndiaMartConfigurationJson } from './indiamart.types.js'
import type { SyncIndiaMartInput } from './indiamart.validation.js'

function computeSlaStatus(
  receivedAt: Date | null,
  firstContactedAt: Date | null,
  cfg: IndiaMartConfigurationJson,
): 'WITHIN_SLA' | 'DUE_SOON' | 'OVERDUE' | 'CONTACTED' | null {
  if (firstContactedAt) return 'CONTACTED'
  if (!receivedAt) return null
  const first = (cfg.firstResponseSlaMinutes ?? 30) * 60_000
  const escalate = (cfg.escalationSlaMinutes ?? 120) * 60_000
  const age = Date.now() - receivedAt.getTime()
  if (age >= escalate) return 'OVERDUE'
  if (age >= first * 0.8) return 'DUE_SOON'
  return 'WITHIN_SLA'
}

async function persistRawEnquiry(input: {
  tenantId: string
  connection: IndiaMartConnection
  syncRunId: string
  raw: unknown
  fieldMap?: IndiaMartConfigurationJson['responseFieldMap']
}) {
  const normalized = normalizeIndiaMartEnquiry(input.raw, input.fieldMap)
  const existing = await repo.findEnquiryByExternalId(input.tenantId, normalized.externalEnquiryId)
  if (existing) {
    await repo.updateEnquiry(input.tenantId, existing.id, {
      lastSeenAt: new Date(),
      rawPayload: normalized.rawPayload as Prisma.InputJsonValue,
      syncRunId: input.syncRunId,
    })
    return { enquiry: existing, inserted: false, duplicated: true }
  }

  const normalizedMobile = normalizeMobile(normalized.buyerMobile)
  const normalizedEmail = normalizeEmail(normalized.buyerEmail)
  const normalizedCompany = normalizeCompanyName(normalized.buyerCompanyName)
  const fingerprint = buildDedupeFingerprint({
    normalizedMobile,
    normalizedEmail,
    normalizedCompanyName: normalizedCompany,
    productName: normalized.productName,
    enquiryDate: normalized.enquiryDate,
  })

  const validationErrors: string[] = []
  if (!normalizedMobile && !normalizedEmail) {
    validationErrors.push('Missing buyer mobile and email')
  }

  const cfg = (input.connection.configurationJson ?? {}) as IndiaMartConfigurationJson
  let enquiry = await repo.insertEnquiry({
    tenant: { connect: { id: input.tenantId } },
    connection: { connect: { id: input.connection.id } },
    syncRun: { connect: { id: input.syncRunId } },
    externalEnquiryId: normalized.externalEnquiryId,
    enquiryDate: normalized.enquiryDate,
    receivedAt: normalized.enquiryDate ?? new Date(),
    buyerName: normalized.buyerName,
    buyerCompanyName: normalized.buyerCompanyName,
    buyerMobile: normalized.buyerMobile,
    buyerAlternateMobile: normalized.buyerAlternateMobile,
    buyerEmail: normalized.buyerEmail,
    buyerAddress: normalized.buyerAddress,
    buyerCity: normalized.buyerCity,
    buyerState: normalized.buyerState,
    buyerCountry: normalized.buyerCountry,
    buyerPincode: normalized.buyerPincode,
    subject: normalized.subject,
    requirementText: normalized.requirementText,
    productName: normalized.productName,
    productCategory: normalized.productCategory,
    quantityText: normalized.quantityText,
    quantityValue: normalized.quantityValue,
    quantityUom: normalized.quantityUom,
    estimatedOrderValue: normalized.estimatedOrderValue,
    sourceType: normalized.sourceType,
    sourceUrl: normalized.sourceUrl,
    senderIp: normalized.senderIp,
    normalizedMobile,
    normalizedEmail,
    normalizedCompanyName: normalizedCompany,
    dedupeFingerprint: fingerprint,
    processingStatus: validationErrors.length ? 'VALIDATION_FAILED' : 'NORMALIZED',
    validationErrors: validationErrors.length ? validationErrors : undefined,
    rawPayload: normalized.rawPayload as Prisma.InputJsonValue,
    slaStatus: computeSlaStatus(normalized.enquiryDate ?? new Date(), null, cfg),
  })

  if (!validationErrors.length) {
    const match = await matchEnquiryAgainstCrm(input.tenantId, enquiry)
    enquiry = await repo.updateEnquiry(input.tenantId, enquiry.id, {
      matchStatus: match.matchStatus,
      matchedLeadId: match.matchedLeadId ?? null,
      matchedCompanyId: match.matchedCompanyId ?? null,
      matchedContactId: match.matchedContactId ?? null,
      matchDetails: match,
      processingStatus: 'READY',
    })
  }

  return { enquiry, inserted: true, duplicated: false }
}

export async function runIndiaMartSync(input: {
  tenantId: string
  userId?: string | null
  triggerType: 'MANUAL' | 'SCHEDULED' | 'RETRY' | 'INITIAL_IMPORT'
  options?: SyncIndiaMartInput
}) {
  const connection = await repo.findConnectionByTenant(input.tenantId)
  if (!connection?.encryptedCredentials) {
    throw new IndiaMartError('NOT_CONFIGURED', 'Configure IndiaMART credentials before syncing')
  }

  const lockToken = randomUUID()
  const locked = await repo.tryAcquireSyncLock(connection.id, lockToken)
  if (!locked) {
    throw new IndiaMartError('SYNC_IN_PROGRESS', 'A sync is already running for this tenant', 409)
  }

  const cfg = (connection.configurationJson ?? {}) as IndiaMartConfigurationJson
  const overlapMinutes = cfg.overlapMinutes ?? 5
  const now = new Date()
  let from: Date | undefined
  let to: Date | undefined = now
  let incremental = false

  if (input.options?.startTime && input.options?.endTime) {
    from = new Date(input.options.startTime)
    to = new Date(input.options.endTime)
  } else if (input.triggerType === 'INITIAL_IMPORT' || input.options?.lookbackDays) {
    const days = input.options?.lookbackDays ?? connection.initialLookbackDays ?? 7
    from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  } else if (connection.lastExternalTimestamp) {
    from = new Date(connection.lastExternalTimestamp.getTime() - overlapMinutes * 60_000)
  } else {
    incremental = true
  }

  // IndiaMART max window is 7 days — chunk if needed
  const maxWindowMs = 7 * 24 * 60 * 60 * 1000
  if (from && to && to.getTime() - from.getTime() > maxWindowMs) {
    to = new Date(from.getTime() + maxWindowMs)
  }

  const syncRun = await repo.createSyncRun({
    tenantId: input.tenantId,
    connectionId: connection.id,
    triggerType: input.triggerType,
    triggeredById: input.userId,
    requestedFrom: from ?? null,
    requestedTo: to ?? null,
    cursorBefore: connection.lastCursor,
  })

  await repo.updateConnectionSyncMeta(connection.id, { lastAttemptedSyncAt: now })

  const counters = {
    recordsFetched: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    recordsDuplicated: 0,
    leadsCreated: 0,
    leadsLinked: 0,
    recordsFailed: 0,
  }

  try {
    const adapter = getIndiaMartProviderAdapter()
    const config = buildConnectionConfig(connection)
    const fetchResult = await adapter.fetchEnquiries(config, {
      startTime: from,
      endTime: to,
      incrementalSinceLastHit: incremental,
    })

    const records = fetchResult.records.slice(0, connection.maxRecordsPerRun || 500)
    counters.recordsFetched = records.length

    if (input.options?.previewOnly) {
      await repo.completeSyncRun(syncRun.id, {
        status: 'COMPLETED',
        completedAt: new Date(),
        durationMs: Date.now() - syncRun.startedAt.getTime(),
        recordsFetched: counters.recordsFetched,
        cursorAfter: to?.toISOString() ?? null,
      })
      await repo.releaseSyncLock(connection.id, lockToken)
      return {
        syncRunId: syncRun.id,
        preview: true,
        recordsFound: counters.recordsFetched,
        message: fetchResult.message ?? null,
      }
    }

    const autoCreate =
      input.options?.autoCreateLeads ?? connection.autoCreateLead

    for (const raw of records) {
      try {
        const result = await persistRawEnquiry({
          tenantId: input.tenantId,
          connection,
          syncRunId: syncRun.id,
          raw,
          fieldMap: cfg.responseFieldMap,
        })
        if (result.duplicated) {
          counters.recordsDuplicated += 1
          counters.recordsUpdated += 1
          continue
        }
        counters.recordsInserted += 1

        if (autoCreate && result.enquiry.processingStatus === 'READY' && result.enquiry.importStatus === 'NOT_IMPORTED') {
          if (connection.duplicateBehaviour === 'SEND_TO_REVIEW' && result.enquiry.matchedLeadId) {
            continue
          }
          const imported = await importEnquiryAsLead({
            tenantId: input.tenantId,
            userId: input.userId || connection.createdById || connection.updatedById || 'system',
            connection,
            enquiry: result.enquiry,
            mode: 'AUTO',
          })
          if (imported.linked) counters.leadsLinked += 1
          else counters.leadsCreated += 1
        }
      } catch {
        counters.recordsFailed += 1
      }
    }

    const status =
      counters.recordsFailed > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED'
    const completedAt = new Date()
    await repo.completeSyncRun(syncRun.id, {
      status,
      completedAt,
      durationMs: completedAt.getTime() - syncRun.startedAt.getTime(),
      ...counters,
      cursorAfter: to?.toISOString() ?? null,
    })

    const nextSync = new Date(
      completedAt.getTime() + Math.max(5, connection.syncIntervalMinutes) * 60_000,
    )
    await repo.updateConnectionSyncMeta(connection.id, {
      status: 'CONNECTED',
      lastSuccessfulSyncAt: completedAt,
      lastExternalTimestamp: to ?? completedAt,
      lastCursor: to?.toISOString() ?? null,
      nextScheduledSyncAt: connection.syncEnabled ? nextSync : null,
    })

    await createAuditLog({
      tenantId: input.tenantId,
      userId: input.userId ?? undefined,
      module: 'crm',
      entity: 'indiamart_sync_run',
      entityId: syncRun.id,
      action: 'SYNC',
      newValues: { triggerType: input.triggerType, ...counters, status },
    })

    return { syncRunId: syncRun.id, preview: false, ...counters, status }
  } catch (err) {
    const e = err instanceof IndiaMartError ? err : new IndiaMartError('INTERNAL', (err as Error).message, 500)
    await repo.completeSyncRun(syncRun.id, {
      status: 'FAILED',
      completedAt: new Date(),
      durationMs: Date.now() - syncRun.startedAt.getTime(),
      errorCode: e.code,
      errorMessage: e.message,
      ...counters,
    })
    await repo.updateConnectionSyncMeta(connection.id, {
      status: e.code === 'AUTHENTICATION' ? 'EXPIRED' : 'CONNECTION_FAILED',
      nextScheduledSyncAt:
        e.code === 'AUTHENTICATION'
          ? null
          : new Date(Date.now() + Math.max(5, connection.syncIntervalMinutes) * 60_000),
    })
    throw e
  } finally {
    await repo.releaseSyncLock(connection.id, lockToken)
  }
}
