import type {
  VendorAdjustmentItcTreatment,
  VendorAdjustmentLineType,
  VendorAdjustmentSourceLinkType,
  VendorAdjustmentStatus,
  VendorAdjustmentTaxEffect,
  VendorAdjustmentTdsTreatment,
  VendorAdjustmentType,
  VendorInvoiceTaxTreatment,
  InputTaxCreditEligibility,
} from '@prisma/client'

/** Bumped whenever calculation semantics change — persisted on VendorAdjustment.calculationVersion. */
export const VENDOR_ADJUSTMENT_CALCULATION_VERSION = 1

export type VendorAdjustmentLineDiscountType = 'PERCENTAGE' | 'AMOUNT'
export type VendorAdjustmentHeaderDiscountType = 'PERCENTAGE' | 'AMOUNT'
export type VendorAdjustmentRoundingMode = 'NONE' | 'NEAREST_UNIT' | 'NEAREST_0_05' | 'MANUAL'

/** AP supply type is binary — zero-tax treatments (NON_GST/EXEMPT/NIL_RATED) short-circuit tax math instead of adding a third member. */
export type VendorAdjustmentPurchaseSupplyType = 'INTRA_STATE' | 'INTER_STATE'

export type VendorAdjustmentValidationSeverity = 'ERROR' | 'WARNING' | 'INFO'

export interface VendorAdjustmentValidationIssue {
  code: string
  message: string
  field?: string
  severity: VendorAdjustmentValidationSeverity
}

/** Minimal id/code/name reference — mirrors Account rows without depending on Prisma's Account type here. */
export interface VendorAdjustmentAccountRef {
  id: string
  code: string
  name: string
}

/**
 * Test/preview seam — lets callers inject resolved accounts instead of hitting the DB.
 * Populated by the (future) account resolver in normal operation.
 */
export interface VendorAdjustmentCalculationAccountsOverride {
  vendorPayable?: VendorAdjustmentAccountRef | null
  purchaseOrDebit?: VendorAdjustmentAccountRef | null
  inputCgst?: VendorAdjustmentAccountRef | null
  inputSgst?: VendorAdjustmentAccountRef | null
  inputIgst?: VendorAdjustmentAccountRef | null
  inputCess?: VendorAdjustmentAccountRef | null
  tdsPayable?: VendorAdjustmentAccountRef | null
  freight?: VendorAdjustmentAccountRef | null
  otherCharge?: VendorAdjustmentAccountRef | null
  roundOff?: VendorAdjustmentAccountRef | null
  rcmCgstPayable?: VendorAdjustmentAccountRef | null
  rcmSgstPayable?: VendorAdjustmentAccountRef | null
  rcmIgstPayable?: VendorAdjustmentAccountRef | null
}

export interface VendorAdjustmentCalculationConfiguration {
  roundingMode?: VendorAdjustmentRoundingMode
  manualRoundOff?: string
  roundingTolerance?: string
  /** Legal-entity base currency — defaults to INR when omitted. */
  baseCurrencyCode?: string
  accounts?: VendorAdjustmentCalculationAccountsOverride
}

export interface VendorAdjustmentCalculationLineInput {
  lineNumber: number
  lineType: VendorAdjustmentLineType
  description: string
  itemId?: string | null
  itemCodeSnapshot?: string | null
  itemNameSnapshot?: string | null
  hsnSacCode?: string | null
  quantity: string
  uomId?: string | null
  uomCodeSnapshot?: string | null
  unitPrice: string
  lineDiscountType?: VendorAdjustmentLineDiscountType
  lineDiscountValue?: string
  /** Combined GST rate — split into CGST/SGST or IGST by supply type when explicit rates are absent. */
  gstRate?: string
  /** Explicit component rates — take precedence over gstRate when any is present. */
  cgstRate?: string
  sgstRate?: string
  igstRate?: string
  cessRate?: string
  isTaxInclusive?: boolean
  offsetAccountId?: string | null
  costCentreId?: string | null
  projectReference?: string | null
  departmentReference?: string | null
  /** Line-level override of the header tax treatment (e.g. a single RCM freight line on an otherwise REGULAR bill). */
  purchaseTaxTreatment?: VendorInvoiceTaxTreatment | null
  /** Line-level override of the header ITC eligibility. */
  itcEligibility?: InputTaxCreditEligibility | null
  /** Required when effective itcEligibility resolves to PARTIALLY_ELIGIBLE. */
  itcEligiblePercent?: string | null
  sourceLinkType?: VendorAdjustmentSourceLinkType | null
  sourceDocumentId?: string | null
  sourceDocumentNumber?: string | null
  sourceDocumentLineId?: string | null
}

