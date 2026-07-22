import type { PostingResult } from '../../../posting/posting.types.js'

export interface PostVendorAdjustmentInput {
  vendorAdjustmentId: string
  expectedUpdatedAt: string
}

export interface PostVendorAdjustmentContext {
  tenantId: string
  userId: string
  requestId?: string | null
  authorization: { permissionChecked: true }
  ipAddress?: string | null
  userAgent?: string | null
}

export interface PostVendorAdjustmentResult {
  idempotentReplay: boolean
  vendorAdjustmentId: string
  draftReference: string
  vendorAdjustmentNumber: string
  supplierReferenceNumber: string
  status: 'POSTED'
  accountingVoucherId: string
  accountingVoucherNumber: string
  postingEventId: string
  payableOpenItemId: string
  vendorId: string
  vendorCode: string
  vendorName: string
  documentDate: string
  supplierReferenceDate: string
  postingDate: string
  dueDate?: string | null
  currencyCode: string
  adjustmentGrandTotal: string
  tdsAmount: string
  vendorPayableAmount: string
  payableOutstandingAmount: string
  ledgerEntryCount: number
  posting: PostingResult
}

export interface VendorAdjustmentPostingValidationContext {
  vendorPayableAccountId: string
  financialYearId: string
  expectedUpdatedAt: string
}

export function buildVendorAdjustmentPostEventKey(vendorAdjustmentId: string): string {
  return `VENDOR_ADJUSTMENT_POST:${vendorAdjustmentId}:V1`
}

export function buildVendorAdjustmentReverseEventKey(vendorAdjustmentId: string): string {
  return `VENDOR_ADJUSTMENT_REVERSE:${vendorAdjustmentId}:V1`
}
