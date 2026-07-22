import { prisma } from '../../../config/database.js'
import { resolveFilterDateRangeUtc } from '../timezone.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'
import { toNum } from './helpers.js'

export async function executeShiftDashboard(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters, timezone } = ctx
  const f = filters as { dateFrom?: string; dateTo?: string; shift?: string; workCentreId?: string; supervisorId?: string }
  const range = resolveFilterDateRangeUtc(f, timezone, 1)

  const where: Record<string, unknown> = { tenantId, productionDate: { gte: range.start, lt: range.end } }
  if (f.workCentreId) where.workCentreId = f.workCentreId
  if (f.supervisorId) where.supervisorId = f.supervisorId
  if (f.shift) where.shiftCode = f.shift

  const batches = await prisma.dailyProductionBatch.findMany({
    where: where as never,
    select: {
      id: true,
      batchNumber: true,
      productionDate: true,
      shiftCode: true,
      shiftLabel: true,
      status: true,
      supervisorId: true,
      workCentre: { select: { name: true } },
      lines: {
        select: { goodQuantity: true, reworkQuantity: true, rejectedQuantity: true, scrapQuantity: true },
      },
    },
    orderBy: { productionDate: 'desc' },
    take: 2000,
  })

  const rows: ReportRow[] = batches.map((b) => {
    let good = 0
    let rework = 0
    let rejected = 0
    let scrap = 0
    for (const l of b.lines) {
      good += toNum(l.goodQuantity)
      rework += toNum(l.reworkQuantity)
      rejected += toNum(l.rejectedQuantity)
      scrap += toNum(l.scrapQuantity)
    }
    return {
      batchId: b.id,
      batchNumber: b.batchNumber,
      productionDate: b.productionDate.toISOString().slice(0, 10),
      shiftCode: b.shiftCode ?? 'UNASSIGNED',
      shiftLabel: b.shiftLabel,
      workCentre: b.workCentre?.name ?? null,
      status: b.status,
      lineCount: b.lines.length,
      goodQuantity: good,
      reworkQuantity: rework,
      rejectedQuantity: rejected,
      scrapQuantity: scrap,
    }
  })

  const warnings: string[] = []
  if (!f.shift) {
    warnings.push('Shift is recorded at DailyProductionBatch level (not per line); batches without a shift code are shown as UNASSIGNED.')
  }
  if (range.usedDefault) warnings.push('No date filter supplied — showing today only (tenant timezone).')

  return {
    rows,
    summary: {
      batchCount: batches.length,
      totalGoodQuantity: rows.reduce((s, r) => s + Number(r.goodQuantity), 0),
      totalRejectedQuantity: rows.reduce((s, r) => s + Number(r.rejectedQuantity), 0),
    },
    warnings,
  }
}
