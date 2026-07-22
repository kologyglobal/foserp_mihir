import type { Prisma, ProductionAccountingEventType } from '@prisma/client'
import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { ValidationError } from '../../../utils/errors.js'
import { post } from '../../accounting/posting/posting.service.js'
import type { PostingContext } from '../../accounting/posting/posting.types.js'
import { toDecimal } from '../shared/quantity.service.js'
import { buildManufacturingPostingRequest, isPostableManufacturingEvent } from './manufacturing-accounting-builder.service.js'
import {
  getManufacturingAccountingGateStatus,
  isManufacturingAccountingEnabled,
  resolveManufacturingLegalEntityId,
} from './manufacturing-accounting-gate.service.js'

export interface RecordManufacturingAccountingEventInput {
  eventType: ProductionAccountingEventType
  idempotencyKey: string
  sourceDocumentType: string
  sourceDocumentId: string
  productionOrderId?: string | null
  quantity: Prisma.Decimal.Value
  amount: Prisma.Decimal.Value
  currencyCode?: string
  payloadJson?: Prisma.InputJsonValue
  documentDate?: string
  postingDate?: string
  narration?: string | null
  /** When false, never call post() even if flag is on (tests / dry). Default true. */
  attemptPost?: boolean
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function findEventByIdempotencyKey(tenantId: string, idempotencyKey: string) {
  return prisma.productionAccountingEvent.findFirst({
    where: { tenantId, idempotencyKey },
  })
}

/**
 * Persist an idempotent production accounting event.
 * Posts a balanced SYSTEM voucher only when MANUFACTURING_ACCOUNTING is enabled
 * and amount > 0 and event type is MappingReady.
 */
export async function recordManufacturingAccountingEvent(
  req: Request | null,
  tenantId: string,
  input: RecordManufacturingAccountingEventInput,
) {
  const existing = await findEventByIdempotencyKey(tenantId, input.idempotencyKey)
  if (existing) return existing

  const legalEntityId = await resolveManufacturingLegalEntityId(tenantId)
  if (!legalEntityId) {
    throw new ValidationError('No active legal entity available for manufacturing accounting events')
  }

  const userId = req?.context?.userId ?? null
  const qty = toDecimal(input.quantity)
  const amount = toDecimal(input.amount)
  const attemptPost = input.attemptPost !== false
  const flagOn = attemptPost ? await isManufacturingAccountingEnabled(tenantId, legalEntityId) : false
  const canPost = flagOn && amount.greaterThan(0) && isPostableManufacturingEvent(input.eventType)

  let status: 'RECORDED' | 'POSTED' | 'SKIPPED_ZERO' | 'SKIPPED_FLAG_OFF' = 'RECORDED'
  if (!attemptPost) status = 'RECORDED'
  else if (!flagOn) status = 'SKIPPED_FLAG_OFF'
  else if (!canPost) status = 'SKIPPED_ZERO'

  const created = await prisma.productionAccountingEvent.create({
    data: {
      tenantId,
      legalEntityId,
      eventType: input.eventType,
      status,
      productionOrderId: input.productionOrderId ?? null,
      idempotencyKey: input.idempotencyKey,
      sourceDocumentType: input.sourceDocumentType,
      sourceDocumentId: input.sourceDocumentId,
      quantity: qty,
      amount,
      currencyCode: input.currencyCode ?? 'INR',
      payloadJson: input.payloadJson ?? undefined,
      createdBy: userId,
    },
  })

  if (!canPost) {
    return created
  }

  const documentDate = input.documentDate ?? today()
  const postingDate = input.postingDate ?? documentDate
  const postingRequest = buildManufacturingPostingRequest({
    eventType: input.eventType,
    legalEntityId,
    eventId: created.id,
    idempotencyKey: input.idempotencyKey,
    productionOrderId: input.productionOrderId ?? null,
    sourceDocumentType: input.sourceDocumentType,
    sourceDocumentId: input.sourceDocumentId,
    amount: amount.toFixed(4),
    documentDate,
    postingDate,
    narration: input.narration,
    payloadJson: input.payloadJson,
  })

  const postingContext: PostingContext = {
    tenantId,
    userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: null,
    userAgent: null,
  }

  const posting = await post(postingRequest, postingContext)

  return prisma.productionAccountingEvent.update({
    where: { id: created.id },
    data: {
      status: 'POSTED',
      voucherId: posting.voucherId,
      postingEventId: posting.postingEventId,
      postedAt: new Date(),
    },
  })
}

export async function listAccountingEvents(
  tenantId: string,
  query: { productionOrderId?: string; eventType?: ProductionAccountingEventType; page?: number; limit?: number },
) {
  const page = query.page ?? 1
  const limit = query.limit ?? 50
  const where = {
    tenantId,
    ...(query.productionOrderId ? { productionOrderId: query.productionOrderId } : {}),
    ...(query.eventType ? { eventType: query.eventType } : {}),
  }
  const [total, data] = await Promise.all([
    prisma.productionAccountingEvent.count({ where }),
    prisma.productionAccountingEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])
  return { total, page, limit, data }
}

/** Skip when tenant has no legal entity; never block shopfloor for missing finance setup when flag is off. */
export async function tryRecordManufacturingAccountingEvent(
  req: Request | null,
  tenantId: string,
  input: RecordManufacturingAccountingEventInput,
) {
  const legalEntityId = await resolveManufacturingLegalEntityId(tenantId)
  if (!legalEntityId) return null
  return recordManufacturingAccountingEvent(req, tenantId, input)
}

export { getManufacturingAccountingGateStatus }
