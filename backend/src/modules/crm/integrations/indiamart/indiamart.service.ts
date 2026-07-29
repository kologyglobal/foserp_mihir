import { createAuditLog } from '../../../../services/audit.service.js'
import { assertUserInTenant } from '../../crm.tenant-refs.js'
import { IndiaMartError } from './indiamart.errors.js'
import { importEnquiryAsLead, linkEnquiryToLead } from './indiamart.lead-import.js'
import { matchEnquiryAgainstCrm } from './indiamart.deduplication.js'
import * as repo from './indiamart.repository.js'
import { runIndiaMartSync } from './indiamart.sync.js'
import type { ListEnquiriesQuery, SyncIndiaMartInput } from './indiamart.validation.js'
import { normalizeProductName } from './indiamart.normalizer.js'

function mapEnquiryDto(row: Awaited<ReturnType<typeof repo.findEnquiryById>>, includeRaw: boolean) {
  if (!row) return null
  return {
    id: row.id,
    externalEnquiryId: row.externalEnquiryId,
    enquiryDate: row.enquiryDate?.toISOString() ?? null,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    fetchedAt: row.fetchedAt.toISOString(),
    buyerName: row.buyerName,
    buyerCompanyName: row.buyerCompanyName,
    buyerMobile: row.buyerMobile,
    buyerAlternateMobile: row.buyerAlternateMobile,
    buyerEmail: row.buyerEmail,
    buyerAddress: row.buyerAddress,
    buyerCity: row.buyerCity,
    buyerState: row.buyerState,
    buyerCountry: row.buyerCountry,
    buyerPincode: row.buyerPincode,
    subject: row.subject,
    requirementText: row.requirementText,
    productName: row.productName,
    productCategory: row.productCategory,
    quantityText: row.quantityText,
    quantityValue: row.quantityValue != null ? Number(row.quantityValue) : null,
    quantityUom: row.quantityUom,
    estimatedOrderValue: row.estimatedOrderValue != null ? Number(row.estimatedOrderValue) : null,
    sourceType: row.sourceType,
    processingStatus: row.processingStatus,
    matchStatus: row.matchStatus,
    importStatus: row.importStatus,
    matchedLeadId: row.matchedLeadId,
    matchedCompanyId: row.matchedCompanyId,
    matchedContactId: row.matchedContactId,
    createdLeadId: row.createdLeadId,
    assignedUserId: row.assignedUserId,
    assignedAt: row.assignedAt?.toISOString() ?? null,
    slaStatus: row.slaStatus,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    matchDetails: row.matchDetails,
    validationErrors: row.validationErrors,
    syncRunId: row.syncRunId,
    importedAt: row.importedAt?.toISOString() ?? null,
    ignoredAt: row.ignoredAt?.toISOString() ?? null,
    ignoreReason: row.ignoreReason,
    rawPayload: includeRaw ? row.rawPayload : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listEnquiries(tenantId: string, query: ListEnquiriesQuery) {
  const result = await repo.listEnquiries(tenantId, {
    page: query.page,
    limit: query.limit,
    search: query.search,
    processingStatus: query.processingStatus,
    importStatus: query.importStatus,
    matchStatus: query.matchStatus,
    assignedUserId: query.assignedUserId,
    product: query.product,
    city: query.city,
    dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
    dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    createdLeadOnly: query.createdLeadOnly,
  })
  return {
    items: result.items.map((r) => mapEnquiryDto(r, false)),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function getEnquiry(tenantId: string, id: string, includeRaw: boolean) {
  const row = await repo.findEnquiryById(tenantId, id)
  if (!row) throw new IndiaMartError('VALIDATION_FAILED', 'Enquiry not found', 404)
  return mapEnquiryDto(row, includeRaw)
}

export async function createLeadFromEnquiry(
  tenantId: string,
  userId: string,
  enquiryId: string,
  opts?: { ownerId?: string | null; force?: boolean },
) {
  const connection = await repo.findConnectionByTenant(tenantId)
  if (!connection) throw new IndiaMartError('NOT_CONFIGURED', 'IndiaMART connection not configured')
  const enquiry = await repo.findEnquiryById(tenantId, enquiryId)
  if (!enquiry) throw new IndiaMartError('VALIDATION_FAILED', 'Enquiry not found', 404)
  return importEnquiryAsLead({
    tenantId,
    userId,
    connection,
    enquiry,
    mode: 'MANUAL',
    ownerId: opts?.ownerId,
    force: opts?.force,
  })
}

export async function linkLead(
  tenantId: string,
  userId: string,
  enquiryId: string,
  leadId: string,
  createActivity?: boolean,
) {
  const enquiry = await repo.findEnquiryById(tenantId, enquiryId)
  if (!enquiry) throw new IndiaMartError('VALIDATION_FAILED', 'Enquiry not found', 404)
  return linkEnquiryToLead({ tenantId, userId, enquiry, leadId, createActivity })
}

export async function assignEnquiry(
  tenantId: string,
  userId: string,
  enquiryId: string,
  assignedUserId: string,
) {
  await assertUserInTenant(tenantId, assignedUserId)
  const enquiry = await repo.findEnquiryById(tenantId, enquiryId)
  if (!enquiry) throw new IndiaMartError('VALIDATION_FAILED', 'Enquiry not found', 404)
  const updated = await repo.updateEnquiry(tenantId, enquiryId, {
    assignedUserId,
    assignedAt: new Date(),
  })
  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'indiamart_enquiry',
    entityId: enquiryId,
    action: 'ASSIGN',
    newValues: { assignedUserId },
  })
  return mapEnquiryDto(updated, false)
}

export async function ignoreEnquiry(
  tenantId: string,
  userId: string,
  enquiryId: string,
  reason?: string,
) {
  const enquiry = await repo.findEnquiryById(tenantId, enquiryId)
  if (!enquiry) throw new IndiaMartError('VALIDATION_FAILED', 'Enquiry not found', 404)
  const updated = await repo.updateEnquiry(tenantId, enquiryId, {
    processingStatus: 'IGNORED',
    importStatus: 'IGNORED',
    ignoredAt: new Date(),
    ignoredById: userId,
    ignoreReason: reason ?? null,
    processedAt: new Date(),
  })
  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'indiamart_enquiry',
    entityId: enquiryId,
    action: 'IGNORE',
    newValues: { reason },
  })
  return mapEnquiryDto(updated, false)
}