export interface VendorAdjustmentCalculationInput {
  legalEntityId: string
  /** Required for sync calculation — loaded from LE in the (future) validation preview when omitted. */
  companyStateCode?: string | null
  vendorId?: string
  vendorStateCode?: string | null
  placeOfSupply?: string | null
  /** Manual override — validated against derived supply type. */
  supplyType?: VendorAdjustmentPurchaseSupplyType
  adjustmentType: VendorAdjustmentType
  taxEffect: VendorAdjustmentTaxEffect
  itcTreatment?: VendorAdjustmentItcTreatment
  itcEligiblePercent?: string
  tdsTreatment?: VendorAdjustmentTdsTreatment
  purchaseTaxTreatment: VendorInvoiceTaxTreatment
  tdsSectionCode?: string | null
  tdsRate?: string
  /** Overrides the default TDS base (taxableAmount) when supplied. */
  tdsBaseOverride?: string
  currencyCode?: string
  exchangeRate?: string
  invoiceDiscountType?: VendorAdjustmentHeaderDiscountType
  invoiceDiscountValue?: string
  freightAmount?: string
  freightGstRate?: string | null
  otherChargeAmount?: string
  otherChargeGstRate?: string | null
  /** Supplier's own invoice number — normalized (via normalizeSupplierReferenceNumber) and fed to the duplicate detector. */
  supplierReferenceNumber?: string
  /** Supplier reference date for duplicate fuzzy matching. */
  documentDate?: string
  postingDate?: string
  configuration?: VendorAdjustmentCalculationConfiguration
  lines: VendorAdjustmentCalculationLineInput[]
}

/**
 * Carried by the async orchestrator (Phase 4A2) — not required for pure sync amount calculation.
 * include* flags default to true whenever tenantId is present; callers doing pure/offline
 * calculation (tests, previews without a tenant) should pass them explicitly as false.
 */
export interface VendorAdjustmentCalculationContext {
  tenantId: string
  legalEntityId: string
  vendorAdjustmentId?: string | null
  userId?: string | null
  includeDuplicateDetection?: boolean
  includeAccountReadiness?: boolean
  includeAccountingPreview?: boolean
}

export interface VendorAdjustmentCalculatedLine {
  lineNumber: number
  lineType: VendorAdjustmentLineType
  description: string
  itemId: string | null
  itemCodeSnapshot: string | null
  itemNameSnapshot: string | null
  hsnSacCode: string | null
  quantity: string
  uomId: string | null
  uomCodeSnapshot: string | null
  unitPrice: string
  grossAmount: string
  discountPercent: string
  discountAmount: string
  taxableAmount: string
  cgstRate: string
  cgstAmount: string
  sgstRate: string
  sgstAmount: string
  igstRate: string
  igstAmount: string
  cessRate: string
  cessAmount: string
  /** Portion of (cgst+sgst+igst+cess) that is creditable, per effective ITC eligibility. */
  recoverableTaxAmount: string
  /** Portion of (cgst+sgst+igst+cess) folded into cost (debit/purchase account) instead of input tax accounts. */
  nonRecoverableTaxAmount: string
  lineTotal: string
  isTaxInclusive: boolean
  /** True when this line's effective tax treatment is REVERSE_CHARGE — its tax is self-assessed, not part of lineTotal. */
  isReverseCharge: boolean
  itcEligibility: InputTaxCreditEligibility
  itcEligiblePercent: string
  offsetAccountId: string | null
  costCentreId: string | null
  projectReference: string | null
  departmentReference: string | null
  purchaseTaxTreatment: VendorInvoiceTaxTreatment
  sourceLinkType: VendorAdjustmentSourceLinkType | null
  sourceDocumentId: string | null
  sourceDocumentNumber: string | null
  sourceDocumentLineId: string | null
}

/** Transaction-currency totals — mirrors VendorAdjustment header columns plus calculation-only RCM/TDS breakdowns. */
export interface VendorAdjustmentCalculationTotals {
  grossAmount: string
  discountAmount: string
  taxableAmount: string
  inputCgstAmount: string
  inputSgstAmount: string
  inputIgstAmount: string
  inputCessAmount: string
  otherRecoverableTaxAmount: string
  nonRecoverableTaxAmount: string
  freightAmount: string
  freightTaxableAmount: string
  freightCgstAmount: string
  freightSgstAmount: string
  freightIgstAmount: string
  otherChargeAmount: string
  otherChargeTaxableAmount: string
  otherChargeCgstAmount: string
  otherChargeSgstAmount: string
  otherChargeIgstAmount: string
  preRoundTotal: string
  roundOffAmount: string
  adjustmentGrandTotal: string
  /** Self-assessed reverse-charge tax — already included in input*Amount for reporting, tracked separately for RCM-payable posting. */
  rcmCgstAmount: string
  rcmSgstAmount: string
  rcmIgstAmount: string
  rcmCessAmount: string
  rcmTotalTaxAmount: string
  tdsBaseAmount: string
  tdsAmount: string
  /** Non-zero for AT_PAYMENT mode — informational only, not deducted from vendorPayableAmount. */
  estimatedTdsAmount: string
  vendorPayableAmount: string
}

export type VendorAdjustmentCalculationBaseTotals = VendorAdjustmentCalculationTotals

export type VendorAdjustmentDuplicateRiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'EXACT_BLOCKING'

