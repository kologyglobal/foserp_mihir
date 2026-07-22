import type {
  InputTaxCreditEligibility,
  TdsRecognitionMode,
  VendorInvoiceLineType,
  VendorInvoiceSourceLinkType,
  VendorInvoiceStatus,
  VendorInvoiceTaxTreatment,
} from '@prisma/client'

/** Bumped whenever calculation semantics change — persisted on VendorInvoice.calculationVersion. */
export const VENDOR_INVOICE_CALCULATION_VERSION = 1

export type VendorInvoiceLineDiscountType = 'PERCENTAGE' | 'AMOUNT'
export type VendorInvoiceHeaderDiscountType = 'PERCENTAGE' | 'AMOUNT'
export type VendorInvoiceRoundingMode = 'NONE' | 'NEAREST_UNIT' | 'NEAREST_0_05' | 'MANUAL'

/** AP supply type is binary — zero-tax treatments (NON_GST/EXEMPT/NIL_RATED) short-circuit tax math instead of adding a third member. */
export type VendorInvoicePurchaseSupplyType = 'INTRA_STATE' | 'INTER_STATE'

export type VendorInvoiceValidationSeverity = 'ERROR' | 'WARNING' | 'INFO'

export interface VendorInvoiceValidationIssue {
  code: string
  message: string
  field?: string
  severity: VendorInvoiceValidationSeverity
}

/** Minimal id/code/name reference — mirrors Account rows without depending on Prisma's Account type here. */
export interface VendorInvoiceAccountRef {
  id: string
  code: string
  name: string
}

/**
 * Test/preview seam — lets callers inject resolved accounts instead of hitting the DB.
 * Populated by the (future) account resolver in normal operation.
 */
export interface VendorInvoiceCalculationAccountsOverride {
  vendorPayable?: VendorInvoiceAccountRef | null
  purchaseOrDebit?: VendorInvoiceAccountRef | null
  inputCgst?: VendorInvoiceAccountRef | null
  inputSgst?: VendorInvoiceAccountRef | null
  inputIgst?: VendorInvoiceAccountRef | null
  inputCess?: VendorInvoiceAccountRef | null
  tdsPayable?: VendorInvoiceAccountRef | null
  freight?: VendorInvoiceAccountRef | null
  otherCharge?: VendorInvoiceAccountRef | null
  roundOff?: VendorInvoiceAccountRef | null
  rcmCgstPayable?: VendorInvoiceAccountRef | null
  rcmSgstPayable?: VendorInvoiceAccountRef | null
  rcmIgstPayable?: VendorInvoiceAccountRef | null
}

export interface VendorInvoiceCalculationConfiguration {
  roundingMode?: VendorInvoiceRoundingMode
  manualRoundOff?: string
  roundingTolerance?: string
  /** Legal-entity base currency — defaults to INR when omitted. */
  baseCurrencyCode?: string
  accounts?: VendorInvoiceCalculationAccountsOverride
}

export interface VendorInvoiceCalculationLineInput {
  lineNumber: number
  lineType: VendorInvoiceLineType
  description: string
  itemId?: string | null
  itemCodeSnapshot?: string | null
  itemNameSnapshot?: string | null
  hsnSacCode?: string | null
  quantity: string
  uomId?: string | null
  uomCodeSnapshot?: string | null
  unitPrice: string
  lineDiscountType?: VendorInvoiceLineDiscountType
  lineDiscountValue?: string
  /** Combined GST rate — split into CGST/SGST or IGST by supply type when explicit rates are absent. */
  gstRate?: string
  /** Explicit component rates — take precedence over gstRate when any is present. */
  cgstRate?: string
  sgstRate?: string
  igstRate?: string
  cessRate?: string
  isTaxInclusive?: boolean
  debitAccountId?: string | null
  costCentreId?: string | null
  projectReference?: string | null
  departmentReference?: string | null
  /** Line-level override of the header tax treatment (e.g. a single RCM freight line on an otherwise REGULAR bill). */
  taxTreatment?: VendorInvoiceTaxTreatment | null
  /** Line-level override of the header ITC eligibility. */
  itcEligibility?: InputTaxCreditEligibility | null
  /** Required when effective itcEligibility resolves to PARTIALLY_ELIGIBLE. */
  itcEligiblePercent?: string | null
  sourceLinkType?: VendorInvoiceSourceLinkType | null
  sourceDocumentId?: string | null
  sourceDocumentNumber?: string | null
  sourceDocumentLineId?: string | null
}

