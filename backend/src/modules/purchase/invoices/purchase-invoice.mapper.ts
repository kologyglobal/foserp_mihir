import type { PurchaseInvoice, PurchaseInvoiceLine } from '@prisma/client'
import { invoiceAllowedActions, invoiceQty } from './purchase-invoice.workflow.js'

const date = (value?: Date | null) => value?.toISOString().slice(0, 10) ?? null
const iso = (value?: Date | null) => value?.toISOString() ?? null

export type PurchaseInvoiceEnrichment = {
  purchaseOrderNumber?: string | null
  goodsReceiptNumber?: string | null
  paymentTerms?: string | null
  dueDate?: string | null
}

export function mapPurchaseInvoice(
  invoice: PurchaseInvoice & { lines: PurchaseInvoiceLine[] },
  enrichment?: PurchaseInvoiceEnrichment,
) {
  return {
    ...invoice,
    invoiceDate: date(invoice.invoiceDate),
    documentDate: date(invoice.invoiceDate),
    documentNumber: invoice.invoiceNumber,
    vendorInvoiceDate: date(invoice.vendorInvoiceDate),
    purchaseOrderNumber: enrichment?.purchaseOrderNumber ?? '',
    goodsReceiptNumber: enrichment?.goodsReceiptNumber ?? '',
    paymentTerms: enrichment?.paymentTerms ?? '',
    dueDate: enrichment?.dueDate ?? null,
    subtotalAmount: invoiceQty(invoice.subtotalAmount),
    taxAmount: invoiceQty(invoice.taxAmount),
    roundOffAmount: invoiceQty(invoice.roundOffAmount),
    totalAmount: invoiceQty(invoice.totalAmount),
    submittedAt: iso(invoice.submittedAt),
    approvedAt: iso(invoice.approvedAt),
    postedAt: iso(invoice.postedAt),
    cancelledAt: iso(invoice.cancelledAt),
    createdAt: iso(invoice.createdAt),
    updatedAt: iso(invoice.updatedAt),
    allowedActions: invoiceAllowedActions(invoice.status, invoice.deletedAt),
    lines: invoice.lines.map((line) => ({
      ...line,
      quantity: invoiceQty(line.quantity),
      rate: invoiceQty(line.rate),
      amount: invoiceQty(line.amount),
      taxRatePct: invoiceQty(line.taxRatePct),
      taxAmount: invoiceQty(line.taxAmount),
      lineTotal: invoiceQty(line.lineTotal),
    })),
  }
}
