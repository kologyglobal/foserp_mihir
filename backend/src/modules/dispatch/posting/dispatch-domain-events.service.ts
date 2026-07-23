/**
 * Phase 7C5 — Dispatch domain event outbox (retry-safe).
 *
 * Producers enqueue PENDING rows in the same DB transaction as post/reverse.
 * `processPendingDomainEvents` claims and marks PUBLISHED after in-process handlers
 * acknowledge. Auto DRAFT SI may run from `SALES_ORDER_INVOICE_READY`.
 * COGS G/L is **not** created here — it posts via Inventory Accounting on FG_DISPATCH
 * (`tryRecordInventoryAccountingEventsForMovements` in DispatchPostingService).
 */
import { randomUUID } from 'node:crypto'
import type { DispatchDomainEvent, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { logger } from '../../../config/logger.js'

export type DispatchDomainEventTypeName =
  | 'DISPATCH_POSTED'
  | 'SALES_ORDER_DISPATCH_FULFILMENT_CHANGED'
  | 'SALES_ORDER_INVOICE_READY'
  | 'DISPATCH_REVERSED'

type Tx = Prisma.TransactionClient | typeof prisma

export type DispatchDomainEventDto = {
  id: string
  eventType: string
  status: string
  aggregateType: string
  aggregateId: string
  payload: unknown
  idempotencyKey: string
  availableAt: string
  publishedAt: string | null
  failureReason: string | null
  createdAt: string
  updatedAt: string
}

export function mapDispatchDomainEvent(row: DispatchDomainEvent): DispatchDomainEventDto {
  return {
    id: row.id,
    eventType: row.eventType,
    status: row.status,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    payload: row.payloadJson,
    idempotencyKey: row.idempotencyKey,
    availableAt: row.availableAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    failureReason: row.failureReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function enqueueDispatchDomainEvent(
  tx: Tx,
  input: {
    tenantId: string
    eventType: DispatchDomainEventTypeName
    aggregateType: string
    aggregateId: string
    payload: Record<string, unknown>
    idempotencyKey: string
  },
) {
  const existing = await tx.dispatchDomainEvent.findFirst({
    where: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey },
    select: { id: true },
  })
  if (existing) return existing

  return tx.dispatchDomainEvent.create({
    data: {
      id: randomUUID(),
      tenantId: input.tenantId,
      eventType: input.eventType,
      status: 'PENDING',
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payloadJson: input.payload as Prisma.InputJsonValue,
      idempotencyKey: input.idempotencyKey,
    },
    select: { id: true },
  })
}

export async function enqueuePostingEvents(
  tx: Tx,
  args: {
    tenantId: string
    outboundDispatchId: string
    dispatchNo: string
    postingId: string
    postingNumber: string
    salesOrderId: string | null
    postedQty: number
    linePayload: Array<{
      salesOrderLineId: string | null
      itemId: string
      quantity: number
      warehouseId: string
    }>
    deliveryChallanId: string | null
    postedBy: string | null
    postingDate: string
  },
) {
  await enqueueDispatchDomainEvent(tx, {
    tenantId: args.tenantId,
    eventType: 'DISPATCH_POSTED',
    aggregateType: 'DispatchPosting',
    aggregateId: args.postingId,
    idempotencyKey: `dispatch-posted:${args.postingId}`,
    payload: {
      tenantId: args.tenantId,
      outboundDispatchId: args.outboundDispatchId,
      dispatchNo: args.dispatchNo,
      postingId: args.postingId,
      postingNumber: args.postingNumber,
      salesOrderId: args.salesOrderId,
      postedQty: args.postedQty,
      lines: args.linePayload,
      deliveryChallanId: args.deliveryChallanId,
      postedBy: args.postedBy,
      postingDate: args.postingDate,
    },
  })

  if (args.salesOrderId) {
    await enqueueDispatchDomainEvent(tx, {
      tenantId: args.tenantId,
      eventType: 'SALES_ORDER_DISPATCH_FULFILMENT_CHANGED',
      aggregateType: 'CrmSalesOrder',
      aggregateId: args.salesOrderId,
      idempotencyKey: `so-fulfilment:${args.salesOrderId}:${args.postingId}`,
      payload: {
        tenantId: args.tenantId,
        salesOrderId: args.salesOrderId,
        outboundDispatchId: args.outboundDispatchId,
        postingId: args.postingId,
        reason: 'DISPATCH_POSTED',
        netDispatchedDelta: args.postedQty,
        lines: args.linePayload,
      },
    })

    await enqueueDispatchDomainEvent(tx, {
      tenantId: args.tenantId,
      eventType: 'SALES_ORDER_INVOICE_READY',
      aggregateType: 'CrmSalesOrder',
      aggregateId: args.salesOrderId,
      idempotencyKey: `so-invoice-ready:${args.salesOrderId}:${args.postingId}`,
      payload: {
        tenantId: args.tenantId,
        salesOrderId: args.salesOrderId,
        outboundDispatchId: args.outboundDispatchId,
        postingId: args.postingId,
        postingNumber: args.postingNumber,
        deliveryChallanId: args.deliveryChallanId,
        postingDate: args.postingDate,
        postedBy: args.postedBy,
        lines: args.linePayload,
        note: 'Triggers DRAFT Sales Invoice auto-create when ENABLE_AUTO_SALES_INVOICE_FROM_DISPATCH is on',
      },
    })
  }
}

export async function enqueueReversalEvents(
  tx: Tx,
  args: {
    tenantId: string
    outboundDispatchId: string
    postingId: string
    reversalId: string
    salesOrderId: string | null
    reversedQty: number
    linePayload: Array<{ salesOrderLineId: string | null; quantity: number }>
  },
) {
  await enqueueDispatchDomainEvent(tx, {
    tenantId: args.tenantId,
    eventType: 'DISPATCH_REVERSED',
    aggregateType: 'DispatchReversal',
    aggregateId: args.reversalId,
    idempotencyKey: `dispatch-reversed:${args.reversalId}`,
    payload: {
      tenantId: args.tenantId,
      outboundDispatchId: args.outboundDispatchId,
      postingId: args.postingId,
      reversalId: args.reversalId,
      reversedQty: args.reversedQty,
      lines: args.linePayload,
    },
  })

  if (args.salesOrderId) {
    await enqueueDispatchDomainEvent(tx, {
      tenantId: args.tenantId,
      eventType: 'SALES_ORDER_DISPATCH_FULFILMENT_CHANGED',
      aggregateType: 'CrmSalesOrder',
      aggregateId: args.salesOrderId,
      idempotencyKey: `so-fulfilment-rev:${args.salesOrderId}:${args.reversalId}`,
      payload: {
        tenantId: args.tenantId,
        salesOrderId: args.salesOrderId,
        outboundDispatchId: args.outboundDispatchId,
        postingId: args.postingId,
        reversalId: args.reversalId,
        reason: 'DISPATCH_REVERSED',
        netDispatchedDelta: -args.reversedQty,
        lines: args.linePayload,
      },
    })
  }
}

type DomainHandler = (event: DispatchDomainEvent) => Promise<void>

/**
 * In-process handlers — Finance auto-draft SI on invoice-ready; other events stay light.
 */
const HANDLERS: Record<DispatchDomainEventTypeName, DomainHandler> = {
  DISPATCH_POSTED: async (event) => {
    logger.info('dispatch.domain_event.DISPATCH_POSTED', {
      tenantId: event.tenantId,
      eventId: event.id,
      aggregateId: event.aggregateId,
    })
    const { isAutoSalesInvoiceFromDispatchEnabled, createDraftSalesInvoiceFromDispatchPosting } =
      await import('./dispatch-auto-sales-invoice.service.js')
    if (!isAutoSalesInvoiceFromDispatchEnabled()) return
    const payload = event.payloadJson as { postedBy?: string | null } | null
    const result = await createDraftSalesInvoiceFromDispatchPosting(event.tenantId, event.aggregateId, {
      actorUserId: payload?.postedBy ?? null,
    })
    logger.info('dispatch.domain_event.DISPATCH_POSTED.auto_si', {
      tenantId: event.tenantId,
      postingId: event.aggregateId,
      result,
    })
  },
  SALES_ORDER_INVOICE_READY: async (event) => {
    logger.info('dispatch.domain_event.SALES_ORDER_INVOICE_READY', {
      tenantId: event.tenantId,
      eventId: event.id,
      salesOrderId: event.aggregateId,
    })
    const { isAutoSalesInvoiceFromDispatchEnabled, createDraftSalesInvoiceFromDispatchPosting } =
      await import('./dispatch-auto-sales-invoice.service.js')
    if (!isAutoSalesInvoiceFromDispatchEnabled()) {
      return
    }
    const payload = event.payloadJson as { postingId?: string; postedBy?: string | null } | null
    const postingId = payload?.postingId
    if (!postingId) {
      logger.warn('dispatch.domain_event.SALES_ORDER_INVOICE_READY.missing_postingId', {
        eventId: event.id,
      })
      return
    }
    const result = await createDraftSalesInvoiceFromDispatchPosting(event.tenantId, postingId, {
      actorUserId: payload?.postedBy ?? null,
    })
    logger.info('dispatch.domain_event.SALES_ORDER_INVOICE_READY.auto_si', {
      tenantId: event.tenantId,
      postingId,
      result,
    })
  },
  SALES_ORDER_DISPATCH_FULFILMENT_CHANGED: async (event) => {
    logger.info('dispatch.domain_event.SALES_ORDER_DISPATCH_FULFILMENT_CHANGED', {
      tenantId: event.tenantId,
      eventId: event.id,
      salesOrderId: event.aggregateId,
    })
  },
  DISPATCH_REVERSED: async (event) => {
    logger.info('dispatch.domain_event.DISPATCH_REVERSED', {
      tenantId: event.tenantId,
      eventId: event.id,
      aggregateId: event.aggregateId,
    })
  },
}

async function markPublished(tenantId: string, eventId: string): Promise<boolean> {
  const result = await prisma.dispatchDomainEvent.updateMany({
    where: { id: eventId, tenantId, status: 'PENDING' },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      failureReason: null,
    },
  })
  return result.count === 1
}

async function markFailed(
  tenantId: string,
  eventId: string,
  reason: string,
  retryDelayMs = 60_000,
): Promise<void> {
  await prisma.dispatchDomainEvent.updateMany({
    where: { id: eventId, tenantId, status: 'PENDING' },
    data: {
      status: 'FAILED',
      failureReason: reason.slice(0, 2000),
      availableAt: new Date(Date.now() + retryDelayMs),
    },
  })
}

/**
 * Claim PENDING (or retryable FAILED past availableAt) events, run handlers, mark PUBLISHED.
 */
export async function processPendingDomainEvents(
  tenantId: string,
  options?: { limit?: number; includeFailed?: boolean },
): Promise<{ processed: number; published: number; failed: number }> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200)
  const now = new Date()
  const statusFilter = options?.includeFailed
    ? { in: ['PENDING', 'FAILED'] as const }
    : ('PENDING' as const)

  const batch = await prisma.dispatchDomainEvent.findMany({
    where: {
      tenantId,
      status: statusFilter,
      availableAt: { lte: now },
    },
    orderBy: { availableAt: 'asc' },
    take: limit,
  })

  let published = 0
  let failed = 0

  for (const event of batch) {
    if (event.status === 'FAILED') {
      const reclaimed = await prisma.dispatchDomainEvent.updateMany({
        where: { id: event.id, tenantId, status: 'FAILED', availableAt: { lte: now } },
        data: { status: 'PENDING', failureReason: null },
      })
      if (reclaimed.count !== 1) continue
    }

    try {
      const handler = HANDLERS[event.eventType as DispatchDomainEventTypeName]
      if (!handler) {
        throw new Error(`No handler for event type ${event.eventType}`)
      }
      await handler(event)
      const ok = await markPublished(tenantId, event.id)
      if (ok) published += 1
    } catch (err) {
      failed += 1
      const message = err instanceof Error ? err.message : String(err)
      await markFailed(tenantId, event.id, message)
      logger.error('dispatch.domain_event.process_failed', {
        tenantId,
        eventId: event.id,
        eventType: event.eventType,
        error: message,
      })
    }
  }

  return { processed: batch.length, published, failed }
}

