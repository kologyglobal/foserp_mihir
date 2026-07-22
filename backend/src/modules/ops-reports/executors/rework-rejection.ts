import { prisma } from '../../../config/database.js'
import { applyDateRangeFilter, percent, round2, toNum } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

export async function executeReworkRejection(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters, timezone } = ctx
  const f = filters as { productItemId?: string; workCentreId?: string }

  const where: Record<string, unknown> = { tenantId }
  if (f.workCentreId) where.workCentreId = f.workCentreId
  if (f.productItemId) where.productionOrder = { productItemId: f.productItemId }
  applyDateRangeFilter(where, 'updatedAt', filters as { dateFrom?: string; dateTo?: string }, timezone)

  const stages = await prisma.productionOrderStage.findMany({
    where: where as never,
    select: {
      name: true,
      goodQuantity: true,
      reworkQuantity: true,
      rejectedQuantity: true,
      scrapQuantity: true,
      productionOrder: { select: { productItem: { select: { code: true } } } },
    },
    take: 10000,
  })

  type Agg = { itemCode: string; stageName: string; good: number; rework: number; rejected: number; scrap: number }
  const groups = new Map<string, Agg>()
  for (const s of stages) {
    const itemCode = s.productionOrder.productItem.code
    const key = `${itemCode}::${s.name}`
    let g = groups.get(key)
    if (!g) {
      g = { itemCode, stageName: s.name, good: 0, rework: 0, rejected: 0, scrap: 0 }
      groups.set(key, g)
    }
    g.good += toNum(s.goodQuantity)
    g.rework += toNum(s.reworkQuantity)
    g.rejected += toNum(s.rejectedQuantity)
    g.scrap += toNum(s.scrapQuantity)
  }

  const rows: ReportRow[] = [...groups.values()].map((g) => {
    const total = g.good + g.rework + g.rejected + g.scrap
    return {
      itemCode: g.itemCode,
      stageName: g.stageName,
      goodQuantity: round2(g.good),
      reworkQuantity: round2(g.rework),
      rejectedQuantity: round2(g.rejected),
      scrapQuantity: round2(g.scrap),
      reworkRatePercent: percent(g.rework, total),
      rejectionRatePercent: percent(g.rejected, total),
    }
  })

  return {
    rows,
    summary: { groupCount: rows.length },
    warnings: [],
  }
}