export async function retryEnquiry(tenantId: string, userId: string, enquiryId: string) {
  const connection = await repo.findConnectionByTenant(tenantId)
  if (!connection) throw new IndiaMartError('NOT_CONFIGURED', 'IndiaMART connection not configured')
  let enquiry = await repo.findEnquiryById(tenantId, enquiryId)
  if (!enquiry) throw new IndiaMartError('VALIDATION_FAILED', 'Enquiry not found', 404)

  const match = await matchEnquiryAgainstCrm(tenantId, enquiry)
  enquiry = await repo.updateEnquiry(tenantId, enquiryId, {
    matchStatus: match.matchStatus,
    matchedLeadId: match.matchedLeadId ?? null,
    matchedCompanyId: match.matchedCompanyId ?? null,
    matchedContactId: match.matchedContactId ?? null,
    matchDetails: match,
    processingStatus: 'READY',
    importStatus: 'NOT_IMPORTED',
    failureCode: null,
    failureMessage: null,
  })

  const result = await importEnquiryAsLead({
    tenantId,
    userId,
    connection,
    enquiry,
    mode: 'MANUAL',
    force: true,
  })

  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'indiamart_enquiry',
    entityId: enquiryId,
    action: 'RETRY',
    newValues: result,
  })
  return result
}

