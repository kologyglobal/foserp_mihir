/**
 * Manufacturing ProductionAccountingEvent integrity for enablement readiness.
 * Derives exception kinds from existing event + inventory + posting fields (no new tables).
 */
import type { ProductionAccountingEvent } from '@prisma/client'
import { prisma } from '../../../config/database.js'

const DETAIL_LIMIT = 50
const MAX_RETRY_ATTEMPTS = 5

const INVENTORY_SOURCE_TYPE = 'INVENTORY_STOCK_MOVEMENT'
const INVENTORY_REFERENCE_TYPES = ['ISSUE_TO_WO', 'RETURN_FROM_WO', 'FG_RECEIPT', 'SA_RECEIPT'] as const
const INVENTORY_EVENT_TYPES = new Set([
  'MATERIAL_ISSUED',
  'MATERIAL_RETURNED',
  'FINISHED_GOODS_RECEIVED',
  'SEMI_FINISHED_RECEIVED',
])

export type EventExceptionKind =
  | 'FAILED'
  | 'UNRECONCILED'
  | 'RETRY_EXHAUSTED'
  | 'INVENTORY_MISSING_ACCOUNTING'
  | 'ACCOUNTING_MISSING_INVENTORY'
  | 'REVERSAL_CHAIN_INCONSISTENT'
  | 'DUPLICATE_PENDING_POSTING'

export type SafeAccountingEventException = {
  eventId: string | null
  sourceType: string
  sourceDocument: string
  workOrderId: string | null
  workOrderNumber: string | null
  eventType: string | null
  status: string | null
  reconciliationStatus: EventExceptionKind
  failureCode: string | null
  failureReason: string | null
  retryEligible: boolean
  createdAt: string | null
  lastAttemptedAt: string | null
}

/** Elevated / secure technical payload — no stack traces. */
export type TechnicalAccountingEventException = {
  eventId: string | null
  postingEventId: string | null
  voucherId: string | null
  idempotencyKey: string | null
  attemptCount: number | null
  postingErrorCode: string | null
  rawFailureReason: string | null
  inventoryMovementId: string | null
  exceptionKind: EventExceptionKind
}

export type AccountingEventIntegrityResult = {
  failedAccountingEventCount: number
  unreconciledAccountingEventCount: number
  inventoryPostingsUnreconciledCount: number
  retryExhaustedCount: number
  inventoryMissingAccountingCount: number
  accountingMissingInventoryCount: number
  reversalChainInconsistentCount: number
  duplicatePendingPostingCount: number
  /** True when FAILED_ACCOUNTING_EVENTS should block. */
  hasFailedBlocker: boolean
  /** True when INVENTORY_POSTINGS_UNRECONCILED should block. */
  hasInventoryUnreconciledBlocker: boolean
  blockers: Array<'FAILED_ACCOUNTING_EVENTS' | 'INVENTORY_POSTINGS_UNRECONCILED'>
  counts: {
    failed: number
    unreconciled: number
    retryExhausted: number
    inventoryMissingAccounting: number
    accountingMissingInventory: number
    reversalChainInconsistent: number
    duplicatePendingPosting: number
    totalExceptions: number
  }
  exceptions: SafeAccountingEventException[]
  technicalDetails?: TechnicalAccountingEventException[]
}

