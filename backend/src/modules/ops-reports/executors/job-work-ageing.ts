import { prisma } from '../../../config/database.js'
import { ageDaysToBucket, ageInDays, buildAgeBucketChart, toNum } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

const OPEN_STATUSES = ['DRAFT', 'MATERIAL_SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'RECONCILIATION_PENDING']

export async function executeJobWorkAgeing(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters } = ctx
  const f = filters as { vendorId?: string }

  const where: Record<string, unknown> = { tenantId, deletedAt: null, status: { in: OPEN_STATUSES } }
  if (f.vendorId) where.vendorId = f.vendorId

  const jobWorks = await prisma.jobWorkOrder.findMany({
    where: where as never,
    select: {
      jwNumber: true,
      status: true,
      sentQty: true,
      receivedQty: true,
      materialSentAt: true,
      createdAt: true,
      vendor: { select: { name: true } },
    },
    take: 3000,
  })

  const now = new Date()
  const rows: ReportRow[] = jobWorks.map((j) => {
    const ageSource = j.materialSentAt ?? j.createdAt
    const ageDays = ageInDays(ageSource, now)
    return {
      jwNumber: j.jwNumber,
      vendor: j.vendor.name,
      status: j.status,
      ageDays,
      ageBucket: ageDaysToBucket(ageDays),
      sentQty: toNum(j.sentQty),
      receivedQty: toNum(j.receivedQty),
    }
  })

  return {
    rows,
    chartData: [buildAgeBucketChart(rows as Array<{ ageBucket: string }>)],
    summary: { jobWorkCount: rows.length },
    warnings: [],
  }
}
