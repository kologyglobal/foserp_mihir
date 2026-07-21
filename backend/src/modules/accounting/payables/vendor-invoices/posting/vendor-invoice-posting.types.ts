import type { PostingResult } from '../../../posting/posting.types.js'

export interface PostVendorInvoiceInput {
  vendorInvoiceId: string
  expectedUpdatedAt: string
}

export interface PostVendorInvoiceContext {
  tenantId: string
  userId: string
  requestId?: string | null
  authorization: { permissionChecked: true }
  ipAddress?: string | null
  userAgent?: string | null
}

export interface PostVendorInvoiceResult {
  idempotentReplay: boolean

  vendorInvoiceId: string
  draftReference: string
  vendorInvoiceNumber: string
  supplierInvoiceNumber: string
  status: 'POSTED'

  accountingVoucherId: string
  accountingVoucherNumber: string

  postingEventId: string
  payableOpenItemId: string

  vendorId: string
  vendorCode: string
  vendorName: string

  documentDate: string
  supplierInvoiceDate: string
  postingDate: string
  dueDate?: string | null

  currencyCode: string

  invoiceGrandTotal: string
  tdsAmount: string
  vendorPayableAmount: string

  payableOutstandingAmount: string

  ledgerEntryCount: number

  /** Full posting-engine result for drill-down consumers. */
  posting: PostingResult
}

export interface VendorInvoicePostingValidationContext {
  vendorPayableAccountId: string
  financialYearId: string
  expectedUpdatedAt: string
}

export function buildVendorInvoicePostEventKey(vendorInvoiceId: string): string {
  return `VENDOR_INVOICE_POST:${vendorInvoiceId}:V1`
}

export function buildVendorInvoiceReverseEventKey(vendorInvoiceId: string): string {
  return `VENDOR_INVOICE_REVERSE:${vendorInvoiceId}:V1`
}