export interface VendorInvoiceCalculationInput {
  legalEntityId: string
  /** Required for sync calculation — loaded from LE in the (future) validation preview when omitted. */
  companyStateCode?: string | null
  vendorId?: string
  vendorStateCode?: string | null
  placeOfSupply?: string | null
  /** Manual override — validated against derived supply type. */
  supplyType?: VendorInvoicePurchaseSupplyType
  taxTreatment: VendorInvoiceTaxTreatment
  itcEligibility?: InputTaxCreditEligibility
  /** Required when itcEligibility resolves to PARTIALLY_ELIGIBLE and no line-level override exists. */
  itcEligiblePercent?: string
  tdsRecognitionMode?: TdsRecognitionMode
  tdsSectionCode?: string | null
  tdsRate?: string
  /** Overrides the default TDS base (taxableAmount) when supplied. */
  tdsBaseOverride?: string
  currencyCode?: string
  exchangeRate?: string
  invoiceDiscountType?: VendorInvoiceHeaderDiscountType
  invoiceDiscountValue?: string
  freightAmount?: string
  freightGstRate?: string | null
  otherChargeAmount?: string
  otherChargeGstRate?: string | null
  /** Supplier's own invoice number — normalized (via normalizeSupplierInvoiceNumber) and fed to the duplicate detector. */
  supplierInvoiceNumber?: string
  /** Also treated as the supplier invoice date for duplicate fuzzy (date + amount) matching. */
  invoiceDate?: string
  postingDate?: string
  configuration?: VendorInvoiceCalculationConfiguration
  lines: VendorInvoiceCalculationLineInput[]
}

/**
 * Carried by the async orchestrator (Phase 4A2) — not required for pure sync amount calculation.
 * include* flags default to true whenever tenantId is present; callers doing pure/offline
 * calculation (tests, previews without a tenant) should pass them explicitly as false.
 */
export interface VendorInvoiceCalculationContext {
  tenantId: string
  legalEntityId: string
  vendorInvoiceId?: string | null
  userId?: string | null
  includeDuplicateDetection?: boolean
  includeAccountReadiness?: boolean
  includeAccountingPreview?: boolean
}

export interface VendorInvoiceCalculatedLine {
  lineNumber: number
  lineType: VendorInvoiceLineType
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
  debitAccountId: string | null
  costCentreId: string | null
  projectReference: string | null
  departmentReference: string | null
  taxTreatment: VendorInvoiceTaxTreatment
  sourceLinkType: VendorInvoiceSourceLinkType | null
  sourceDocumentId: string | null
  sourceDocumentNumber: string | null
  sourceDocumentLineId: string | null
}

