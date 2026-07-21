import type {
  VendorPaymentAdjustmentAccountingRole,
  VendorPaymentAdjustmentType,
  VendorPaymentMethod,
  VendorPaymentPurpose,
} from '@prisma/client'

/** Bumped when payment calculation semantics change — persisted later on VendorPayment.calculationVersion. */
export const VENDOR_PAYMENT_CALCULATION_VERSION = 1

export type VendorPaymentValidationSeverity = 'ERROR' | 'WARNING' | 'INFO'

export interface VendorPaymentValidationIssue {
  code: string
  message: string
  field?: string | null
  adjustmentLineId?: string | null
  lineNumber?: number | null
  severity: VendorPaymentValidationSeverity
  metadata?: Record<string, unknown>
}

export interface VendorPaymentAccountRef {
  id: string
  code: string
  name: string
}

export interface VendorPaymentCalculationAccountsOverride {
  vendorPayable?: VendorPaymentAccountRef | null
  paymentAccount?: VendorPaymentAccountRef | null
  tdsPayable?: VendorPaymentAccountRef | null
  discountReceived?: VendorPaymentAccountRef | null
  retentionPayable?: VendorPaymentAccountRef | null
  withholdingPayable?: VendorPaymentAccountRef | null
  bankCharge?: VendorPaymentAccountRef | null
  processingCharge?: VendorPaymentAccountRef | null
  roundOffDebit?: VendorPaymentAccountRef | null
  roundOffCredit?: VendorPaymentAccountRef | null
  otherAdjustment?: VendorPaymentAccountRef | null
}

export interface VendorPaymentCalculationConfiguration {
  baseCurrencyCode?: string
  moneyScale?: number
  rateScale?: number
  exchangeRateScale?: number
  allowedRoundOffDifference?: string
  tdsEnabled?: boolean
  tdsAtPaymentEnabled?: boolean
  /** When true, TDS on this payment is blocked (invoice already recognised AT_INVOICE). */
  tdsAlreadyRecognisedAtInvoice?: boolean
  requirePaymentReferenceByMethod?: boolean
  requireChequeDetailsForCheque?: boolean
  requireOpenPayableForSettlementPurpose?: boolean
  allowOverSettlementAsMixedAdvance?: boolean
  blockOverSettlementForInvoicePurpose?: boolean
  companyBorneBankChargesOnly?: boolean
  accounts?: VendorPaymentCalculationAccountsOverride
  /** Optional injected vendor position for sync/pure tests (skips DB). */
  vendorPositionOverride?: VendorPaymentPositionSnapshot | null
}

export interface VendorPaymentAdjustmentInput {
  id?: string | null
  lineNumber: number
  adjustmentType: VendorPaymentAdjustmentType
  accountingRole: VendorPaymentAdjustmentAccountingRole
  description: string
  amount?: string | null
  rate?: string | null
  calculationBaseAmount?: string | null
  sectionCode?: string | null
  statutoryReference?: string | null
  accountId?: string | null
  costCentreId?: string | null
  projectReference?: string | null
  departmentReference?: string | null
  metadata?: Record<string, unknown> | null
}

export interface VendorPaymentCalculationInput {
  tenantId?: string
  legalEntityId: string
  branchId?: string | null
  vendorPaymentId?: string | null
  vendorId: string
  financialYearId?: string | null
  paymentPurpose: VendorPaymentPurpose
  paymentMethod: VendorPaymentMethod
  documentDate: string
  paymentDate: string
  proposedPostingDate?: string | null
  valueDate?: string | null
  currencyCode: string
  exchangeRate: string
  /** Cash paid directly to the vendor. */
  paymentAmount: string
  paymentAccountId?: string | null
  vendorPayableAccountId?: string | null
  paymentReference?: string | null
  bankReference?: string | null
  chequeNumber?: string | null
  chequeDate?: string | null
  instrumentReference?: string | null
  narration?: string | null
  adjustments: VendorPaymentAdjustmentInput[]
  configuration?: VendorPaymentCalculationConfiguration
}

export interface VendorPaymentCalculationContext {
  tenantId?: string | null
  legalEntityId: string
  userId?: string | null
  includeVendorPosition?: boolean
  includeAccountReadiness?: boolean
  includeAccountingPreview?: boolean
}

export type VendorPaymentAccountComponent =
  | 'VENDOR_PAYABLE'
  | 'PAYMENT_ACCOUNT'
  | 'TDS_PAYABLE'
  | 'DISCOUNT_RECEIVED'
  | 'RETENTION_PAYABLE'
  | 'WITHHOLDING_PAYABLE'
  | 'BANK_CHARGE'
  | 'PROCESSING_CHARGE'
  | 'ROUND_OFF_DEBIT'
  | 'ROUND_OFF_CREDIT'
  | 'OTHER_ADJUSTMENT'

export type VendorPaymentAccountSource =
  | 'EXPLICIT'
  | 'VENDOR'
  | 'PAYMENT_METHOD'
  | 'TDS_SECTION'
  | 'MAPPING'
  | 'DEFAULT'
  | 'UNRESOLVED'

export interface VendorPaymentResolvedAccount {
  component: VendorPaymentAccountComponent
  adjustmentLineId?: string | null
  lineNumber?: number | null
  accountId: string | null
  accountCode: string | null
  accountName: string | null
  source: VendorPaymentAccountSource
  isRequired: boolean
  isValid: boolean
  issueCode?: string | null
  issueMessage?: string | null
}

