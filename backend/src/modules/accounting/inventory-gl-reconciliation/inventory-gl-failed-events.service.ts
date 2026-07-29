/**
 * FIN-CLOSE-1 — unified failed / unposted Inventory + Manufacturing accounting events.
 * Retry is idempotent via existing posting event keys. No silent success / Force Balance.
 */
import type { Request } from 'express'
import { prisma } from '../../../config/database.js'
import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { formatForPersistence, toDecimal } from '../shared/finance-decimal.js'
import { post } from '../posting/posting.service.js'
import type { PostingContext } from '../posting/posting.types.js'
import { buildInventoryPostingRequest, isPostableInventoryEvent } from '../../inventory/accounting/inventory-accounting-builder.service.js'
import { isInventoryAccountingEnabled } from '../../inventory/accounting/inventory-accounting-gate.service.js'
import { postEvent as postManufacturingEvent } from '../../manufacturing/costing/posting-orchestrator.service.js'
import type {
  FailedAccountingEventSource,
  UnifiedFailedAccountingEvent,
} from './inventory-gl-reconciliation.types.js'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function mapInventory(row: {
  id: string
  legalEntityId: string | null
  eventType: string
  status: string
  sourceDocumentType: string
  sourceDocumentId: string
  amount: unknown
  failureReason: string | null
  voucherId: string | null
  postingEventId: string | null
  idempotencyKey: string
  createdAt: Date
}): UnifiedFailedAccountingEvent {
  const canRetry = row.status === 'FAILED' || row.status === 'RECORDED'
  return {
    id: row.id,
    source: 'INVENTORY',
    eventType: row.eventType,
    status: row.status,
    legalEntityId: row.legalEntityId,
    productionOrderId: null,
    sourceDocumentType: row.sourceDocumentType,
    sourceDocumentId: row.sourceDocumentId,
    amount: formatForPersistence(toDecimal(row.amount as never)),
    failureReason: row.failureReason,
    voucherId: row.voucherId,
    postingEventId: row.postingEventId,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt.toISOString(),
    updatedAt: null,
    canRetry,
    links: {
      eventPath: `/inventory/accounting/events/${row.id}`,
      sourcePath: null,
      voucherPath: row.voucherId ? `/accounting/vouchers/${row.voucherId}` : null,
    },
  }
}

function mapManufacturing(row: {
  id: string
  legalEntityId: string
  eventType: string
  status: string
  productionOrderId: string | null
  sourceDocumentType: string
  sourceDocumentId: string
  amount: unknown
  failureReason: string | null
  voucherId: string | null
  postingEventId: string | null
  idempotencyKey: string
  createdAt: Date
  updatedAt: Date
}): UnifiedFailedAccountingEvent {
  const canRetry = row.status === 'FAILED' || row.status === 'RECORDED'
  return {
    id: row.id,
    source: 'MANUFACTURING',
    eventType: row.eventType,
    status: row.status,
    legalEntityId: row.legalEntityId,
    productionOrderId: row.productionOrderId,
    sourceDocumentType: row.sourceDocumentType,
    sourceDocumentId: row.sourceDocumentId,
    amount: formatForPersistence(toDecimal(row.amount as never)),
    failureReason: row.failureReason,
    voucherId: row.voucherId,
    postingEventId: row.postingEventId,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    canRetry,
    links: {
      eventPath: `/accounting/manufacturing`,
      sourcePath: row.productionOrderId
        ? `/manufacturing/work-orders/${row.productionOrderId}`
        : null,
      voucherPath: row.voucherId ? `/accounting/vouchers/${row.voucherId}` : null,
    },
  }
}

export async function listUnifiedFailedAccountingEvents(
  tenantId: string,
  query: {
    legalEntityId?: string
    source?: FailedAccountingEventSource | 'ALL'
    includeUnposted?: boolean
    page?: number
    limit?: number
  },
) {
  const page = query.page ?? 1
  const limit = Math.min(query.limit ?? 50, 200)
  const statuses = query.includeUnposted === false ? (['FAILED'] as const) : (['FAILED', 'RECORDED'] as const)
  const source = query.source ?? 'ALL'

  const [invRows, mfgRows] = await Promise.all([
    source === 'MANUFACTURING'
      ? Promise.resolve([])
      : prisma.inventoryAccountingEvent.findMany({
          where: {
            tenantId,
            status: { in: [...statuses] },
            ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
    source === 'INVENTORY'
      ? Promise.resolve([])
      : prisma.productionAccountingEvent.findMany({
          where: {
            tenantId,
            status: { in: [...statuses] },
            ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
          },
          orderBy: { updatedAt: 'desc' },
          take: 500,
        }),
  ])

  const merged = [
    ...invRows.map(mapInventory),
    ...mfgRows.map(mapManufacturing),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const total = merged.length
  const data = merged.slice((page - 1) * limit, page * limit)
  return {
    total,
    page,
    limit,
    forceBalanceAllowed: false as const,
    data,
  }
}

async function retryInventoryEvent(req: Request, tenantId: string, eventId: string) {
  const event = await prisma.inventoryAccountingEvent.findFirst({
    where: { id: eventId, tenantId },
  })
  if (!event) throw new NotFoundError('Inventory accounting event not found')
  if (event.status === 'POSTED') return mapInventory(event)
  if (!['FAILED', 'RECORDED'].includes(event.status)) {
    throw new InvalidStateError(`Only FAILED or RECORDED inventory events can be retried (status=${event.status})`)
  }
  if (!event.legalEntityId) {
    throw new ValidationError('Inventory accounting event has no legal entity')
  }
  if (!(await isInventoryAccountingEnabled(tenantId, event.legalEntityId))) {
    throw new ValidationError('INVENTORY_ACCOUNTING is not enabled for this legal entity')
  }
  if (!isPostableInventoryEvent(event.eventType) || toDecimal(event.amount).lte(0)) {
    throw new ValidationError('Event is not postable (zero amount or unsupported type)')
  }

  const userId = req.context?.userId ?? null
  const documentDate = today()
  try {
    const postingRequest = buildInventoryPostingRequest({
      eventType: event.eventType,
      legalEntityId: event.legalEntityId,
      eventId: event.id,
      idempotencyKey: event.idempotencyKey,
      sourceDocumentType: event.sourceDocumentType,
      sourceDocumentId: event.sourceDocumentId,
      amount: toDecimal(event.amount).toFixed(4),
      documentDate,
      postingDate: documentDate,
      narration: `Retry inventory accounting ${event.eventType}`,
      payloadJson: event.payloadJson ?? undefined,
    })
    const postingContext: PostingContext = {
      tenantId,
      userId,
      authorization: { permissionChecked: true },
      workflow: { workflowSatisfied: true },
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    }
    const posting = await post(postingRequest, postingContext)
    const updated = await prisma.inventoryAccountingEvent.update({
      where: { id: event.id },
      data: {
        status: 'POSTED',
        voucherId: posting.voucherId,
        postingEventId: posting.postingEventId,
        postedAt: new Date(),
        failureReason: null,
      },
    })
    return mapInventory(updated)
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : String(error)
    await prisma.inventoryAccountingEvent.update({
      where: { id: event.id },
      data: { status: 'FAILED', failureReason },
    })
    throw error
  }
}

export async function retryUnifiedFailedAccountingEvent(
  req: Request,
  tenantId: string,
  eventId: string,
  source: FailedAccountingEventSource,
) {
  if (source === 'INVENTORY') {
    return retryInventoryEvent(req, tenantId, eventId)
  }
  const updated = await postManufacturingEvent(req, tenantId, eventId)
  return mapManufacturing(updated)
}
