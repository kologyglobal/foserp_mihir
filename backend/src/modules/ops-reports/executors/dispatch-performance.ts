import { prisma } from '../../../config/database.js'
import { applyDateRangeFilter, toNum } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

export async function executeDispatchPerformance(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters, timezone } = ctx
  const f = filters as { dispatchStatus?: string }

  const where: Record<string, unknown> = { tenantId, deletedAt: null }
  if (f.dispatchStatus) where.status = f.dispatchStatus
  applyDateRangeFilter(where, 'confirmedAt', filters as { dateFrom?: string; dateTo?: string }, timezone)

  const dispatches = await prisma.outboundDispatch.findMany({
    where: where as never,
    select: {
      id: true,
      dispatchNo: true,
      status: true,
      confirmedAt: true,
      salesOrderNo: true,
      salesOrder: { select: { orderDate: true } },
      lines: { select: { quantity: true } },
    },
    orderBy: { confirmedAt: 'desc' },
    take: 3000,
  })

  const rows: ReportRow[] = dispatches.map((d) => {
    const totalQty = d.lines.reduce((s, l) => s + toNum(l.quantity), 0)
    const leadTimeDays =
      d.confirmedAt && d.salesOrder?.orderDate
        ? Math.round(((d.confirmedAt.getTime() - d.salesOrder.orderDate.getTime()) / (24 * 60 * 60 * 1000)) * 100) / 100
        : null
    return {
      dispatchNo: d.dispatchNo,
      salesOrderNo: d.salesOrderNo,
      status: d.status,
      confirmedAt: d.confirmedAt?.toISOString() ?? null,
      lineCount: d.lines.length,
      totalQty,
      leadTimeDays,
    }
  })

  const withLeadTime = rows.filter((r) => r.leadTimeDays != null)
  return {
    rows,
    summary: {
      dispatchCount: rows.length,
      confirmedCount: rows.filter((r) => r.status === 'CONFIRMED').length,
      avgLeadTimeDays: withLeadTime.length
        ? Math.round((withLeadTime.reduce((s, r) => s + Number(r.leadTimeDays), 0) / withLeadTime.length) * 100) / 100
        : null,
    },
    warnings: [],
  }
}
