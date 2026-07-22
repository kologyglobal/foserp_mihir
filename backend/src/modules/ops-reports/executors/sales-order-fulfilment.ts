import { prisma } from '../../../config/database.js'
import { getSalesOrderFulfilment } from '../../crm/sales-orders/fulfilment/sales-order-fulfilment.service.js'
import { normalizeStatusFilterList, percent } from './helpers.js'
import type { ExecutorContext, ExecutorOutput, ReportRow } from '../types.js'

const BOUND = 300

export async function executeSalesOrderFulfilment(ctx: ExecutorContext): Promise<ExecutorOutput> {
  const { tenantId, filters } = ctx
  const f = filters as { customerId?: string; status?: string | string[] }

  const where: Record<string, unknown> = { tenantId, deletedAt: null }
  if (f.customerId) where.companyId = f.customerId
  const statuses = normalizeStatusFilterList(f.status)
  if (statuses) where.status = { in: statuses }

  const orders = await prisma.crmSalesOrder.findMany({
    where: where as never,
    select: { id: true, salesOrderNo: true, status: true, orderDate: true, company: { select: { name: true } } },
    orderBy: { orderDate: 'desc' },
    take: BOUND,
  })

  const rows: ReportRow[] = []
  for (const so of orders) {
    const fulfilment = await getSalesOrderFulfilment(tenantId, so.id)
    rows.push({
      salesOrderId: so.id,
      salesOrderNo: so.salesOrderNo,
      customer: so.company?.name ?? null,
      status: so.status,
      orderedQty: fulfilment.totals.netOrderedQty,
      dispatchedQty: fulfilment.totals.dispatchedQty,
      fulfilmentPercent: percent(fulfilment.totals.dispatchedQty, fulfilment.totals.netOrderedQty),
      orderDate: so.orderDate.toISOString().slice(0, 10),
    })
  }

  return {
    rows,
    summary: {
      salesOrderCount: rows.length,
      fullyFulfilled: rows.filter((r) => Number(r.fulfilmentPercent) >= 100).length,
      partiallyFulfilled: rows.filter((r) => Number(r.fulfilmentPercent) > 0 && Number(r.fulfilmentPercent) < 100).length,
    },
    warnings: orders.length >= BOUND ? [`Bounded to the ${BOUND} most recent sales orders — narrow filters for others.`] : [],
  }
}
