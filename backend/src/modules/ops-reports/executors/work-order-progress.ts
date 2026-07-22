import { prisma } from '../../../config/database.js'
import { applyDateRangeFilter, toNum } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

export async function executeWorkOrderProgress(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters, timezone } = ctx
  const f = filters as {
    status?: string | string[]
    productItemId?: string
    workOrderId?: string
    workCentreId?: string
    plantCode?: string
    search?: string
  }
  const where: Record<string, unknown> = { tenantId, deletedAt: null }
  if (f.status) where.status = Array.isArray(f.status) ? { in: f.status } : f.status
  if (f.productItemId) where.productItemId = f.productItemId
  if (f.workOrderId) where.id = f.workOrderId
  if (f.plantCode) where.plantCode = f.plantCode
  if (f.search) where.orderNumber = { contains: f.search }
  if (f.workCentreId) {
    where.stages = { some: { workCentreId: f.workCentreId } }
  }
  applyDateRangeFilter(where, 'requiredCompletionDate', filters as { dateFrom?: string; dateTo?: string }, timezone)

  const orders = await prisma.productionOrder.findMany({
    where: where as never,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      healthStatus: true,
      productItem: { select: { code: true, name: true } },
      plannedQuantity: true,
      completedGoodQuantity: true,
      reworkQuantity: true,
      rejectedQuantity: true,
      scrapQuantity: true,
      completionPercent: true,
      requiredCompletionDate: true,
      stages: { select: { status: true } },
    },
    orderBy: { requiredCompletionDate: 'asc' },
    take: 3000,
  })

  const rows: ReportRow[] = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    productItemCode: o.productItem.code,
    productItemName: o.productItem.name,
    status: o.status,
    healthStatus: o.healthStatus,
    plannedQuantity: toNum(o.plannedQuantity),
    completedGoodQuantity: toNum(o.completedGoodQuantity),
    reworkQuantity: toNum(o.reworkQuantity),
    rejectedQuantity: toNum(o.rejectedQuantity),
    scrapQuantity: toNum(o.scrapQuantity),
    completionPercent: toNum(o.completionPercent),
    stagesTotal: o.stages.length,
    stagesCompleted: o.stages.filter((s) => s.status === 'COMPLETED').length,
    requiredCompletionDate: o.requiredCompletionDate.toISOString(),
  }))

  return {
    rows,
    summary: {
      totalOrders: rows.length,
      avgCompletionPercent:
        rows.length === 0 ? 0 : Math.round((rows.reduce((s, r) => s + Number(r.completionPercent), 0) / rows.length) * 100) / 100,
    },
    warnings: orders.length >= 3000 ? ['Result set capped at 3000 work orders — narrow filters for a complete view.'] : [],
  }
}