export async function bulkCreateLeads(tenantId: string, userId: string, enquiryIds: string[]) {
  const results = []
  for (const id of enquiryIds) {
    try {
      results.push({ id, ok: true, ...(await createLeadFromEnquiry(tenantId, userId, id)) })
    } catch (err) {
      results.push({ id, ok: false, error: (err as Error).message })
    }
  }
  return { results }
}

export async function bulkAssign(
  tenantId: string,
  userId: string,
  enquiryIds: string[],
  assignedUserId: string,
) {
  const results = []
  for (const id of enquiryIds) {
    try {
      results.push({ id, ok: true, enquiry: await assignEnquiry(tenantId, userId, id, assignedUserId) })
    } catch (err) {
      results.push({ id, ok: false, error: (err as Error).message })
    }
  }
  return { results }
}

export async function bulkIgnore(
  tenantId: string,
  userId: string,
  enquiryIds: string[],
  reason?: string,
) {
  const results = []
  for (const id of enquiryIds) {
    try {
      results.push({ id, ok: true, enquiry: await ignoreEnquiry(tenantId, userId, id, reason) })
    } catch (err) {
      results.push({ id, ok: false, error: (err as Error).message })
    }
  }
  return { results }
}

export async function listSyncRuns(tenantId: string, page: number, limit: number) {
  const result = await repo.listSyncRuns(tenantId, { page, limit })
  return {
    items: result.items.map((r) => ({
      id: r.id,
      triggerType: r.triggerType,
      status: r.status,
      requestedFrom: r.requestedFrom?.toISOString() ?? null,
      requestedTo: r.requestedTo?.toISOString() ?? null,
      recordsFetched: r.recordsFetched,
      recordsInserted: r.recordsInserted,
      recordsUpdated: r.recordsUpdated,
      recordsDuplicated: r.recordsDuplicated,
      leadsCreated: r.leadsCreated,
      leadsLinked: r.leadsLinked,
      recordsFailed: r.recordsFailed,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      durationMs: r.durationMs,
      errorCode: r.errorCode,
      errorMessage: r.errorMessage,
      triggeredById: r.triggeredById,
    })),
    total: result.total,
    page: result.page,
    limit: result.limit,
  }
}

export async function syncNow(tenantId: string, userId: string, options?: SyncIndiaMartInput) {
  return runIndiaMartSync({
    tenantId,
    userId,
    triggerType: options?.triggerType === 'INITIAL_IMPORT' ? 'INITIAL_IMPORT' : 'MANUAL',
    options,
  })
}

export async function getDashboard(tenantId: string) {
  return repo.getDashboardMetrics(tenantId)
}