type EventRow = ProductionAccountingEvent & {
  productionOrder: { orderNumber: string } | null
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

/** Strip stack frames / multiline dumps from failure text for UI-safe responses. */
export function sanitizeFailureReason(raw: string | null | undefined): string | null {
  if (!raw) return null
  const firstLine = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !/^at\s+/.test(line) && !/^\s*[-+]{2,}/.test(line))
  if (!firstLine) return null
  return firstLine
    .replace(/\s+at\s+\S+.*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
}

export function parseFailureCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const match = /^(CONFIGURATION|OPERATIONAL|ACCOUNTING|TECHNICAL)\b/i.exec(raw.trim())
  if (match) return match[1]!.toUpperCase()
  if (/retry.?exhaust/i.test(raw)) return 'RETRY_EXHAUSTED'
  return 'UNKNOWN'
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

function pushCapped<T>(list: T[], item: T, limit = DETAIL_LIMIT) {
  if (list.length < limit) list.push(item)
}

/**
 * Inspect ProductionAccountingEvent (+ inventory / posting cross-checks) for enablement.
 */
export async function inspectManufacturingAccountingEventIntegrity(
  tenantId: string,
  legalEntityId: string,
  options?: {
    workOrderId?: string
    includeTechnicalDetails?: boolean
  },
): Promise<AccountingEventIntegrityResult> {
  const workOrderFilter = options?.workOrderId ? { productionOrderId: options.workOrderId } : {}

  const events = (await prisma.productionAccountingEvent.findMany({
    where: { tenantId, legalEntityId, ...workOrderFilter },
    include: { productionOrder: { select: { orderNumber: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 2000,
  })) as EventRow[]

  const postingEventIds = events.map((e) => e.postingEventId).filter((id): id is string => Boolean(id))
  const postingEvents = postingEventIds.length
    ? await prisma.postingEvent.findMany({
        where: { tenantId, id: { in: postingEventIds } },
        select: {
          id: true,
          attemptCount: true,
          lastAttemptAt: true,
          errorCode: true,
          errorMessage: true,
          status: true,
        },
      })
    : []
  const postingById = new Map(postingEvents.map((row) => [row.id, row]))

  const inventorySourceIds = [
    ...new Set(
      events
        .filter((e) => e.sourceDocumentType === INVENTORY_SOURCE_TYPE)
        .map((e) => e.sourceDocumentId),
    ),
  ]
  const inventoryMovements = inventorySourceIds.length
    ? await prisma.inventoryStockMovement.findMany({
        where: { tenantId, id: { in: inventorySourceIds } },
        select: { id: true, movementNumber: true, referenceType: true, workOrderId: true },
      })
    : []
  const inventoryById = new Map(inventoryMovements.map((row) => [row.id, row]))

  const exceptions: SafeAccountingEventException[] = []
  const technical: TechnicalAccountingEventException[] = []

  let failedCount = 0
  let unreconciledCount = 0
  let retryExhaustedCount = 0
  let accountingMissingInventoryCount = 0
  let reversalChainInconsistentCount = 0
  let duplicatePendingPostingCount = 0

  const pendingKeyCounts = new Map<string, EventRow[]>()
  for (const event of events) {
    if (event.status === 'RECORDED' || event.status === 'FAILED') {
      const key = `${event.eventType}|${event.sourceDocumentType}|${event.sourceDocumentId}`
      const list = pendingKeyCounts.get(key) ?? []
      list.push(event)
      pendingKeyCounts.set(key, list)
    }
  }

  const duplicateEventIds = new Set<string>()
  for (const list of pendingKeyCounts.values()) {
    if (list.length > 1) {
      duplicatePendingPostingCount += list.length
      for (const event of list) duplicateEventIds.add(event.id)
    }
  }

  const eventsById = new Map(events.map((e) => [e.id, e]))

  for (const event of events) {
    const posting = event.postingEventId ? postingById.get(event.postingEventId) : undefined
    const attemptCount = posting?.attemptCount ?? Number(asRecord(event.payloadJson).attemptCount ?? 0)
    const lastAttemptedAt = posting?.lastAttemptAt ?? event.updatedAt
    const sanitized = sanitizeFailureReason(event.failureReason)
    const failureCode = event.status === 'FAILED' ? parseFailureCode(event.failureReason) : null
    const retryExhausted =
      event.status === 'FAILED' &&
      (attemptCount >= MAX_RETRY_ATTEMPTS ||
        /retry.?exhaust/i.test(event.failureReason ?? '') ||
        Boolean(asRecord(event.payloadJson).retryExhausted))

    const addException = (
      kind: EventExceptionKind,
      opts?: { retryEligible?: boolean; failureCode?: string | null; failureReason?: string | null },
    ) => {
      pushCapped(exceptions, {
        eventId: event.id,
        sourceType: event.sourceDocumentType,
        sourceDocument: event.sourceDocumentId,
        workOrderId: event.productionOrderId,
        workOrderNumber: event.productionOrder?.orderNumber ?? null,
        eventType: event.eventType,
        status: event.status,
        reconciliationStatus: kind,
        failureCode: opts?.failureCode ?? failureCode,
        failureReason: opts?.failureReason ?? sanitized,
        retryEligible: opts?.retryEligible ?? false,
        createdAt: iso(event.createdAt),
        lastAttemptedAt: iso(lastAttemptedAt),
      })
      if (options?.includeTechnicalDetails) {
        pushCapped(technical, {
          eventId: event.id,
          postingEventId: event.postingEventId,
          voucherId: event.voucherId,
          idempotencyKey: event.idempotencyKey,
          attemptCount,
          postingErrorCode: posting?.errorCode ?? null,
          rawFailureReason: sanitized,
          inventoryMovementId:
            event.sourceDocumentType === INVENTORY_SOURCE_TYPE ? event.sourceDocumentId : null,
          exceptionKind: kind,
        })
      }
    }

    if (event.status === 'FAILED') {
      failedCount += 1
      if (retryExhausted) {
        retryExhaustedCount += 1
        addException('RETRY_EXHAUSTED', {
          retryEligible: false,
          failureCode: 'RETRY_EXHAUSTED',
          failureReason: sanitized ?? 'Retry attempts exhausted',
        })
      } else {
        addException('FAILED', {
          retryEligible: attemptCount < MAX_RETRY_ATTEMPTS,
          failureCode,
          failureReason: sanitized,
        })
      }
    }

    // Pending (unposted) events — SKIPPED_* are intentional and not unreconciled.
    if (event.status === 'RECORDED') {
      unreconciledCount += 1
      addException('UNRECONCILED', { retryEligible: true })
    }

    if (duplicateEventIds.has(event.id)) {
      addException('DUPLICATE_PENDING_POSTING', {
        retryEligible: false,
        failureCode: 'DUPLICATE_PENDING_POSTING',
        failureReason: 'Duplicate pending posting detected for the same source document',
      })
    }

    const expectsInventory =
      event.sourceDocumentType === INVENTORY_SOURCE_TYPE || INVENTORY_EVENT_TYPES.has(event.eventType)
    if (
      expectsInventory &&
      (event.status === 'POSTED' || event.status === 'RECORDED' || event.status === 'FAILED') &&
      event.sourceDocumentType === INVENTORY_SOURCE_TYPE &&
      !inventoryById.has(event.sourceDocumentId)
    ) {
      accountingMissingInventoryCount += 1
      addException('ACCOUNTING_MISSING_INVENTORY', {
        retryEligible: false,
        failureCode: 'ACCOUNTING_MISSING_INVENTORY',
        failureReason: 'Accounting event references a missing inventory stock movement',
      })
    }

    if (event.eventType === 'MANUFACTURING_REVERSAL') {
      const payload = asRecord(event.payloadJson)
      const originalId =
        (typeof payload.originalEventId === 'string' && payload.originalEventId) ||
        (typeof payload.reversedEventId === 'string' && payload.reversedEventId) ||
        null
      const original = originalId ? eventsById.get(originalId) : undefined
      const originalOk =
        original &&
        (original.status === 'POSTED' ||
          original.status === 'REVERSED' ||
          (event.status === 'POSTED' && original.status === 'REVERSED'))
      if (!originalId || !original || !originalOk) {
        reversalChainInconsistentCount += 1
        addException('REVERSAL_CHAIN_INCONSISTENT', {
          retryEligible: false,
          failureCode: 'REVERSAL_CHAIN_INCONSISTENT',
          failureReason: 'Manufacturing reversal chain is inconsistent with the original event',
        })
      }
    }

    if (event.status === 'REVERSED') {
      const hasReversal = events.some((candidate) => {
        if (candidate.eventType !== 'MANUFACTURING_REVERSAL') return false
        const payload = asRecord(candidate.payloadJson)
        return payload.originalEventId === event.id || payload.reversedEventId === event.id
      })
      if (!hasReversal) {
        reversalChainInconsistentCount += 1
        addException('REVERSAL_CHAIN_INCONSISTENT', {
          retryEligible: false,
          failureCode: 'REVERSAL_CHAIN_INCONSISTENT',
          failureReason: 'Event marked REVERSED without a matching MANUFACTURING_REVERSAL event',
        })
      }
    }
  }

  // Inventory-linked movements without any ProductionAccountingEvent trail.
  const movementWhere = {
    tenantId,
    referenceType: { in: [...INVENTORY_REFERENCE_TYPES] },
    workOrderId: options?.workOrderId ? options.workOrderId : { not: null },
  }
  const candidateMovements = await prisma.inventoryStockMovement.findMany({
    where: movementWhere,
    select: {
      id: true,
      movementNumber: true,
      referenceType: true,
      workOrderId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  })
  const linkedEventSourceIds = new Set(
    events
      .filter((e) => e.sourceDocumentType === INVENTORY_SOURCE_TYPE)
      .map((e) => e.sourceDocumentId),
  )
  // Also load any accounting rows for these movement IDs that may be on another LE / missed in take.
  const missingCandidates = candidateMovements.filter((m) => !linkedEventSourceIds.has(m.id))
  const existingForMissing = missingCandidates.length
    ? await prisma.productionAccountingEvent.findMany({
        where: {
          tenantId,
          sourceDocumentType: INVENTORY_SOURCE_TYPE,
          sourceDocumentId: { in: missingCandidates.map((m) => m.id) },
        },
        select: { sourceDocumentId: true },
      })
    : []
  const existingSourceSet = new Set(existingForMissing.map((e) => e.sourceDocumentId))

  const workOrderIds = [
    ...new Set(missingCandidates.map((m) => m.workOrderId).filter((id): id is string => Boolean(id))),
  ]
  const orders = workOrderIds.length
    ? await prisma.productionOrder.findMany({
        where: { tenantId, id: { in: workOrderIds } },
        select: { id: true, orderNumber: true },
      })
    : []
  const orderNumberById = new Map(orders.map((o) => [o.id, o.orderNumber]))

  let inventoryMissingAccountingCount = 0
  for (const movement of missingCandidates) {
    if (existingSourceSet.has(movement.id)) continue
    inventoryMissingAccountingCount += 1
    pushCapped(exceptions, {
      eventId: null,
      sourceType: INVENTORY_SOURCE_TYPE,
      sourceDocument: movement.id,
      workOrderId: movement.workOrderId,
      workOrderNumber: movement.workOrderId ? orderNumberById.get(movement.workOrderId) ?? null : null,
      eventType: null,
      status: null,
      reconciliationStatus: 'INVENTORY_MISSING_ACCOUNTING',
      failureCode: 'INVENTORY_MISSING_ACCOUNTING',
      failureReason: `Inventory ${movement.referenceType} ${movement.movementNumber} has no manufacturing accounting event`,
      retryEligible: false,
      createdAt: iso(movement.createdAt),
      lastAttemptedAt: null,
    })
    if (options?.includeTechnicalDetails) {
      pushCapped(technical, {
        eventId: null,
        postingEventId: null,
        voucherId: null,
        idempotencyKey: null,
        attemptCount: null,
        postingErrorCode: null,
        rawFailureReason: null,
        inventoryMovementId: movement.id,
        exceptionKind: 'INVENTORY_MISSING_ACCOUNTING',
      })
    }
  }

  const inventoryPostingsUnreconciledCount =
    unreconciledCount +
    inventoryMissingAccountingCount +
    accountingMissingInventoryCount +
    reversalChainInconsistentCount +
    duplicatePendingPostingCount

  const blockers: Array<'FAILED_ACCOUNTING_EVENTS' | 'INVENTORY_POSTINGS_UNRECONCILED'> = []
  if (failedCount > 0 || retryExhaustedCount > 0) blockers.push('FAILED_ACCOUNTING_EVENTS')
  if (inventoryPostingsUnreconciledCount > 0) blockers.push('INVENTORY_POSTINGS_UNRECONCILED')

  return {
    failedAccountingEventCount: failedCount,
    unreconciledAccountingEventCount: unreconciledCount,
    inventoryPostingsUnreconciledCount,
    retryExhaustedCount,
    inventoryMissingAccountingCount,
    accountingMissingInventoryCount,
    reversalChainInconsistentCount,
    duplicatePendingPostingCount,
    hasFailedBlocker: blockers.includes('FAILED_ACCOUNTING_EVENTS'),
    hasInventoryUnreconciledBlocker: blockers.includes('INVENTORY_POSTINGS_UNRECONCILED'),
    blockers,
    counts: {
      failed: failedCount,
      unreconciled: unreconciledCount,
      retryExhausted: retryExhaustedCount,
      inventoryMissingAccounting: inventoryMissingAccountingCount,
      accountingMissingInventory: accountingMissingInventoryCount,
      reversalChainInconsistent: reversalChainInconsistentCount,
      duplicatePendingPosting: duplicatePendingPostingCount,
      totalExceptions: exceptions.length,
    },
    exceptions,
    ...(options?.includeTechnicalDetails ? { technicalDetails: technical } : {}),
  }
}
