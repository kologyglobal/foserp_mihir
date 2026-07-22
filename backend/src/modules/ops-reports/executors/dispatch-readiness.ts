import { prisma } from '../../../config/database.js'
import { getSalesOrderFulfilmentPositions } from '../../dispatch/fulfilment/sales-order-fulfilment-position.service.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

const OPEN_SO_STATUSES = ['open', 'confirmed', 'in_production', 'ready_dispatch', 'dispatched']
const BOUND = 300

export async function executeDispatchReadiness(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters } = ctx
  const f = filters as { customerId?: string; salesOrderId?: string }

  const where: Record<string, unknown> = { tenantId, deletedAt: null, status: { in: OPEN_SO_STATUSES } }
  if (f.customerId) where.companyId = f.customerId
  if (f.salesOrderId) where.id = f.salesOrderId

  const orders = await prisma.crmSalesOrder.findMany({
    where: where as never,
    select: { id: true, salesOrderNo: true, company: { select: { name: true } } },
    orderBy: { orderDate: 'desc' },
    take: BOUND,
  })

  const rows: ReportRow[] = []
  const warnings: string[] = []
  for (const so of orders) {
    try {
      const positions = await getSalesOrderFulfilmentPositions(tenantId, so.id)
      for (const line of positions) {
        if (line.remainingToDispatchQty <= 0) continue
        rows.push({
          salesOrderId: so.id,
          salesOrderNo: so.salesOrderNo,
          customer: so.company?.name ?? null,
          lineNo: line.lineNo,
          salesOrderLineId: line.salesOrderLineId,
          itemId: line.itemId,
          itemCode: line.itemCode,
          orderedQty: line.orderedQty,
          dispatchedQty: line.netDispatchedQty,
          cancelledQty: line.cancelledQty,
          remainingQty: line.remainingToDispatchQty,
          unrestrictedFgOnHand: line.unrestrictedFgOnHand,
          qualityHoldQty: line.qualityHoldQty,
          readyQty: line.readyQty,
          shortageQty: line.shortageQty,
          readinessStatus: line.readinessStatus,
          primaryBlockerCode: line.primaryBlockerCode,
          readyToDispatch:
            line.readinessStatus === 'READY_TO_DISPATCH' || line.readinessStatus === 'PARTIALLY_READY',
        })
      }
    } catch (err) {
      warnings.push(
        `Could not compute readiness for ${so.salesOrderNo}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  return {
    rows,
    summary: {
      salesOrderCount: orders.length,
      openLineCount: rows.length,
      totalRemainingQty: rows.reduce((s, r) => s + Number(r.remainingQty), 0),
      totalReadyQty: rows.reduce((s, r) => s + Number(r.readyQty ?? 0), 0),
      readyLineCount: rows.filter((r) => r.readyToDispatch).length,
    },
    warnings: [
      'Phase 7C1: readyToDispatch uses FG free qty via manufactured-product→item resolution and warehouse quality-hold mapping (not a balance qualityHold bucket). Lot/serial and reservation consumption are out of scope.',
      ...warnings,
      ...(orders.length >= BOUND
        ? [`Bounded to the ${BOUND} most recent open sales orders — narrow filters (e.g. salesOrderId) for others.`]
        : []),
    ],
  }
}
