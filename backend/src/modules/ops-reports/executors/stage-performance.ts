import { prisma } from '../../../config/database.js'
import { applyDateRangeFilter, round2, toNum } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

export async function executeStagePerformance(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters, timezone } = ctx
  const f = filters as { workCentreId?: string }

  const where: Record<string, unknown> = { tenantId, status: 'COMPLETED', completedAt: { not: null } }
  if (f.workCentreId) where.workCentreId = f.workCentreId
  applyDateRangeFilter(where, 'completedAt', filters as { dateFrom?: string; dateTo?: string }, timezone)

  const stages = await prisma.productionOrderStage.findMany({
    where: where as never,
    select: {
      code: true,
      name: true,
      startedAt: true,
      completedAt: true,
      goodQuantity: true,
      reworkQuantity: true,
      rejectedQuantity: true,
      scrapQuantity: true,
      workCentre: { select: { code: true, name: true } },
    },
    take: 5000,
  })

  type Agg = {
    stageCode: string
    stageName: string
    workCentre: string
    completedCount: number
    cycleMinutesTotal: number
    cycleSamples: number
    goodQuantity: number
    reworkQuantity: number
    rejectedQuantity: number
    scrapQuantity: number
  }
  const groups = new Map<string, Agg>()
  for (const s of stages) {
    const wc = s.workCentre?.name ?? 'UNASSIGNED'
    const key = `${s.code}::${wc}`
    let g = groups.get(key)
    if (!g) {
      g = {
        stageCode: s.code,
        stageName: s.name,
        workCentre: wc,
        completedCount: 0,
        cycleMinutesTotal: 0,
        cycleSamples: 0,
        goodQuantity: 0,
        reworkQuantity: 0,
        rejectedQuantity: 0,
        scrapQuantity: 0,
      }
      groups.set(key, g)
    }
    g.completedCount += 1
    g.goodQuantity += toNum(s.goodQuantity)
    g.reworkQuantity += toNum(s.reworkQuantity)
    g.rejectedQuantity += toNum(s.rejectedQuantity)
    g.scrapQuantity += toNum(s.scrapQuantity)
    if (s.startedAt && s.completedAt) {
      g.cycleMinutesTotal += (s.completedAt.getTime() - s.startedAt.getTime()) / 60000
      g.cycleSamples += 1
    }
  }

  const rows: ReportRow[] = [...groups.values()]
    .sort((a, b) => b.completedCount - a.completedCount)
    .map((g) => ({
      stageCode: g.stageCode,
      stageName: g.stageName,
      workCentre: g.workCentre,
      completedCount: g.completedCount,
      avgCycleTimeMinutes: g.cycleSamples ? round2(g.cycleMinutesTotal / g.cycleSamples) : null,
      goodQuantity: round2(g.goodQuantity),
      reworkQuantity: round2(g.reworkQuantity),
      rejectedQuantity: round2(g.rejectedQuantity),
      scrapQuantity: round2(g.scrapQuantity),
    }))

  return {
    rows,
    summary: { stageGroupCount: rows.length, totalCompletedStages: stages.length },
    warnings: stages.length >= 5000 ? ['Result set capped at 5000 completed stages — narrow filters for a complete view.'] : [],
  }
}