export interface VendorPaymentAccountReadiness {
  isReady: boolean
  resolvedAccounts: VendorPaymentResolvedAccount[]
  missingComponents: string[]
  invalidComponents: string[]
  issues: VendorPaymentValidationIssue[]
}

export interface VendorPaymentCalculatedAdjustment {
  id?: string | null
  lineNumber: number
  adjustmentType: VendorPaymentAdjustmentType
  accountingRole: VendorPaymentAdjustmentAccountingRole
  description: string
  amount: string
  baseAmount: string
  calculationBaseAmount: string | null
  rate: string | null
  sectionCode: string | null
  statutoryReference: string | null
  accountId: string | null
  costCentreId: string | null
  projectReference: string | null
  departmentReference: string | null
  affectsSettlement: boolean
  affectsCashOutflow: boolean
  isInformationOnly: boolean
}

export interface VendorPaymentCalculationTotals {
  paymentAmount: string
  tdsAmount: string
  discountAmount: string
  retentionAmount: string
  withholdingAmount: string
  otherSettlementCreditAmount: string
  settlementAdjustmentAmount: string
  bankChargeAmount: string
  processingChargeAmount: string
  otherPaymentExpenseAmount: string
  paymentExpenseAmount: string
  roundOffDebitAmount: string
  roundOffCreditAmount: string
  netRoundOffAmount: string
  vendorSettlementAmount: string
  cashOutflowAmount: string
}

export type VendorPaymentCalculationBaseTotals = {
  [K in keyof VendorPaymentCalculationTotals as `base${Capitalize<K>}`]: string
}

export interface VendorPaymentPositionSnapshot {
  vendorCreditOutstanding: string
  vendorDebitOutstanding: string
  netVendorPayable: string
  baseVendorCreditOutstanding: string
  baseVendorDebitOutstanding: string
  baseNetVendorPayable: string
}

export interface VendorPaymentPositionResult extends VendorPaymentPositionSnapshot {
  proposedVendorSettlementAmount: string
  excessSettlementAmount: string
  purposeConsistent: boolean
  suggestedPurpose: VendorPaymentPurpose | null
}

export interface VendorPaymentAccountingPreviewLine {
  sequence: number
  component: VendorPaymentAccountComponent | string
  adjustmentLineId?: string | null
  lineNumber?: number | null
  accountId: string | null
  accountCode: string | null
  accountName: string | null
  direction: 'DEBIT' | 'CREDIT'
  debitAmount: string
  creditAmount: string
  baseDebitAmount: string
  baseCreditAmount: string
  currencyCode: string
  exchangeRate: string
  partyType: 'VENDOR' | null
  partyId: string | null
  costCentreId?: string | null
  statutorySection?: string | null
  narration: string
}

export interface VendorPaymentAccountingPreview {
  isBalanced: boolean
  isBaseBalanced: boolean
  debitTotal: string
  creditTotal: string
  difference: string
  baseDebitTotal: string
  baseCreditTotal: string
  baseDifference: string
  vendorPayableDebitAmount: string
  baseVendorPayableDebitAmount: string
  paymentAccountCreditAmount: string
  basePaymentAccountCreditAmount: string
  lines: VendorPaymentAccountingPreviewLine[]
  issues: VendorPaymentValidationIssue[]
}

export interface VendorPaymentOpenItemPreview {
  side: 'DEBIT'
  documentType: 'VENDOR_PAYMENT' | 'VENDOR_ADVANCE'
  originalAmount: string
  baseOriginalAmount: string
  outstandingAmount: string
  baseOutstandingAmount: string
  vendorPayableAccountId: string | null
}

export interface VendorPaymentCalculationValidation {
  isValid: boolean
  errors: VendorPaymentValidationIssue[]
  warnings: VendorPaymentValidationIssue[]
  information: VendorPaymentValidationIssue[]
}

export interface VendorPaymentCalculationSnapshot {
  calculationVersion: number
  paymentPurpose: VendorPaymentPurpose
  paymentMethod: VendorPaymentMethod
  totals: VendorPaymentCalculationTotals
  baseTotals: VendorPaymentCalculationBaseTotals
  adjustmentCount: number
  isAccountReadinessReady: boolean
  isAccountingPreviewBalanced: boolean
  validationErrorCodes: string[]
  validationWarningCodes: string[]
  vendorPayableAccountId: string | null
  paymentAccountId: string | null
  calculatedAt: string
}

export interface VendorPaymentCalculationResult {
  calculationVersion: number
  currency: {
    transactionCurrencyCode: string
    baseCurrencyCode: string
    exchangeRate: string
  }
  paymentPosition: VendorPaymentPositionResult
  adjustments: VendorPaymentCalculatedAdjustment[]
  totals: VendorPaymentCalculationTotals
  baseTotals: VendorPaymentCalculationBaseTotals
  accountReadiness: VendorPaymentAccountReadiness
  accountingPreview: VendorPaymentAccountingPreview
  openItemPreview: VendorPaymentOpenItemPreview
  validation: VendorPaymentCalculationValidation
  snapshot: VendorPaymentCalculationSnapshot
}
