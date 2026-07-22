import { prisma } from '../../../config/database.js'
import { getMaterialReconciliation } from '../../manufacturing/materials/material-reconciliation.service.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

const OPEN_STATUSES = ['READY', 'IN_PROGRESS', 'ON_HOLD']
const RECONCILIATION_BOUND = 200

/** Reuses the Phase 7A material-position/material-reconciliation engine, per work order. */
export async function executeMaterialReconciliation(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters } = ctx
  const f = filters as { workOrderId?: string }

  const where: Record<string, unknown> = { tenantId, deletedAt: null, status: { in: OPEN_STATUSES } }
  if (f.workOrderId) where.id = f.workOrderId

  const orders = await prisma.productionOrder.findMany({
    where: where as never,
    select: { id: true, orderNumber: true },
    orderBy: { updatedAt: 'desc' },
    take: RECONCILIATION_BOUND,
  })

  const rows: ReportRow[] = []
  const warnings: string[] = []
  for (const o of orders) {
    try {
      const recon = await getMaterialReconciliation(tenantId, o.id)
      rows.push({
        orderId: o.id,
        orderNumber: o.orderNumber,
        status: recon.status,
        canClose: recon.canClose,
        differenceCount: recon.differences.length,
        blockerCount: recon.blockers.length,
        heldLineCount: recon.summary.heldLineCount ?? 0,
      })
    } catch {
      // Work order has no material lines / profile not resolvable — skip, don't fail the whole report.
    }
  }
  if (orders.length >= RECONCILIATION_BOUND) {
    warnings.push(`Bounded to the ${RECONCILIATION_BOUND} most recently updated open/on-hold work orders — narrow filters (e.g. workOrderId) for others.`)
  }

  return {
    rows,
    summary: {
      workOrderCount: rows.length,
      balancedCount: rows.filter((r) => r.status === 'BALANCED').length,
      blockedCount: rows.filter((r) => r.status === 'BLOCKED').length,
      differenceCount: rows.filter((r) => r.status === 'DIFFERENCE').length,
    },
    warnings,
  }
}
