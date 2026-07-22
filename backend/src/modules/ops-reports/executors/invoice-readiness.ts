import { prisma } from '../../../config/database.js'
import { applyDateRangeFilter, toNum } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

/**
 * Invoice-ready report: CONFIRMED dispatch qty minus ACTIVE SalesInvoiceSourceLink consumption.
 * Formula: Invoice-Ready Qty = Confirmed Dispatched − Previously Invoiced (returned qty deferred = 0).
 */
export async function executeInvoiceReadiness(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters, timezone } = ctx
  const f = filters as { customerId?: string; salesOrderId?: string }

  const where: Record<string, unknown> = { tenantId, deletedAt: null, status: 'CONFIRMED' }
  if (f.salesOrderId) where.salesOrderId = f.salesOrderId
  applyDateRangeFilter(where, 'confirmedAt', filters as { dateFrom?: string; dateTo?: string }, timezone)

  const dispatches = await prisma.outboundDispatch.findMany({
    where: where as never,
    select: {
      id: true,
      dispatchNo: true,
      salesOrderNo: true,
      confirmedAt: true,
      lines: { select: { id: true, quantity: true } },
      salesOrder: { select: { companyId: true, company: { select: { name: true } } } },
    },
    orderBy: { confirmedAt: 'desc' },
    take: 3000,
  })

  const filtered = f.customerId ? dispatches.filter((d) => d.salesOrder?.companyId === f.customerId) : dispatches
  const lineIds = filtered.flatMap((d) => d.lines.map((l) => l.id))

  const invoicedByLine = new Map<string, number>()
  if (lineIds.length > 0) {
    const links = await prisma.salesInvoiceSourceLink.groupBy({
      by: ['sourceLineId'],
      where: {
        tenantId,
        status: 'ACTIVE',
        sourceType: 'OUTBOUND_DISPATCH',
        sourceLineId: { in: lineIds },
      },
      _sum: { quantity: true },
    })
    for (const row of links) {
      if (row.sourceLineId) {
        invoicedByLine.set(row.sourceLineId, toNum(row._sum.quantity ?? 0))
      }
    }
  }

  const rows: ReportRow[] = []
  for (const d of filtered) {
    const dispatchedQty = d.lines.reduce((s, l) => s + toNum(l.quantity), 0)
    const invoicedQty = d.lines.reduce((s, l) => s + (invoicedByLine.get(l.id) ?? 0), 0)
    const invoiceReadyQty = Math.max(0, dispatchedQty - invoicedQty)
    if (invoiceReadyQty <= 0) continue
    rows.push({
      dispatchNo: d.dispatchNo,
      salesOrderNo: d.salesOrderNo,
      customer: d.salesOrder?.company?.name ?? null,
      confirmedAt: d.confirmedAt?.toISOString() ?? null,
      totalQty: dispatchedQty,
      invoicedQty,
      invoiceReadyQty,
      invoiceReady: invoiceReadyQty > 0,
    })
  }

  return {
    rows,
    summary: {
      dispatchCount: rows.length,
      totalInvoiceReadyQty: rows.reduce((s, r) => s + toNum(r.invoiceReadyQty), 0),
    },
    warnings: [],
  }
}