/** Transaction-currency totals — mirrors VendorInvoice header columns plus calculation-only RCM/TDS breakdowns. */
export interface VendorInvoiceCalculationTotals {
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
  invoiceGrandTotal: string
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

export type VendorInvoiceCalculationBaseTotals = VendorInvoiceCalculationTotals

export type VendorInvoiceDuplicateRiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'EXACT_BLOCKING'

/** One prior vendor invoice that matched the duplicate scan — exact number match or fuzzy date/amount match. */
export interface VendorInvoiceDuplicateMatch {
  vendorInvoiceId: string
  draftReference: string
  vendorInvoiceNumber: string | null
  supplierInvoiceNumber: string
  supplierInvoiceDate: string
  status: VendorInvoiceStatus
  invoiceGrandTotal: string
  matchingSignals: string[]
}

/** Populated by the duplicate detector (Phase 4A2) — NONE/empty from the pure calculation core. */
export interface VendorInvoiceDuplicateAssessment {
  riskLevel: VendorInvoiceDuplicateRiskLevel
  isBlocking: boolean
  normalizedSupplierInvoiceNumber: string
  matches: VendorInvoiceDuplicateMatch[]
}

/** GL account slots the accounting preview may need to post to. */
export type VendorInvoiceAccountComponent =
  | 'LINE_DEBIT'
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

export type VendorInvoiceAccountSource = 'EXPLICIT' | 'LINE_OVERRIDE' | 'DEFAULT_MAPPING' | 'UNRESOLVED'

/** One resolved (or unresolved) GL account slot — one entry per line for LINE_DEBIT, one entry otherwise. */
export interface VendorInvoiceResolvedAccount {
  component: VendorInvoiceAccountComponent
  lineNumber: number | null
  isRequired: boolean
  source: VendorInvoiceAccountSource
  accountId: string | null
  accountCode: string | null
  accountName: string | null
  isValid: boolean
  issueCode: string | null
  issueMessage: string | null
}

/** Populated by the account resolver (Phase 4A2) — drives readiness of the accounting preview/posting. */
export interface VendorInvoiceAccountReadiness {
  isReady: boolean
  resolvedAccounts: VendorInvoiceResolvedAccount[]
  issues: VendorInvoiceValidationIssue[]
}

export type VendorInvoiceAccountingPreviewDirection = 'DEBIT' | 'CREDIT'

export interface VendorInvoiceAccountingPreviewLine {
  lineNumber: number
  component: VendorInvoiceAccountComponent
  direction: VendorInvoiceAccountingPreviewDirection
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
export interface VendorInvoiceAccountingPreview {
  isBalanced: boolean
  lines: VendorInvoiceAccountingPreviewLine[]
  totalDebit: string
  totalCredit: string
  difference: string
  vendorPayableCreditAmount: string
  issues: VendorInvoiceValidationIssue[]
}

export interface VendorInvoiceCalculationValidation {
  isValid: boolean
  errors: VendorInvoiceValidationIssue[]
  warnings: VendorInvoiceValidationIssue[]
  information: VendorInvoiceValidationIssue[]
}

/** Serializable summary persisted to VendorInvoice.calculationSnapshot. */
export interface VendorInvoiceCalculationSnapshot {
  calculationVersion: number
  derivedSupplyType: VendorInvoicePurchaseSupplyType
  supplyType: VendorInvoicePurchaseSupplyType
  taxTreatment: VendorInvoiceTaxTreatment
  isReverseCharge: boolean
  totals: VendorInvoiceCalculationTotals
  baseTotals: VendorInvoiceCalculationBaseTotals
  lineCount: number
  calculatedAt: string
  duplicateRiskLevel: VendorInvoiceDuplicateRiskLevel
  isDuplicateBlocking: boolean
  isAccountReadinessReady: boolean
  isAccountingPreviewBalanced: boolean
  validationErrorCodes: string[]
  validationWarningCodes: string[]
  vendorPayableAccountId: string | null
  tdsPayableAccountId: string | null
}

export interface VendorInvoiceCalculationResult {
  calculationVersion: number
  derivedSupplyType: VendorInvoicePurchaseSupplyType
  supplyType: VendorInvoicePurchaseSupplyType
  isReverseCharge: boolean
  totals: VendorInvoiceCalculationTotals
  baseTotals: VendorInvoiceCalculationBaseTotals
  lines: VendorInvoiceCalculatedLine[]
  duplicateAssessment: VendorInvoiceDuplicateAssessment
  accountReadiness: VendorInvoiceAccountReadiness
  accountingPreview: VendorInvoiceAccountingPreview
  validation: VendorInvoiceCalculationValidation
  snapshot: VendorInvoiceCalculationSnapshot
}
