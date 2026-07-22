import { prisma } from '../../../config/database.js'
import { getSalesOrderFulfilment } from '../../crm/sales-orders/fulfilment/sales-order-fulfilment.service.js'
import type { SalesOrderLineDto } from '../../crm/sales-orders/sales-order.types.js'
import { applyDateRangeFilter, round2, toNum } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

const BOUND = 300

function parseLines(value: unknown): SalesOrderLineDto[] {
  return Array.isArray(value) ? (value as SalesOrderLineDto[]) : []
}

function orderedAmount(order: { grandTotal: unknown; lines: unknown }): number {
  const headerTotal = toNum(order.grandTotal)
  if (headerTotal > 0) return round2(headerTotal)
  return round2(parseLines(order.lines).reduce((sum, line) => sum + toNum(line.lineTotal), 0))
}

export async function executeRevenueBridge(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters, timezone } = ctx
  const f = filters as { customerId?: string; salesOrderId?: string }

  const where: Record<string, unknown> = { tenantId, deletedAt: null }
  if (f.customerId) where.companyId = f.customerId
  if (f.salesOrderId) where.id = f.salesOrderId
  applyDateRangeFilter(where, 'orderDate', filters as { dateFrom?: string; dateTo?: string }, timezone)

  const orders = await prisma.crmSalesOrder.findMany({
    where: where as never,
    select: {
      id: true,
      salesOrderNo: true,
      orderDate: true,
      grandTotal: true,
      lines: true,
      company: { select: { name: true } },
    },
    orderBy: { orderDate: 'desc' },
    take: BOUND,
  })

  const orderIds = orders.map((o) => o.id)
  const invoices =
    orderIds.length === 0
      ? []
      : await prisma.salesInvoice.findMany({
          where: {
            tenantId,
            status: 'POSTED',
            OR: [
              { sourceType: 'SALES_ORDER', sourceDocumentId: { in: orderIds } },
              { sourceLinks: { some: { salesOrderId: { in: orderIds }, status: 'ACTIVE' } } },
            ],
          },
          select: {
            id: true,
            sourceType: true,
            sourceDocumentId: true,
            totalAmount: true,
            sourceLinks: { select: { salesOrderId: true } },
          },
        })

  const invoiceIds = invoices.map((i) => i.id)
  const allocations =
    invoiceIds.length === 0
      ? []
      : await prisma.customerReceiptAllocation.findMany({
          where: { tenantId, status: 'POSTED', invoiceId: { in: invoiceIds } },
          select: { invoiceId: true, allocatedAmount: true },
        })

  function primarySalesOrderId(invoice: (typeof invoices)[number]): string | null {
    for (const link of invoice.sourceLinks) {
      if (link.salesOrderId) return link.salesOrderId
    }
    if (invoice.sourceType === 'SALES_ORDER' && invoice.sourceDocumentId) {
      return invoice.sourceDocumentId
    }
    return null
  }

  const invoicedByOrder = new Map<string, number>()
  for (const invoice of invoices) {
    const orderId = primarySalesOrderId(invoice)
    if (!orderId || !orderIds.includes(orderId)) continue
    invoicedByOrder.set(orderId, (invoicedByOrder.get(orderId) ?? 0) + toNum(invoice.totalAmount))
  }

  const collectedByInvoice = new Map<string, number>()
  for (const row of allocations) {
    if (!row.invoiceId) continue
    collectedByInvoice.set(row.invoiceId, (collectedByInvoice.get(row.invoiceId) ?? 0) + toNum(row.allocatedAmount))
  }

  const collectedByOrder = new Map<string, number>()
  for (const invoice of invoices) {
    const collected = collectedByInvoice.get(invoice.id) ?? 0
    if (collected <= 0) continue
    const orderId = primarySalesOrderId(invoice)
    if (!orderId || !orderIds.includes(orderId)) continue
    collectedByOrder.set(orderId, (collectedByOrder.get(orderId) ?? 0) + collected)
  }

  const rows: ReportRow[] = []
  for (const order of orders) {
    const ordered = orderedAmount(order)
    const fulfilment = await getSalesOrderFulfilment(tenantId, order.id)
    const fulfilmentRatio =
      fulfilment.totals.netOrderedQty > 0
        ? fulfilment.totals.dispatchedQty / fulfilment.totals.netOrderedQty
        : 0
    const dispatched = round2(ordered * Math.min(1, fulfilmentRatio))
    const invoiced = round2(invoicedByOrder.get(order.id) ?? 0)
    const collected = round2(collectedByOrder.get(order.id) ?? 0)

    rows.push({
      salesOrderId: order.id,
      salesOrderNo: order.salesOrderNo,
      customer: order.company?.name ?? null,
      orderDate: order.orderDate.toISOString().slice(0, 10),
      orderedAmount: ordered,
      dispatchedAmount: dispatched,
      invoicedAmount: invoiced,
      collectedAmount: collected,
      dispatchGap: round2(ordered - dispatched),
      invoiceGap: round2(dispatched - invoiced),
      collectionGap: round2(invoiced - collected),
    })
  }

  const sum = (key: string) => round2(rows.reduce((s, r) => s + toNum(r[key]), 0))

  return {
    rows,
    summary: {
      salesOrderCount: rows.length,
      orderedAmount: sum('orderedAmount'),
      dispatchedAmount: sum('dispatchedAmount'),
      invoicedAmount: sum('invoicedAmount'),
      collectedAmount: sum('collectedAmount'),
    },
    chartData: [
      {
        type: 'bar',
        title: 'O2C Revenue Bridge',
        series: [
          { label: 'Ordered', value: sum('orderedAmount') },
          { label: 'Dispatched', value: sum('dispatchedAmount') },
          { label: 'Invoiced', value: sum('invoicedAmount') },
          { label: 'Collected', value: sum('collectedAmount') },
        ],
      },
    ],
    warnings:
      orders.length >= BOUND
        ? [`Bounded to the ${BOUND} most recent sales orders — narrow filters for others.`]
        : [],
  }
}
