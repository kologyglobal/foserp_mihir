import type {
  CrmPaymentAllocation,
  CrmPaymentReceipt,
  CrmProformaInvoice,
  CrmProformaInvoiceLine,
  CrmTaxInvoice,
  CrmTaxInvoiceLine,
} from '@prisma/client'

function n(v: { toNumber?: () => number } | number | string | null | undefined): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v)
  if (typeof v.toNumber === 'function') return v.toNumber()
  return Number(v)
}

function d(date: Date | string): string {
  if (typeof date === 'string') return date.slice(0, 10)
  return date.toISOString().slice(0, 10)
}

export function mapReceiptDto(row: CrmPaymentReceipt) {
  return {
    id: row.id,
    receiptNo: row.receiptNo,
    receiptDate: d(row.receiptDate),
    customerId: row.companyId,
    customerName: row.customerNameSnapshot,
    proformaInvoiceId: row.proformaInvoiceId,
    proformaNo: row.proformaNo,
    paymentMode: row.paymentMode,
    transactionRef: row.transactionRef ?? '',
    amount: n(row.amount),
    unallocatedAmount: n(row.unallocatedAmount),
    remarks: row.remarks ?? '',
    attachmentName: row.attachmentName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdBy ?? '',
  }
}

export function mapProformaLineDto(line: CrmProformaInvoiceLine) {
  return {
    id: line.id,
    lineNo: line.lineNo,
    itemId: line.itemId,
    itemCode: line.itemCode,
    description: line.description,
    hsnCode: line.hsnCode ?? '',
    qty: n(line.qty),
    uom: line.uom,
    unitPrice: n(line.unitPrice),
    discountPct: n(line.discountPct),
    taxPct: n(line.taxPct),
    taxableValue: n(line.taxableValue),
    gstAmount: n(line.gstAmount),
    lineTotal: n(line.lineTotal),
    sourceLineId: line.sourceLineId,
    maxQty: line.maxQty != null ? n(line.maxQty) : null,
  }
}

export function mapProformaDto(row: CrmProformaInvoice & { lines?: CrmProformaInvoiceLine[] }) {
  const taxable = n(row.taxableAmount)
  const cgst = n(row.cgstAmount)
  const sgst = n(row.sgstAmount)
  const igst = n(row.igstAmount)
  return {
    id: row.id,
    proformaNo: row.proformaNo,
    proformaDate: d(row.proformaDate),
    validUntil: d(row.validUntil),
    status: row.status,
    source: row.source,
    customerId: row.companyId,
    customerName: row.customerNameSnapshot,
    customerGstin: row.customerGstin ?? '',
    customerState: row.customerState ?? '',
    customerAddress: row.customerAddress ?? '',
    placeOfSupply: row.placeOfSupply ?? row.customerState ?? '',
    billingAddress: row.billingAddress,
    shippingAddress: row.shippingAddress,
    deliveryTerms: row.deliveryTerms ?? '',
    paymentTerms: row.paymentTerms ?? '',
    customerPoNumber: row.customerPoNumber,
    salesOrderId: row.salesOrderId,
    salesOrderNo: row.salesOrderNo,
    quotationId: row.quotationId,
    quotationNo: row.quotationNo,
    locationId: row.locationId,
    remarks: row.remarks ?? '',
    lines: (row.lines ?? []).filter((l) => !l.deletedAt).map(mapProformaLineDto),
    gst: {
      scheme: row.gstScheme === 'igst' ? 'igst' : 'cgst_sgst',
      taxableAmount: taxable,
      cgstRate: taxable > 0 && cgst > 0 ? Math.round((cgst / taxable) * 10000) / 100 : 0,
      cgstAmount: cgst,
      sgstRate: taxable > 0 && sgst > 0 ? Math.round((sgst / taxable) * 10000) / 100 : 0,
      sgstAmount: sgst,
      igstRate: taxable > 0 && igst > 0 ? Math.round((igst / taxable) * 10000) / 100 : 0,
      igstAmount: igst,
      totalTax: n(row.totalTaxAmount),
      grandTotal: n(row.grandTotal),
    },
    issuedAt: row.issuedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdBy ?? '',
  }
}

