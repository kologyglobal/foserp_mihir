import { prisma } from '../../../config/database.js'
import { toNum } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

const INCLUDED_PLAN_STATUSES = ['PLANNED', 'WORK_ORDERS_CREATED', 'CLOSED']

export async function executePlanVsActual(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters } = ctx
  const f = filters as { productItemId?: string }

  const where: Record<string, unknown> = {
    tenantId,
    deletedAt: null,
    plan: { status: { in: INCLUDED_PLAN_STATUSES }, tenantId },
  }
  if (f.productItemId) where.productItemId = f.productItemId

  const lines = await prisma.productionPlanLine.findMany({
    where: where as never,
    select: {
      id: true,
      demandQuantity: true,
      suggestedQuantity: true,
      requiredDate: true,
      productionOrderId: true,
      plan: { select: { planNumber: true, planName: true, status: true } },
      productItem: { select: { code: true, name: true } },
    },
    orderBy: { requiredDate: 'asc' },
    take: 3000,
  })

  const orderIds = [...new Set(lines.map((l) => l.productionOrderId).filter((v): v is string => Boolean(v)))]
  const orders = orderIds.length
    ? await prisma.productionOrder.findMany({
        where: { tenantId, id: { in: orderIds } },
        select: { id: true, completedGoodQuantity: true },
      })
    : []
  const completedByOrder = new Map(orders.map((o) => [o.id, toNum(o.completedGoodQuantity)]))

  const warnings: string[] = []
  const unlinkedCount = lines.filter((l) => !l.productionOrderId).length
  if (unlinkedCount > 0) {
    warnings.push(`${unlinkedCount} plan line(s) have no linked work order — actualCompletedQuantity shown as 0.`)
  }

  const rows: ReportRow[] = lines.map((l) => {
    const demand = toNum(l.demandQuantity)
    const actual = l.productionOrderId ? completedByOrder.get(l.productionOrderId) ?? 0 : 0
    return {
      planNumber: l.plan.planNumber,
      planName: l.plan.planName,
      planStatus: l.plan.status,
      productItemCode: l.productItem.code,
      productItemName: l.productItem.name,
      demandQuantity: demand,
      suggestedQuantity: toNum(l.suggestedQuantity),
      actualCompletedQuantity: actual,
      variance: Math.round((actual - demand) * 10000) / 10000,
      requiredDate: l.requiredDate?.toISOString() ?? null,
      workOrderLinked: Boolean(l.productionOrderId),
    }
  })

  return {
    rows,
    summary: {
      lineCount: rows.length,
      totalDemand: rows.reduce((s, r) => s + Number(r.demandQuantity), 0),
      totalActual: rows.reduce((s, r) => s + Number(r.actualCompletedQuantity), 0),
    },
    warnings,
  }
}
