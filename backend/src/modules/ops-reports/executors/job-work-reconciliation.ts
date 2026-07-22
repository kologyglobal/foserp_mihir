import { prisma } from '../../../config/database.js'
import { normalizeStatusFilterList, toNum } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

export async function executeJobWorkReconciliation(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters } = ctx
  const f = filters as { vendorId?: string; status?: string | string[] }

  const where: Record<string, unknown> = { tenantId, deletedAt: null }
  if (f.vendorId) where.vendorId = f.vendorId
  const statuses = normalizeStatusFilterList(f.status)
  if (statuses) where.status = { in: statuses }

  const jobWorks = await prisma.jobWorkOrder.findMany({
    where: where as never,
    select: {
      jwNumber: true,
      status: true,
      sentQty: true,
      receivedQty: true,
      acceptedQty: true,
      rejectedQty: true,
      reworkQty: true,
      differenceApproved: true,
      vendor: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 3000,
  })

  const rows: ReportRow[] = jobWorks.map((j) => {
    const sent = toNum(j.sentQty)
    const received = toNum(j.receivedQty)
    return {
      jwNumber: j.jwNumber,
      vendor: j.vendor.name,
      status: j.status,
      sentQty: sent,
      receivedQty: received,
      acceptedQty: toNum(j.acceptedQty),
      rejectedQty: toNum(j.rejectedQty),
      reworkQty: toNum(j.reworkQty),
      outstandingQty: Math.max(0, sent - received),
      differenceApproved: j.differenceApproved,
    }
  })

  return {
    rows,
    summary: {
      jobWorkCount: rows.length,
      pendingReconciliation: rows.filter((r) => r.status === 'RECONCILIATION_PENDING').length,
      totalOutstandingQty: rows.reduce((s, r) => s + Number(r.outstandingQty), 0),
    },
    warnings: [],
  }
}