export function mapInvoiceLineDto(line: CrmTaxInvoiceLine) {
  return {
    id: line.id,
    lineNo: line.lineNo,
    itemId: line.itemId,
    itemCode: line.itemCode,
    description: line.description,
    hsnCode: line.hsnCode ?? '',
    qty: n(line.qty),
    uom: line.uom,
    unitPrice: n(line.unitPrice),
    discountPct: n(line.discountPct),
    taxPct: n(line.taxPct),
    taxableValue: n(line.taxableValue),
    gstAmount: n(line.gstAmount),
    lineTotal: n(line.lineTotal),
    sourceLineId: line.sourceLineId,
    maxQty: line.maxQty != null ? n(line.maxQty) : null,
  }
}

export function mapInvoiceDto(row: CrmTaxInvoice & { lines?: CrmTaxInvoiceLine[] }) {
  const taxable = n(row.taxableAmount)
  const cgst = n(row.cgstAmount)
  const sgst = n(row.sgstAmount)
  const igst = n(row.igstAmount)
  return {
    id: row.id,
    invoiceNo: row.invoiceNo,
    invoiceDate: d(row.invoiceDate),
    dueDate: d(row.dueDate),
    status: row.status,
    paymentStatus: row.paymentStatus,
    source: row.source,
    customerId: row.companyId,
    customerName: row.customerNameSnapshot,
    customerGstin: row.customerGstin ?? '',
    customerState: row.customerState ?? '',
    customerAddress: row.customerAddress ?? '',
    placeOfSupply: row.placeOfSupply ?? row.customerState ?? '',
    billingAddress: row.billingAddress,
    shippingAddress: row.shippingAddress,
    deliveryTerms: row.deliveryTerms ?? '',
    paymentTerms: row.paymentTerms ?? '',
    customerPoNumber: row.customerPoNumber,
    salesOrderId: row.salesOrderId,
    salesOrderNo: row.salesOrderNo,
    quotationId: row.quotationId,
    quotationNo: row.quotationNo,
    proformaInvoiceId: row.proformaInvoiceId,
    proformaNo: row.proformaNo,
    remarks: row.remarks ?? '',
    lines: (row.lines ?? []).filter((l) => !l.deletedAt).map(mapInvoiceLineDto),
    gst: {
      scheme: row.gstScheme === 'igst' ? 'igst' : 'cgst_sgst',
      taxableAmount: taxable,
      cgstRate: taxable > 0 && cgst > 0 ? Math.round((cgst / taxable) * 10000) / 100 : 0,
      cgstAmount: cgst,
      sgstRate: taxable > 0 && sgst > 0 ? Math.round((sgst / taxable) * 10000) / 100 : 0,
      sgstAmount: sgst,
      igstRate: taxable > 0 && igst > 0 ? Math.round((igst / taxable) * 10000) / 100 : 0,
      igstAmount: igst,
      totalTax: n(row.totalTaxAmount),
      grandTotal: n(row.grandTotal),
    },
    amountPaid: n(row.amountPaid),
    balanceDue: n(row.balanceDue),
    accountingStatus: row.accountingStatus,
    salesInvoiceId: row.salesInvoiceId,
    salesInvoiceNumber: row.salesInvoiceNumber,
    accountingSubmittedAt: row.accountingSubmittedAt?.toISOString() ?? null,
    accountingConvertedAt: row.accountingConvertedAt?.toISOString() ?? null,
    createdByName: row.createdByNameSnapshot ?? '',
    postedAt: row.postedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdBy ?? '',
  }
}

export function mapAllocationDto(row: CrmPaymentAllocation) {
  return {
    id: row.id,
    receiptId: row.receiptId,
    receiptNo: row.receiptNo,
    invoiceId: row.invoiceId,
    invoiceNo: row.invoiceNo,
    customerId: row.companyId,
    customerName: row.customerName,
    amount: n(row.amount),
    allocationDate: d(row.allocationDate),
    remarks: row.remarks ?? '',
    reversedAt: row.reversedAt?.toISOString() ?? null,
    reversedBy: row.reversedBy,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy ?? '',
  }
}

export function computePaymentStatus(grandTotal: number, amountPaid: number): 'unpaid' | 'partially_paid' | 'paid' {
  if (amountPaid <= 0.009) return 'unpaid'
  if (amountPaid + 0.009 >= grandTotal) return 'paid'
  return 'partially_paid'
}

export function invoiceStatusFromPayment(
  paymentStatus: 'unpaid' | 'partially_paid' | 'paid',
  current: string,
): 'draft' | 'posted' | 'partially_paid' | 'paid' | 'cancelled' {
  if (current === 'draft' || current === 'cancelled') return current as 'draft' | 'cancelled'
  if (paymentStatus === 'paid') return 'paid'
  if (paymentStatus === 'partially_paid') return 'partially_paid'
  return 'posted'
}