export async function listAlerts(tenantId: string, unreadOnly?: boolean) {
  const { listAlerts } = await import('./indiamart.alerts.js')
  const rows = await listAlerts(tenantId, { unreadOnly, limit: 50 })
  return rows.map((r) => ({
    id: r.id,
    alertType: r.alertType,
    severity: r.severity,
    title: r.title,
    message: r.message,
    href: r.href,
    isRead: r.isRead,
    enquiryId: r.enquiryId,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function markAlertRead(tenantId: string, userId: string, id: string) {
  const { markAlertRead } = await import('./indiamart.alerts.js')
  await markAlertRead(tenantId, id, userId)
  return { ok: true }
}

export async function markAllAlertsRead(tenantId: string, userId: string) {
  const { markAllAlertsRead } = await import('./indiamart.alerts.js')
  await markAllAlertsRead(tenantId, userId)
  return { ok: true }
}

export async function enableWebhook(tenantId: string, userId: string, publicBaseUrl: string) {
  const { enablePushWebhook } = await import('./indiamart.webhook.js')
  return enablePushWebhook(tenantId, userId, publicBaseUrl)
}

export async function rotateWebhook(tenantId: string, userId: string, publicBaseUrl: string) {
  const { rotatePushWebhook } = await import('./indiamart.webhook.js')
  return rotatePushWebhook(tenantId, userId, publicBaseUrl)
}

export async function disableWebhook(tenantId: string, userId: string) {
  const { disablePushWebhook } = await import('./indiamart.webhook.js')
  return disablePushWebhook(tenantId, userId)
}

export async function listProductMappings(tenantId: string) {
  const rows = await repo.listProductMappings(tenantId)
  return rows.map((r) => ({
    id: r.id,
    externalProductKey: r.externalProductKey,
    externalProductName: r.externalProductName,
    normalizedProductName: r.normalizedProductName,
    itemId: r.itemId,
    itemCategoryId: r.itemCategoryId,
    mappingStatus: r.mappingStatus,
    confidenceScore: r.confidenceScore != null ? Number(r.confidenceScore) : null,
    updatedAt: r.updatedAt.toISOString(),
  }))
}

export async function createProductMapping(
  tenantId: string,
  userId: string,
  input: {
    externalProductName: string
    itemId?: string | null
    itemCategoryId?: string | null
    mappingStatus?: 'UNMAPPED' | 'SUGGESTED' | 'MAPPED' | 'IGNORED'
  },
) {
  const normalized = normalizeProductName(input.externalProductName) ?? input.externalProductName.toLowerCase()
  const row = await repo.upsertProductMapping(tenantId, userId, {
    externalProductName: input.externalProductName,
    normalizedProductName: normalized,
    itemId: input.itemId ?? null,
    itemCategoryId: input.itemCategoryId ?? null,
    mappingStatus: input.mappingStatus ?? (input.itemId ? 'MAPPED' : 'UNMAPPED'),
  })
  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'indiamart_product_mapping',
    entityId: row.id,
    action: 'CREATE',
    newValues: input,
  })
  return row
}

export async function updateProductMapping(
  tenantId: string,
  userId: string,
  id: string,
  input: {
    externalProductName?: string
    itemId?: string | null
    itemCategoryId?: string | null
    mappingStatus?: 'UNMAPPED' | 'SUGGESTED' | 'MAPPED' | 'IGNORED'
    confidenceScore?: number | null
  },
) {
  const existing = (await repo.listProductMappings(tenantId)).find((r) => r.id === id)
  if (!existing) throw new IndiaMartError('VALIDATION_FAILED', 'Product mapping not found', 404)
  const name = input.externalProductName ?? existing.externalProductName
  const row = await repo.upsertProductMapping(tenantId, userId, {
    id,
    externalProductName: name,
    normalizedProductName: normalizeProductName(name) ?? name.toLowerCase(),
    itemId: input.itemId !== undefined ? input.itemId : existing.itemId,
    itemCategoryId: input.itemCategoryId !== undefined ? input.itemCategoryId : existing.itemCategoryId,
    mappingStatus: input.mappingStatus ?? existing.mappingStatus,
    confidenceScore: input.confidenceScore !== undefined ? input.confidenceScore : Number(existing.confidenceScore ?? 0) || null,
  })
  await createAuditLog({
    tenantId,
    userId,
    module: 'crm',
    entity: 'indiamart_product_mapping',
    entityId: row.id,
    action: 'UPDATE',
    newValues: input,
  })
  return row
}

export async function suggestProductMappingsFromEnquiries(tenantId: string, userId: string) {
  const { prisma } = await import('../../../../config/prisma.js')
  const products = await prisma.indiaMartEnquiry.groupBy({
    by: ['productName'],
    where: { tenantId, productName: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { productName: 'desc' } },
    take: 50,
  })
  const created = []
  for (const row of products) {
    if (!row.productName) continue
    const normalized = normalizeProductName(row.productName)
    if (!normalized) continue
    const mapping = await repo.upsertProductMapping(tenantId, userId, {
      externalProductName: row.productName,
      normalizedProductName: normalized,
      mappingStatus: 'UNMAPPED',
      confidenceScore: null,
    })
    created.push(mapping)
  }
  return { suggested: created.length }
}
