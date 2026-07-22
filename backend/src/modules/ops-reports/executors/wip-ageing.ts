import { prisma } from '../../../config/database.js'
import { ageDaysToBucket, ageInDays, buildAgeBucketChart, toNum } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

export async function executeWipAgeing(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters } = ctx
  const f = filters as { workCentreId?: string }

  const where: Record<string, unknown> = { tenantId, status: { in: ['IN_PROGRESS', 'ON_HOLD'] } }
  if (f.workCentreId) where.workCentreId = f.workCentreId

  const stages = await prisma.productionOrderStage.findMany({
    where: where as never,
    select: {
      id: true,
      name: true,
      startedAt: true,
      updatedAt: true,
      goodQuantity: true,
      workCentre: { select: { name: true } },
      productionOrder: { select: { orderNumber: true } },
    },
    take: 5000,
  })

  const now = new Date()
  let fallbackCount = 0
  const rows: ReportRow[] = stages.map((s) => {
    const ageSourceDate = s.startedAt ?? s.updatedAt
    if (!s.startedAt) fallbackCount++
    const ageDays = ageInDays(ageSourceDate, now)
    return {
      orderNumber: s.productionOrder.orderNumber,
      stageName: s.name,
      workCentre: s.workCentre?.name ?? null,
      ageDays,
      ageBucket: ageDaysToBucket(ageDays),
      goodQuantity: toNum(s.goodQuantity),
      ageSource: s.startedAt ? 'startedAt' : 'updatedAt (fallback)',
    }
  })

  const warnings: string[] = []
  if (fallbackCount > 0) warnings.push(`${fallbackCount} stage(s) had no startedAt — aged from updatedAt instead.`)

  return {
    rows,
    chartData: [buildAgeBucketChart(rows as Array<{ ageBucket: string }>)],
    summary: { stageCount: rows.length },
    warnings,
  }
}