/** Drain after post/reverse commit. */
export async function drainDispatchDomainOutbox(tenantId: string, limit = 30): Promise<void> {
  await processPendingDomainEvents(tenantId, { limit, includeFailed: false })
}

export async function listDispatchDomainEvents(
  tenantId: string,
  query: {
    page?: number
    limit?: number
    status?: 'PENDING' | 'PUBLISHED' | 'FAILED'
    eventType?: DispatchDomainEventTypeName
    aggregateId?: string
  },
) {
  const page = Math.max(1, query.page ?? 1)
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100)
  const where: Prisma.DispatchDomainEventWhereInput = {
    tenantId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.eventType ? { eventType: query.eventType } : {}),
    ...(query.aggregateId ? { aggregateId: query.aggregateId } : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.dispatchDomainEvent.count({ where }),
    prisma.dispatchDomainEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])
  return {
    items: rows.map(mapDispatchDomainEvent),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

export async function getDispatchDomainEvent(tenantId: string, id: string) {
  const row = await prisma.dispatchDomainEvent.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('Dispatch domain event not found')
  return mapDispatchDomainEvent(row)
}

export async function retryDispatchDomainEvent(tenantId: string, id: string) {
  const row = await prisma.dispatchDomainEvent.findFirst({ where: { id, tenantId } })
  if (!row) throw new NotFoundError('Dispatch domain event not found')
  if (row.status === 'PUBLISHED') return mapDispatchDomainEvent(row)

  await prisma.dispatchDomainEvent.update({
    where: { id },
    data: {
      status: 'PENDING',
      availableAt: new Date(),
      failureReason: null,
      publishedAt: null,
    },
  })

  await processPendingDomainEvents(tenantId, { limit: 5, includeFailed: false })
  return getDispatchDomainEvent(tenantId, id)
}
