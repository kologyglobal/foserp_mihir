import { prisma } from '../../../config/database.js'
import { applyDateRangeFilter, percent, toNum } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

/**
 * "First-pass yield" here = acceptedQty / inspectedQty from QualityInspection.decidedAt in
 * range, aggregated per item. The schema does not track whether an accepted unit passed
 * without any prior rework loop, so this is a decision-based yield, not an audit-grade
 * strict first-pass metric — see registry.calculationNotes. availability = PARTIAL.
 */
export async function executeProductionQuality(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters, timezone } = ctx
  const f = filters as { productItemId?: string }

  const where: Record<string, unknown> = { tenantId, decidedAt: { not: null }, itemId: { not: null } }
  if (f.productItemId) where.itemId = f.productItemId
  applyDateRangeFilter(where, 'decidedAt', filters as { dateFrom?: string; dateTo?: string }, timezone)

  const inspections = await prisma.manufacturingQualityInspection.findMany({
    where: where as never,
    select: {
      itemId: true,
      inspectedQty: true,
      acceptedQty: true,
      reworkQty: true,
      rejectedQty: true,
      item: { select: { code: true, name: true } },
    },
    take: 20000,
  })

  type Agg = { itemCode: string; itemName: string; inspected: number; accepted: number; rework: number; rejected: number }
  const byItem = new Map<string, Agg>()
  for (const i of inspections) {
    if (!i.itemId || !i.item) continue
    let agg = byItem.get(i.itemId)
    if (!agg) {
      agg = { itemCode: i.item.code, itemName: i.item.name, inspected: 0, accepted: 0, rework: 0, rejected: 0 }
      byItem.set(i.itemId, agg)
    }
    agg.inspected += toNum(i.inspectedQty)
    agg.accepted += toNum(i.acceptedQty)
    agg.rework += toNum(i.reworkQty)
    agg.rejected += toNum(i.rejectedQty)
  }

  const rows: ReportRow[] = [...byItem.values()].map((a) => ({
    itemCode: a.itemCode,
    itemName: a.itemName,
    inspectedQty: a.inspected,
    acceptedQty: a.accepted,
    reworkQty: a.rework,
    rejectedQty: a.rejected,
    firstPassYieldPercent: percent(a.accepted, a.inspected),
  }))

  return {
    rows,
    summary: {
      itemCount: rows.length,
      overallFirstPassYieldPercent: percent(
        rows.reduce((s, r) => s + Number(r.acceptedQty), 0),
        rows.reduce((s, r) => s + Number(r.inspectedQty), 0),
      ),
    },
    warnings: [
      'First-pass yield is decision-based (acceptedQty ÷ inspectedQty at decision time). It cannot exclude units that went through a rework loop before being accepted, so treat it as directional rather than an audit-grade metric.',
    ],
  }
}
