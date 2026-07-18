import type { CrmSalesOrder } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import type { SalesOrderLineDto } from '../../../crm/sales-orders/sales-order.types.js'
import {
  SalesOrderCancelledError,
  SalesOrderCustomerMismatchError,
  SalesOrderNotFoundError,
} from '../sales-invoices/sales-invoice.errors.js'

export interface SalesOrderSourceSnapshot {
  id: string
  orderNumber: string
  customerId: string
  status: string
  orderDate: string | null
  customerPoNumber: string | null
  lines: SalesOrderLineDto[]
}

export interface SalesOrderSourceContext {
  snapshot: SalesOrderSourceSnapshot
  warnings: Array<{ code: string; message: string }>
}

function parseLines(value: unknown): SalesOrderLineDto[] {
  return Array.isArray(value) ? (value as SalesOrderLineDto[]) : []
}

function isCancelledStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase()
  return normalized === 'cancelled' || normalized === 'canceled'
}

function mapSnapshot(order: CrmSalesOrder): SalesOrderSourceSnapshot {
  return {
    id: order.id,
    orderNumber: order.salesOrderNo,
    customerId: order.companyId,
    status: order.status,
    orderDate: order.orderDate ? order.orderDate.toISOString().slice(0, 10) : null,
    customerPoNumber: order.customerPoNumber,
    lines: parseLines(order.lines),
  }
}

export async function loadSalesOrderSource(
  tenantId: string,
  salesOrderId: string,
  expectedCustomerId: string,
): Promise<SalesOrderSourceContext> {
  const order = await prisma.crmSalesOrder.findFirst({
    where: { id: salesOrderId, tenantId, deletedAt: null },
  })
  if (!order) throw new SalesOrderNotFoundError(salesOrderId)
  if (isCancelledStatus(order.status)) throw new SalesOrderCancelledError()
  if (order.companyId !== expectedCustomerId) throw new SalesOrderCustomerMismatchError()

  const warnings: Array<{ code: string; message: string }> = []
  const existingCount = await prisma.salesInvoice.count({
    where: {
      tenantId,
      sourceType: 'SALES_ORDER',
      sourceDocumentId: salesOrderId,
      status: { not: 'CANCELLED' },
    },
  })
  if (existingCount > 0) {
    warnings.push({
      code: 'SALES_ORDER_ALREADY_INVOICED',
      message: 'Another sales invoice is already linked to this sales order',
    })
  }

  return { snapshot: mapSnapshot(order), warnings }
}
