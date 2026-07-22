import type {
  InventoryAccountingEventStatus,
  InventoryAccountingEventType,
  InventoryStockMovement,
  Prisma,
} from '@prisma/client'
import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { logger } from '../../../config/logger.js'
import { post } from '../../accounting/posting/posting.service.js'
import type { PostingContext } from '../../accounting/posting/posting.types.js'
import { toDecimal } from '../shared/quantity.helpers.js'
import {
  buildInventoryPostingRequest,
  deriveInventoryAccountingEventType,
  isManufacturingOwnedReferenceType,
  isPostableInventoryEvent,
} from './inventory-accounting-builder.service.js'
import {
  getInventoryAccountingGateStatus,
  isInventoryAccountingEnabled,
  resolveInventoryLegalEntityId,
} from './inventory-accounting-gate.service.js'

export interface RecordInventoryAccountingEventInput {
  eventType: InventoryAccountingEventType
  idempotencyKey: string
  sourceDocumentType: string
  sourceDocumentId: string
  movementId?: string | null
  quantity: Prisma.Decimal.Value
  amount: Prisma.Decimal.Value
  currencyCode?: string
  payloadJson?: Prisma.InputJsonValue
  documentDate?: string
  postingDate?: string
  narration?: string | null
  userId?: string | null
  /** When false, never call post() even if flag is on (tests / dry). Default true. */
  attemptPost?: boolean
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function findEventByIdempotencyKey(tenantId: string, idempotencyKey: string) {
  return prisma.inventoryAccountingEvent.findFirst({
    where: { tenantId, idempotencyKey },
  })
}

/**
 * Persist an idempotent inventory accounting event and post a balanced SYSTEM
 * voucher via the central posting service when INVENTORY_ACCOUNTING is enabled.
 *
 * Never throws for missing finance setup: missing legal entity, disabled flag,
 * zero valuation, or a posting failure all record the event with a clear
 * skipped/failed status instead. Quantity postings must not depend on GL.
 */
export async function recordInventoryAccountingEvent(
  req: Request | null,
  tenantId: string,
  input: RecordInventoryAccountingEventInput,
) {
  const existing = await findEventByIdempotencyKey(tenantId, input.idempotencyKey)
  if (existing) return existing

  const legalEntityId = await resolveInventoryLegalEntityId(tenantId)
  const userId = input.userId ?? req?.context?.userId ?? null
  const qty = toDecimal(input.quantity)
  const amount = toDecimal(input.amount)
  const attemptPost = input.attemptPost !== false
  const flagOn = attemptPost && legalEntityId
    ? await isInventoryAccountingEnabled(tenantId, legalEntityId)
    : false
  const canPost =
    flagOn && legalEntityId != null && amount.greaterThan(0) && isPostableInventoryEvent(input.eventType)

  let status: InventoryAccountingEventStatus = 'RECORDED'
  if (!attemptPost) status = 'RECORDED'
  else if (!legalEntityId) status = 'SKIPPED_NO_LEGAL_ENTITY'
  else if (!flagOn) status = 'SKIPPED_FLAG_OFF'
  else if (!canPost) status = 'SKIPPED_ZERO'

  const created = await prisma.inventoryAccountingEvent.create({
    data: {
      tenantId,
      legalEntityId,
      eventType: input.eventType,
      status,
      movementId: input.movementId ?? null,
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

  if (!canPost || !legalEntityId) {
    return created
  }

  const documentDate = input.documentDate ?? today()
  const postingDate = input.postingDate ?? documentDate
  try {
    const postingRequest = buildInventoryPostingRequest({
      eventType: input.eventType,
      legalEntityId,
      eventId: created.id,
      idempotencyKey: input.idempotencyKey,
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

    return await prisma.inventoryAccountingEvent.update({
      where: { id: created.id },
      data: {
        status: 'POSTED',
        voucherId: posting.voucherId,
        postingEventId: posting.postingEventId,
        postedAt: new Date(),
      },
    })
  } catch (error) {
    // GL posting must never block the quantity posting — record the failure instead.
    const failureReason = error instanceof Error ? error.message : String(error)
    logger.warn('Inventory accounting event GL posting failed', {
      tenantId,
      eventId: created.id,
      eventType: input.eventType,
      failureReason,
    })
    return prisma.inventoryAccountingEvent.update({
      where: { id: created.id },
      data: { status: 'FAILED', failureReason },
    })
  }
}

export interface MovementAccountingOptions {
  sourceDocumentType: string
  sourceDocumentId: string
  /** Explicit event type. When omitted it is derived from the movement reference type + sign. */
  eventType?: InventoryAccountingEventType
  narration?: string | null
  userId?: string | null
  attemptPost?: boolean
}

/**
 * Best-effort accounting hook for a posted inventory stock movement.
 * - Skips manufacturing-owned movement types (owned by MANUFACTURING_ACCOUNTING).
 * - Idempotent per movement id.
 * - Never throws: any error is logged and swallowed so stock posting flows stay unaffected.
 */
export async function tryRecordInventoryAccountingEventForMovement(
  req: Request | null,
  tenantId: string,
  movement: Pick<
    InventoryStockMovement,
    | 'id'
    | 'referenceType'
    | 'quantity'
    | 'value'
    | 'movementNumber'
    | 'movementDate'
    | 'itemId'
    | 'warehouseId'
    | 'referenceNo'
    | 'fromStockStatus'
  >,
  options: MovementAccountingOptions,
) {
  try {
    // Status transfers (QC release/reject) carry no valuation delta — not accounting events.
    if (movement.fromStockStatus) return null
    if (isManufacturingOwnedReferenceType(movement.referenceType)) return null
    const signedQuantity = Number(movement.quantity)
    const eventType =
      options.eventType ??
      deriveInventoryAccountingEventType(movement.referenceType, signedQuantity)
    if (!eventType) return null

    return await recordInventoryAccountingEvent(req, tenantId, {
      eventType,
      idempotencyKey: `INV_ACCT:${movement.id}:V1`,
      sourceDocumentType: options.sourceDocumentType,
      sourceDocumentId: options.sourceDocumentId,
      movementId: movement.id,
      quantity: toDecimal(movement.quantity).abs(),
      amount: toDecimal(movement.value ?? 0).abs(),
      documentDate: movement.movementDate.toISOString().slice(0, 10),
      narration: options.narration ?? `Inventory ${eventType} ${movement.movementNumber}`,
      userId: options.userId ?? null,
      attemptPost: options.attemptPost,
      payloadJson: {
        movementId: movement.id,
        movementNumber: movement.movementNumber,
        referenceType: movement.referenceType,
        referenceNo: movement.referenceNo,
        itemId: movement.itemId,
        warehouseId: movement.warehouseId,
        signedQuantity,
      },
    })
  } catch (error) {
    logger.warn('Inventory accounting hook failed (ignored)', {
      tenantId,
      movementId: movement.id,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/** Convenience wrapper for hooking a batch of movements after a document posting commits. */
export async function tryRecordInventoryAccountingEventsForMovements(
  req: Request | null,
  tenantId: string,
  movements: Array<Parameters<typeof tryRecordInventoryAccountingEventForMovement>[2]>,
  options: MovementAccountingOptions,
) {
  for (const movement of movements) {
    await tryRecordInventoryAccountingEventForMovement(req, tenantId, movement, options)
  }
}

export async function listInventoryAccountingEvents(
  tenantId: string,
  query: {
    eventType?: InventoryAccountingEventType
    status?: InventoryAccountingEventStatus
    sourceDocumentId?: string
    page?: number
    limit?: number
  },
) {
  const page = query.page ?? 1
  const limit = query.limit ?? 50
  const where = {
    tenantId,
    ...(query.eventType ? { eventType: query.eventType } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.sourceDocumentId ? { sourceDocumentId: query.sourceDocumentId } : {}),
  }
  const [total, data] = await Promise.all([
    prisma.inventoryAccountingEvent.count({ where }),
    prisma.inventoryAccountingEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])
  return { total, page, limit, data }
}

export { getInventoryAccountingGateStatus }
