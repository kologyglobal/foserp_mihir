/**
 * Block SO over-invoicing by grand-total (services / amount-based O2C).
 */
import { prisma } from '../../../../config/database.js'
import { SalesInvoiceValidationFailedError } from './sales-invoice.errors.js'

function toNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Sum already-invoiced grand totals linked to a sales order (excludes CANCELLED / VOID).
 */
export async function sumInvoicedAmountForSalesOrder(
  tenantId: string,
  salesOrderId: string,
  excludeSalesInvoiceId?: string,
): Promise<number> {
  const invoices = await prisma.salesInvoice.findMany({
    where: {
      tenantId,
      status: { notIn: ['CANCELLED', 'REVERSED'] },
      ...(excludeSalesInvoiceId ? { id: { not: excludeSalesInvoiceId } } : {}),
      OR: [
        { sourceType: 'SALES_ORDER', sourceDocumentId: salesOrderId },
        { sourceLinks: { some: { salesOrderId } } },
      ],
    },
    select: { id: true, totalAmount: true },
  })
  return invoices.reduce((sum, inv) => sum + toNum(inv.totalAmount), 0)
}

export async function assertSalesOrderNotOverInvoiced(input: {
  tenantId: string
  salesOrderId: string
  soTotalAmount: number
  thisInvoiceGrandTotal: number
  excludeSalesInvoiceId?: string
}): Promise<{ alreadyInvoiced: number; remaining: number }> {
  const alreadyInvoiced = await sumInvoicedAmountForSalesOrder(
    input.tenantId,
    input.salesOrderId,
    input.excludeSalesInvoiceId,
  )
  const remaining = Math.max(0, input.soTotalAmount - alreadyInvoiced)
  const epsilon = 0.01
  if (input.thisInvoiceGrandTotal > remaining + epsilon) {
    throw new SalesInvoiceValidationFailedError(
      `Invoice amount ₹${input.thisInvoiceGrandTotal.toFixed(2)} exceeds remaining invoiceable ₹${remaining.toFixed(2)} (SO total ₹${input.soTotalAmount.toFixed(2)}, already invoiced ₹${alreadyInvoiced.toFixed(2)})`,
      [
        {
          field: 'grandTotal',
          message: 'Over-invoicing blocked — reduce amount or lines to remaining balance',
        },
      ],
    )
  }
  return { alreadyInvoiced, remaining }
}
