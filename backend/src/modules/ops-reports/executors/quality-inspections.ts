import { prisma } from '../../../config/database.js'
import { applyDateRangeFilter, toNum } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

export async function executeQualityInspections(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters, timezone } = ctx
  const f = filters as { qualityStatus?: string; productItemId?: string; workOrderId?: string }

  const where: Record<string, unknown> = { tenantId }
  if (f.qualityStatus) where.status = f.qualityStatus
  if (f.productItemId) where.itemId = f.productItemId
  if (f.workOrderId) where.productionOrderId = f.workOrderId
  applyDateRangeFilter(where, 'requestedAt', filters as { dateFrom?: string; dateTo?: string }, timezone)

  const inspections = await prisma.manufacturingQualityInspection.findMany({
    where: where as never,
    select: {
      id: true,
      inspectionNumber: true,
      category: true,
      status: true,
      decision: true,
      inspectedQty: true,
      acceptedQty: true,
      rejectedQty: true,
      reworkQty: true,
      requestedAt: true,
      decidedAt: true,
      item: { select: { code: true } },
      productionOrder: { select: { orderNumber: true } },
    },
    orderBy: { requestedAt: 'desc' },
    take: 5000,
  })

  const rows: ReportRow[] = inspections.map((i) => ({
    id: i.id,
    inspectionNumber: i.inspectionNumber,
    category: i.category,
    status: i.status,
    decision: i.decision,
    itemCode: i.item?.code ?? null,
    orderNumber: i.productionOrder?.orderNumber ?? null,
    inspectedQty: toNum(i.inspectedQty),
    acceptedQty: toNum(i.acceptedQty),
    rejectedQty: toNum(i.rejectedQty),
    reworkQty: toNum(i.reworkQty),
    requestedAt: i.requestedAt.toISOString(),
    decidedAt: i.decidedAt?.toISOString() ?? null,
  }))

  return {
    rows,
    summary: {
      totalInspections: rows.length,
      pendingInspections: rows.filter((r) => r.status === 'PENDING' || r.status === 'READY' || r.status === 'IN_PROGRESS').length,
    },
    warnings: [],
  }
}
