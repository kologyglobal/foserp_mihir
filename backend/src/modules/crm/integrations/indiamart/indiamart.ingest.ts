import type { IndiaMartConnection, Prisma } from '@prisma/client'
import { matchEnquiryAgainstCrm } from './indiamart.deduplication.js'
import {
  buildDedupeFingerprint,
  normalizeCompanyName,
  normalizeEmail,
  normalizeIndiaMartEnquiry,
  normalizeMobile,
} from './indiamart.normalizer.js'
import * as repo from './indiamart.repository.js'
import type { IndiaMartConfigurationJson } from './indiamart.types.js'
import { maybeCreateAlertsForEnquiry } from './indiamart.alerts.js'

export function computeSlaStatus(
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

/**
 * Extract the lead object from an IndiaMART Push payload.
 * Documented body: { CODE, STATUS, RESPONSE: { UNIQUE_QUERY_ID, ... } }
 * Also accept top-level lead fields or a wrapped { body: { RESPONSE } } shape.
 */
export function extractPushLeadPayload(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body
  const root = body as Record<string, unknown>

  if (root.RESPONSE && typeof root.RESPONSE === 'object') return root.RESPONSE

  if (root.body && typeof root.body === 'object') {
    const inner = root.body as Record<string, unknown>
    if (inner.RESPONSE && typeof inner.RESPONSE === 'object') return inner.RESPONSE
    if (inner.UNIQUE_QUERY_ID || inner.unique_query_id) return inner
  }

  if (root.UNIQUE_QUERY_ID || root.unique_query_id) return root
  return body
}

export async function ingestIndiaMartEnquiry(input: {
  tenantId: string
  connection: IndiaMartConnection
  syncRunId?: string | null
  raw: unknown
  fieldMap?: IndiaMartConfigurationJson['responseFieldMap']
}) {
  const normalized = normalizeIndiaMartEnquiry(input.raw, input.fieldMap)
  const existing = await repo.findEnquiryByExternalId(input.tenantId, normalized.externalEnquiryId)
  if (existing) {
    await repo.updateEnquiry(input.tenantId, existing.id, {
      lastSeenAt: new Date(),
      rawPayload: normalized.rawPayload as Prisma.InputJsonValue,
      ...(input.syncRunId ? { syncRunId: input.syncRunId } : {}),
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
    ...(input.syncRunId
      ? { syncRun: { connect: { id: input.syncRunId } } }
      : {}),
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

  await maybeCreateAlertsForEnquiry(input.connection, enquiry)

  return { enquiry, inserted: true, duplicated: false }
}
