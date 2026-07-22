import type {
  VendorPayment,
  VendorPaymentAdjustmentAccountingRole,
  VendorPaymentAdjustmentLine,
  VendorPaymentAdjustmentType,
  VendorPaymentMethod,
  VendorPaymentPurpose,
  VendorPaymentStatus,
  Prisma,
} from '@prisma/client'

export type VendorPaymentWithLines = VendorPayment & {
  adjustmentLines: VendorPaymentAdjustmentLine[]
}

export const VENDOR_PAYMENT_AUDIT_ACTIONS = [
  'VENDOR_PAYMENT_CREATED',
  'VENDOR_PAYMENT_UPDATED',
  'VENDOR_PAYMENT_SUBMITTED',
  'VENDOR_PAYMENT_APPROVED',
  'VENDOR_PAYMENT_REJECTED',
  'VENDOR_PAYMENT_READY_TO_POST',
  'VENDOR_PAYMENT_POSTED',
  'VENDOR_PAYMENT_CANCELLED',
  'VENDOR_PAYMENT_REVERSED',
] as const

export type VendorPaymentAuditAction = (typeof VENDOR_PAYMENT_AUDIT_ACTIONS)[number]

export interface CreateVendorPaymentRecordInput {
  tenantId: string
  legalEntityId: string
  branchId?: string | null
  vendorId: string
  financialYearId: string
  draftReference: string
  paymentPurpose: VendorPaymentPurpose
  paymentMethod: VendorPaymentMethod
  status?: VendorPaymentStatus
  documentDate: Date
  paymentDate: Date
  proposedPostingDate?: Date | null
  valueDate?: Date | null
  dueReferenceDate?: Date | null
  currencyCode?: string
  exchangeRate?: Prisma.Decimal | number | string
  vendorCodeSnapshot: string
  vendorNameSnapshot: string
  vendorGstinSnapshot?: string | null
  vendorPanSnapshot?: string | null
  vendorStateCodeSnapshot?: string | null
  vendorAddressSnapshot?: Prisma.InputJsonValue | null
  paymentAccountId?: string | null
  vendorPayableAccountId?: string | null
  tdsPayableAccountId?: string | null
  discountAccountId?: string | null
  retentionAccountId?: string | null
  bankChargeAccountId?: string | null
  processingChargeAccountId?: string | null
  roundOffAccountId?: string | null
  otherAdjustmentAccountId?: string | null
  paymentAmount?: Prisma.Decimal | number | string
  settlementAdjustmentAmount?: Prisma.Decimal | number | string
  paymentExpenseAmount?: Prisma.Decimal | number | string
  roundOffAmount?: Prisma.Decimal | number | string
  vendorSettlementAmount?: Prisma.Decimal | number | string
  cashOutflowAmount?: Prisma.Decimal | number | string
  basePaymentAmount?: Prisma.Decimal | number | string
  baseSettlementAdjustmentAmount?: Prisma.Decimal | number | string
  basePaymentExpenseAmount?: Prisma.Decimal | number | string
  baseRoundOffAmount?: Prisma.Decimal | number | string
  baseVendorSettlementAmount?: Prisma.Decimal | number | string
  baseCashOutflowAmount?: Prisma.Decimal | number | string
  tdsBaseAmount?: Prisma.Decimal | number | string
  tdsAmount?: Prisma.Decimal | number | string
  baseTdsBaseAmount?: Prisma.Decimal | number | string
  baseTdsAmount?: Prisma.Decimal | number | string
  paymentReference?: string | null
  bankReference?: string | null
  chequeNumber?: string | null
  chequeDate?: Date | null
  instrumentReference?: string | null
  narration?: string | null
  beneficiarySnapshot?: Prisma.InputJsonValue | null
  paymentInstructionSnapshot?: Prisma.InputJsonValue | null
  approvalRequired?: boolean
  createdBy?: string | null
}

export interface CreateVendorPaymentAdjustmentLineInput {
  lineNumber: number
  adjustmentType: VendorPaymentAdjustmentType
  accountingRole: VendorPaymentAdjustmentAccountingRole
  description: string
  amount: Prisma.Decimal | number | string
  baseAmount: Prisma.Decimal | number | string
  calculationBaseAmount?: Prisma.Decimal | number | string | null
  rate?: Prisma.Decimal | number | string | null
  sectionCode?: string | null
  statutoryReference?: string | null
  accountId?: string | null
  costCentreId?: string | null
  projectReference?: string | null
  departmentReference?: string | null
  metadata?: Prisma.InputJsonValue | null
}

/**
 * Phase 4B3 — resolved GL account ids from the calculation engine (header-level convenience
 * fields). Per-line adjustment accounts remain on VendorPaymentAdjustmentLine.accountId.
 */
export interface VendorPaymentResolvedAccountIds {
  paymentAccountId: string | null
  vendorPayableAccountId: string | null
  tdsPayableAccountId: string | null
  discountAccountId: string | null
  retentionAccountId: string | null
  bankChargeAccountId: string | null
  processingChargeAccountId: string | null
  roundOffAccountId: string | null
  otherAdjustmentAccountId: string | null
}

export interface VendorPaymentVendorSnapshot {
  vendorCodeSnapshot: string
  vendorNameSnapshot: string
  vendorGstinSnapshot?: string | null
  vendorPanSnapshot?: string | null
  vendorStateCodeSnapshot?: string | null
  vendorAddressSnapshot?: Prisma.InputJsonValue | null
}

/**
 * Phase 4B3 — full header persistence for the draft workflow (create/replace).
 * Distinct from the narrower `CreateVendorPaymentRecordInput` (Phase 4B1 foundation) which
 * does not carry calculated totals, snapshots, or resolved GL accounts.
 */
export interface VendorPaymentDraftHeaderInput {
  tenantId: string
  legalEntityId: string
  branchId?: string | null
  vendorId: string
  financialYearId: string
  draftReference: string
  paymentPurpose: VendorPaymentPurpose
  paymentMethod: VendorPaymentMethod
  documentDate: Date
  paymentDate: Date
  proposedPostingDate?: Date | null
  valueDate?: Date | null
  dueReferenceDate?: Date | null
  currencyCode: string
  exchangeRate: Prisma.Decimal | number | string
  vendorSnapshot: VendorPaymentVendorSnapshot
  paymentReference?: string | null
  bankReference?: string | null
  chequeNumber?: string | null
  chequeDate?: Date | null
  instrumentReference?: string | null
  narration?: string | null
  approvalRequired: boolean
  calculationContext: Prisma.InputJsonValue
  userId?: string | null
}