/** One prior vendor invoice that matched the duplicate scan — exact number match or fuzzy date/amount match. */
export interface VendorAdjustmentDuplicateMatch {
  vendorAdjustmentId: string
  draftReference: string
  vendorAdjustmentNumber: string | null
  supplierReferenceNumber: string
  supplierReferenceDate: string
  status: VendorAdjustmentStatus
  adjustmentGrandTotal: string
  matchingSignals: string[]
}

/** Populated by the duplicate detector (Phase 4A2) — NONE/empty from the pure calculation core. */
export interface VendorAdjustmentDuplicateAssessment {
  riskLevel: VendorAdjustmentDuplicateRiskLevel
  isBlocking: boolean
  normalizedSupplierReferenceNumber: string
  matches: VendorAdjustmentDuplicateMatch[]
}

/** GL account slots the accounting preview may need to post to. */
export type VendorAdjustmentAccountComponent =
  | 'LINE_OFFSET'
  | 'INPUT_CGST'
  | 'INPUT_SGST'
  | 'INPUT_IGST'
  | 'INPUT_CESS'
  | 'VENDOR_PAYABLE'
  | 'TDS_PAYABLE'
  | 'FREIGHT'
  | 'OTHER_CHARGE'
  | 'ROUND_OFF'
  | 'RCM_CGST_PAYABLE'
  | 'RCM_SGST_PAYABLE'
  | 'RCM_IGST_PAYABLE'

export type VendorAdjustmentAccountSource = 'EXPLICIT' | 'LINE_OVERRIDE' | 'DEFAULT_MAPPING' | 'UNRESOLVED'

/** One resolved (or unresolved) GL account slot — one entry per line for LINE_OFFSET, one entry otherwise. */
export interface VendorAdjustmentResolvedAccount {
  component: VendorAdjustmentAccountComponent
  lineNumber: number | null
  isRequired: boolean
  source: VendorAdjustmentAccountSource
  accountId: string | null
  accountCode: string | null
  accountName: string | null
  isValid: boolean
  issueCode: string | null
  issueMessage: string | null
}

/** Populated by the account resolver (Phase 4A2) — drives readiness of the accounting preview/posting. */
export interface VendorAdjustmentAccountReadiness {
  isReady: boolean
  resolvedAccounts: VendorAdjustmentResolvedAccount[]
  issues: VendorAdjustmentValidationIssue[]
}

export type VendorAdjustmentAccountingPreviewDirection = 'DEBIT' | 'CREDIT'

export interface VendorAdjustmentAccountingPreviewLine {
  lineNumber: number
  component: VendorAdjustmentAccountComponent
  direction: VendorAdjustmentAccountingPreviewDirection
  accountId: string | null
  accountCode: string | null
  accountName: string | null
  description: string
  debitAmount: string
  creditAmount: string
  partyType: 'VENDOR' | null
  partyId: string | null
  costCentreId: string | null
  sourceLineNumber: number | null
}

/** Populated by the accounting preview builder (Phase 4A2) — draft journal lines, not posted. */
export interface VendorAdjustmentAccountingPreview {
  isBalanced: boolean
  lines: VendorAdjustmentAccountingPreviewLine[]
  totalDebit: string
  totalCredit: string
  difference: string
  vendorPayableCreditAmount: string
  issues: VendorAdjustmentValidationIssue[]
}

export interface VendorAdjustmentCalculationValidation {
  isValid: boolean
  errors: VendorAdjustmentValidationIssue[]
  warnings: VendorAdjustmentValidationIssue[]
  information: VendorAdjustmentValidationIssue[]
}

/** Serializable summary persisted to VendorAdjustment.calculationSnapshot. */
export interface VendorAdjustmentCalculationSnapshot {
  calculationVersion: number
  derivedSupplyType: VendorAdjustmentPurchaseSupplyType
  supplyType: VendorAdjustmentPurchaseSupplyType
  purchaseTaxTreatment: VendorInvoiceTaxTreatment
  isReverseCharge: boolean
  totals: VendorAdjustmentCalculationTotals
  baseTotals: VendorAdjustmentCalculationBaseTotals
  lineCount: number
  calculatedAt: string
  duplicateRiskLevel: VendorAdjustmentDuplicateRiskLevel
  isDuplicateBlocking: boolean
  isAccountReadinessReady: boolean
  isAccountingPreviewBalanced: boolean
  validationErrorCodes: string[]
  validationWarningCodes: string[]
  vendorPayableAccountId: string | null
  tdsPayableAccountId: string | null
}

export interface VendorAdjustmentCalculationResult {
  calculationVersion: number
  derivedSupplyType: VendorAdjustmentPurchaseSupplyType
  supplyType: VendorAdjustmentPurchaseSupplyType
  isReverseCharge: boolean
  totals: VendorAdjustmentCalculationTotals
  baseTotals: VendorAdjustmentCalculationBaseTotals
  lines: VendorAdjustmentCalculatedLine[]
  duplicateAssessment: VendorAdjustmentDuplicateAssessment
  accountReadiness: VendorAdjustmentAccountReadiness
  accountingPreview: VendorAdjustmentAccountingPreview
  validation: VendorAdjustmentCalculationValidation
  snapshot: VendorAdjustmentCalculationSnapshot
}
