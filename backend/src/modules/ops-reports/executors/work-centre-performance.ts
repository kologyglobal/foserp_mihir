import { prisma } from '../../../config/database.js'
import { applyDateRangeFilter, round2, toNum } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

/** No OEE / availability / performance-factor calculations — throughput + downtime only. */
export async function executeWorkCentrePerformance(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters, timezone } = ctx
  const f = filters as { workCentreId?: string }

  const wcWhere: Record<string, unknown> = { tenantId, deletedAt: null }
  if (f.workCentreId) wcWhere.id = f.workCentreId
  const workCentres = await prisma.manufacturingWorkCentre.findMany({
    where: wcWhere as never,
    select: { id: true, code: true, name: true },
    take: 500,
  })

  const lineWhere: Record<string, unknown> = { tenantId, workCentreId: { not: null } }
  applyDateRangeFilter(lineWhere, 'createdAt', filters as { dateFrom?: string; dateTo?: string }, timezone)
  if (f.workCentreId) lineWhere.workCentreId = f.workCentreId
  const lines = await prisma.dailyProductionLine.findMany({
    where: lineWhere as never,
    select: { workCentreId: true, goodQuantity: true, reworkQuantity: true, rejectedQuantity: true },
    take: 20000,
  })

  const downWhere: Record<string, unknown> = { tenantId, workCentreId: { not: null } }
  applyDateRangeFilter(downWhere, 'startedAt', filters as { dateFrom?: string; dateTo?: string }, timezone)
  if (f.workCentreId) downWhere.workCentreId = f.workCentreId
  const downtimes = await prisma.productionDowntime.findMany({
    where: downWhere as never,
    select: { workCentreId: true, durationMinutes: true },
    take: 20000,
  })

  const activeStagesWhere: Record<string, unknown> = { tenantId, status: 'IN_PROGRESS', workCentreId: { not: null } }
  if (f.workCentreId) activeStagesWhere.workCentreId = f.workCentreId
  const activeStageCounts = await prisma.productionOrderStage.groupBy({
    by: ['workCentreId'],
    where: activeStagesWhere as never,
    _count: { _all: true },
  })

  const byWc = new Map<string, { good: number; rework: number; rejected: number; downMin: number; downEvents: number; active: number }>()
  for (const wc of workCentres) byWc.set(wc.id, { good: 0, rework: 0, rejected: 0, downMin: 0, downEvents: 0, active: 0 })
  for (const l of lines) {
    if (!l.workCentreId) continue
    const acc = byWc.get(l.workCentreId)
    if (!acc) continue
    acc.good += toNum(l.goodQuantity)
    acc.rework += toNum(l.reworkQuantity)
    acc.rejected += toNum(l.rejectedQuantity)
  }
  for (const d of downtimes) {
    if (!d.workCentreId) continue
    const acc = byWc.get(d.workCentreId)
    if (!acc) continue
    acc.downMin += d.durationMinutes ?? 0
    acc.downEvents += 1
  }
  for (const g of activeStageCounts) {
    if (!g.workCentreId) continue
    const acc = byWc.get(g.workCentreId)
    if (acc) acc.active = g._count._all
  }

  const rows: ReportRow[] = workCentres.map((wc) => {
    const acc = byWc.get(wc.id)!
    return {
      workCentreId: wc.id,
      workCentreCode: wc.code,
      workCentreName: wc.name,
      activeStages: acc.active,
      goodQuantity: round2(acc.good),
      reworkQuantity: round2(acc.rework),
      rejectedQuantity: round2(acc.rejected),
      downtimeMinutes: acc.downMin,
      downtimeEvents: acc.downEvents,
    }
  })

  return {
    rows,
    summary: { workCentreCount: rows.length },
    warnings: [],
  }
}
