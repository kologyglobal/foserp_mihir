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
    lines: invoice.lines.map((line) => {
      const tax = line as PurchaseInvoiceLine & {
        hsnIdSnapshot?: string | null
        hsnCodeSnapshot?: string
        gstGroupIdSnapshot?: string | null
        gstGroupCodeSnapshot?: string
        cgstRateSnapshot?: unknown
        sgstRateSnapshot?: unknown
        igstRateSnapshot?: unknown
        gstSchemeSnapshot?: string
      }
      return {
      ...line,
      quantity: invoiceQty(line.quantity),
      uomQuantitySnapshot: line.uomQuantitySnapshot != null ? invoiceQty(line.uomQuantitySnapshot) : null,
      uomConversionFactorSnapshot:
        line.uomConversionFactorSnapshot != null ? invoiceQty(line.uomConversionFactorSnapshot) : null,
      rate: invoiceQty(line.rate),
      amount: invoiceQty(line.amount),
      taxRatePct: invoiceQty(line.taxRatePct),
      taxAmount: invoiceQty(line.taxAmount),
      hsnId: tax.hsnIdSnapshot ?? null,
      hsnCode: tax.hsnCodeSnapshot ?? '',
      gstGroupId: tax.gstGroupIdSnapshot ?? null,
      gstGroupCode: tax.gstGroupCodeSnapshot ?? '',
      cgstRate: invoiceQty(tax.cgstRateSnapshot),
      sgstRate: invoiceQty(tax.sgstRateSnapshot),
      igstRate: invoiceQty(tax.igstRateSnapshot),
      gstScheme: tax.gstSchemeSnapshot ?? 'cgst_sgst',
      lineTotal: invoiceQty(line.lineTotal),
    }
    }),
  }
}
