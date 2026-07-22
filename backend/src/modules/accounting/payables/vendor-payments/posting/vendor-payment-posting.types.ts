import type { PostingResult } from '../../../posting/posting.types.js'

export interface PostVendorPaymentInput {
  vendorPaymentId: string
  expectedUpdatedAt: string
}

export interface PostVendorPaymentContext {
  tenantId: string
  userId: string
  requestId?: string | null
  authorization: { permissionChecked: true }
  ipAddress?: string | null
  userAgent?: string | null
}

export interface PostVendorPaymentResult {
  idempotentReplay: boolean

  vendorPaymentId: string
  draftReference: string
  vendorPaymentNumber: string
  status: 'POSTED'

  accountingVoucherId: string
  accountingVoucherNumber: string

  postingEventId: string
  payableOpenItemId: string
  payableOpenItemSide: 'DEBIT'
  payableOpenItemDocumentType: 'VENDOR_PAYMENT' | 'VENDOR_ADVANCE'

  vendorId: string
  vendorCode: string
  vendorName: string

  paymentPurpose: string
  paymentMethod: string

  documentDate: string
  paymentDate: string
  postingDate: string

  currencyCode: string

  paymentAmount: string
  tdsAmount: string
  settlementAdjustmentAmount: string
  vendorSettlementAmount: string
  cashOutflowAmount: string

  payableOutstandingAmount: string

  ledgerEntryCount: number

  /** Full posting-engine result for drill-down consumers. */
  posting: PostingResult
}

export interface VendorPaymentPostingValidationContext {
  vendorPayableAccountId: string
  financialYearId: string
  expectedUpdatedAt: string
}

export function buildVendorPaymentPostEventKey(vendorPaymentId: string): string {
  return `VENDOR_PAYMENT_POST:${vendorPaymentId}:V1`
}

export function buildVendorPaymentReverseEventKey(vendorPaymentId: string): string {
  return `VENDOR_PAYMENT_REVERSE:${vendorPaymentId}:V1`
}
