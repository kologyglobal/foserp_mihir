/**
 * Phase 7C5 — Dispatch reconciliation (report-only; no auto-fix).
 */
import { prisma } from '../../../config/database.js'
import { n, roundQty } from '../shared/dispatch-qty.js'

export type ReconciliationExceptionCode =
  | 'MISSING_INVENTORY_MOVEMENT'
  | 'DUPLICATE_INVENTORY_MOVEMENT'
  | 'RESERVATION_MISMATCH'
  | 'PICK_MISMATCH'
  | 'PACK_MISMATCH'
  | 'CHALLAN_MISMATCH'
  | 'SO_FULFILMENT_MISMATCH'
  | 'SERIAL_DUPLICATE'
  | 'REVERSAL_MISMATCH'
  | 'ORPHAN_POSTING'

export type ReconciliationException = {
  code: ReconciliationExceptionCode
  outboundDispatchId: string
  dispatchNo: string
  message: string
  expected?: number
  actual?: number
}

export async function reconcileTenantDispatches(
  tenantId: string,
  options?: { salesOrderId?: string; limit?: number },
): Promise<{
  scanned: number
  exceptions: ReconciliationException[]
  summary: Record<ReconciliationExceptionCode, number>
}> {
  const limit = options?.limit ?? 200
  const dispatches = await prisma.outboundDispatch.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: ['CONFIRMED', 'REVERSED'] },
      ...(options?.salesOrderId ? { salesOrderId: options.salesOrderId } : {}),
    },
    include: { lines: true },
    take: limit,
    orderBy: { updatedAt: 'desc' },
  })

  const exceptions: ReconciliationException[] = []

  for (const d of dispatches) {
    const postedQty = roundQty(d.lines.reduce((s, l) => s + n(l.quantity), 0))

    const posting = await prisma.dispatchPosting.findFirst({
      where: { tenantId, outboundDispatchId: d.id },
      include: { lines: true, reversals: { where: { status: 'APPLIED' }, include: { lines: true } } },
    })
    if (!posting) {
      exceptions.push({
        code: 'ORPHAN_POSTING',
        outboundDispatchId: d.id,
        dispatchNo: d.dispatchNo,
        message: 'Confirmed/reversed outbound missing DispatchPosting ledger row',
      })
    } else {
      const postingQty = roundQty(posting.lines.reduce((s, l) => s + n(l.quantity), 0))
      if (postingQty !== postedQty) {
        exceptions.push({
          code: 'ORPHAN_POSTING',
          outboundDispatchId: d.id,
          dispatchNo: d.dispatchNo,
          message: 'DispatchPosting line qty ≠ outbound line qty',
          expected: postedQty,
          actual: postingQty,
        })
      }
      for (const pl of posting.lines) {
        if (d.status === 'CONFIRMED' && !pl.inventoryMovementId) {
          exceptions.push({
            code: 'MISSING_INVENTORY_MOVEMENT',
            outboundDispatchId: d.id,
            dispatchNo: d.dispatchNo,
            message: `Posting line ${pl.lineNo} missing inventoryMovementId`,
          })
        }
      }
      if (d.status === 'REVERSED') {
        const applied = posting.reversals.filter((r) => r.status === 'APPLIED')
        if (!applied.length && posting.status !== 'LEGACY_POSTED' && posting.mode !== 'legacy') {
          exceptions.push({
            code: 'REVERSAL_MISMATCH',
            outboundDispatchId: d.id,
            dispatchNo: d.dispatchNo,
            message: 'Reversed outbound missing APPLIED DispatchReversal',
          })
        }
      }
    }

    for (const line of d.lines) {
      if (d.status === 'CONFIRMED' && !line.inventoryMovementId) {
        exceptions.push({
          code: 'MISSING_INVENTORY_MOVEMENT',
          outboundDispatchId: d.id,
          dispatchNo: d.dispatchNo,
          message: `Confirmed line ${line.lineNo} missing inventoryMovementId`,
        })
      }
      if (d.status === 'REVERSED') {
        if (!line.inventoryMovementId) {
          exceptions.push({
            code: 'REVERSAL_MISMATCH',
            outboundDispatchId: d.id,
            dispatchNo: d.dispatchNo,
            message: `Reversed line ${line.lineNo} missing original inventoryMovementId`,
          })
        }
        if (!line.reverseInventoryMovementId) {
          exceptions.push({
            code: 'REVERSAL_MISMATCH',
            outboundDispatchId: d.id,
            dispatchNo: d.dispatchNo,
            message: `Reversed line ${line.lineNo} missing reverseInventoryMovementId`,
          })
        }
      }
    }

    const movementIds = d.lines.map((l) => l.inventoryMovementId).filter(Boolean) as string[]
    if (movementIds.length) {
      const movements = await prisma.inventoryStockMovement.findMany({
        where: { tenantId, id: { in: movementIds }, referenceType: 'FG_DISPATCH' },
      })
      if (movements.length !== movementIds.length && d.status === 'CONFIRMED') {
        exceptions.push({
          code: 'MISSING_INVENTORY_MOVEMENT',
          outboundDispatchId: d.id,
          dispatchNo: d.dispatchNo,
          message: `Expected ${movementIds.length} FG_DISPATCH movements, found ${movements.length}`,
          expected: movementIds.length,
          actual: movements.length,
        })
      }
      const uniq = new Set(movementIds)
      if (uniq.size !== movementIds.length) {
        exceptions.push({
          code: 'DUPLICATE_INVENTORY_MOVEMENT',
          outboundDispatchId: d.id,
          dispatchNo: d.dispatchNo,
          message: 'Duplicate inventoryMovementId on outbound lines',
        })
      }
    }

    const challans = await prisma.deliveryChallan.findMany({
      where: {
        tenantId,
        outboundDispatchId: d.id,
        deletedAt: null,
        status: 'ISSUED',
      },
    })
    if (challans.length === 1) {
      const cq = n(challans[0]!.totalQuantity)
      if (roundQty(cq) !== postedQty) {
        exceptions.push({
          code: 'CHALLAN_MISMATCH',
          outboundDispatchId: d.id,
          dispatchNo: d.dispatchNo,
          message: 'Issued Challan quantity ≠ outbound quantity',
          expected: postedQty,
          actual: roundQty(cq),
        })
      }
    }
  }

  const summary = {
    MISSING_INVENTORY_MOVEMENT: 0,
    DUPLICATE_INVENTORY_MOVEMENT: 0,
    RESERVATION_MISMATCH: 0,
    PICK_MISMATCH: 0,
    PACK_MISMATCH: 0,
    CHALLAN_MISMATCH: 0,
    SO_FULFILMENT_MISMATCH: 0,
    SERIAL_DUPLICATE: 0,
    REVERSAL_MISMATCH: 0,
    ORPHAN_POSTING: 0,
  } as Record<ReconciliationExceptionCode, number>
  for (const e of exceptions) summary[e.code] += 1

  return { scanned: dispatches.length, exceptions, summary }
}

export const DispatchReconciliationService = {
  reconcileTenantDispatches,
}

export function reconciliationToCsv(exceptions: ReconciliationException[]): string {
  const header = 'code,outboundDispatchId,dispatchNo,message,expected,actual'
  const rows = exceptions.map((e) =>
    [e.code, e.outboundDispatchId, e.dispatchNo, JSON.stringify(e.message), e.expected ?? '', e.actual ?? ''].join(
      ',',
    ),
  )
  return [header, ...rows].join('\n')
}
