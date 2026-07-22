/**
 * Money Out / AP vendor-invoice frontend types — Phase 4A5.
 * Aligns with backend payables vendor-invoice API (4A3–4A4).
 */

export type VendorInvoiceStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'REJECTED'
  | 'READY_TO_POST'
  | 'POSTED'
  | 'CANCELLED'
  | 'REVERSED'

export type VendorInvoiceType = 'GOODS' | 'SERVICE' | 'EXPENSE' | 'ASSET' | 'MIXED'
export type VendorInvoiceTaxTreatment =
  | 'REGULAR'
  | 'REVERSE_CHARGE'
  | 'IMPORT_GOODS'
  | 'IMPORT_SERVICE'
  | 'SEZ'
  | 'NON_GST'
  | 'EXEMPT'
  | 'NIL_RATED'
export type InputTaxCreditEligibility = 'PENDING_REVIEW' | 'ELIGIBLE' | 'PARTIALLY_ELIGIBLE' | 'INELIGIBLE'
export type TdsRecognitionMode = 'NOT_APPLICABLE' | 'AT_INVOICE' | 'AT_PAYMENT'
/** Backend Prisma / calculation line types — GOODS invoices use ITEM lines. */
export type VendorInvoiceLineType =
  | 'ITEM'
  | 'SERVICE'
  | 'EXPENSE'
  | 'ASSET'
  | 'FREIGHT'
  | 'OTHER_CHARGE'
export type VendorInvoicePurchaseSupplyType = 'INTRA_STATE' | 'INTER_STATE'
export type VendorInvoiceSourceLinkType =
  | 'PURCHASE_ORDER'
  | 'GOODS_RECEIPT'
  | 'PURCHASE_RECEIPT'
  | 'CONTRACT'
  | 'PROJECT'
  | 'OTHER'

export interface VendorInvoiceAllowedActions {
  view: boolean
  edit: boolean
  validate: boolean
  submit: boolean
  markReady: boolean
  approve: boolean
  reject: boolean
  revise: boolean
  cancel: boolean
  post: boolean
  reverse: boolean
  viewApproval: boolean
  viewAccountingPreview: boolean
  viewAccounting: boolean
  viewPayableOpenItem: boolean
  pay: boolean
  allocate: boolean
}

export interface VendorInvoiceValidationIssue {
  code: string
  message: string
  field?: string
  severity: 'ERROR' | 'WARNING' | 'INFO'
}

export interface VendorInvoiceDuplicateAssessment {
  riskLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'EXACT_BLOCKING'
  isBlocking: boolean
  matches?: Array<{
    vendorInvoiceId: string
    draftReference?: string | null
    vendorInvoiceNumber?: string | null
    supplierInvoiceNumber?: string | null
    status?: string
    invoiceGrandTotal?: string
    documentDate?: string
  }>
  message?: string | null
}

export interface VendorInvoiceResolvedAccount {
  component: string
  lineNumber: number | null
  isRequired: boolean
  source: string
  accountId: string | null
  accountCode: string | null
  accountName: string | null
  isValid: boolean
  issueCode?: string | null
  issueMessage?: string | null
}

export interface VendorInvoiceAccountReadiness {
  isReady: boolean
  resolvedAccounts: VendorInvoiceResolvedAccount[]
  issues: VendorInvoiceValidationIssue[]
}

export interface VendorInvoiceAccountingPreviewLine {
  lineNumber: number
  component: string
  direction: 'DEBIT' | 'CREDIT'
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

export interface VendorInvoiceAccountingPreview {
  isBalanced: boolean
  lines: VendorInvoiceAccountingPreviewLine[]
  totalDebit: string
  totalCredit: string
  difference: string
  vendorPayableCreditAmount: string
  issues: VendorInvoiceValidationIssue[]
}

export interface VendorInvoiceLineDto {
  id: string
  lineNumber: number
  lineType: VendorInvoiceLineType
  itemId?: string | null
  itemCodeSnapshot?: string | null
  itemNameSnapshot?: string | null
  description: string
  hsnSacCode?: string | null
  quantity: string
  uomCodeSnapshot?: string | null
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
  otherRecoverableTaxAmount: string
  nonRecoverableTaxAmount: string
  lineTotal: string
  debitAccountId?: string | null
  costCentreId?: string | null
  projectReference?: string | null
  departmentReference?: string | null
}

export interface VendorInvoiceSourceLinkDto {
  id: string
  sourceType: VendorInvoiceSourceLinkType
  sourceDocumentId: string
  sourceDocumentNumberSnapshot?: string | null
  sourceDocumentDateSnapshot?: string | null
}

export interface VendorInvoiceApprovalSummary {
  id: string
  status: string
  currentLevel: number
  totalLevels: number
  requestedBy?: string | null
  requestedAt?: string
  completedAt?: string | null
  completedBy?: string | null
  documentStatusSnapshot?: string | null
}

export interface VendorInvoiceDto {
  id: string
  tenantId: string
  legalEntityId: string
  branchId?: string | null
  vendorId: string
  financialYearId: string
  draftReference: string
  vendorInvoiceNumber: string | null
  supplierInvoiceNumber: string
  supplierInvoiceNumberNormalized: string
  supplierInvoiceDate: string
  invoiceType: VendorInvoiceType
  status: VendorInvoiceStatus
  taxTreatment: VendorInvoiceTaxTreatment
  itcEligibility: InputTaxCreditEligibility
  tdsRecognitionMode: TdsRecognitionMode
  documentDate: string
  postingDate: string | null
  dueDate: string | null
  currencyCode: string
  exchangeRate: string
  vendorCodeSnapshot: string
  vendorNameSnapshot: string
  vendorGstinSnapshot?: string | null
  vendorPanSnapshot?: string | null
  vendorStateCodeSnapshot?: string | null
  companyGstinSnapshot?: string | null
  companyStateCodeSnapshot?: string | null
  placeOfSupplyStateCode?: string | null
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
  otherChargeAmount: string
  roundOffAmount: string
  invoiceGrandTotal: string
  tdsSectionCode?: string | null
  tdsRate: string
  tdsBaseAmount: string
  tdsAmount: string
  vendorPayableAmount: string
  baseInvoiceGrandTotal: string
  baseVendorPayableAmount: string
  approvalRequired: boolean
  approvalRequestId?: string | null
  calculationVersion: number
  accountingVoucherId?: string | null
  postingEventId?: string | null
  accountingVoucherNumber?: string | null
  ledgerEntryCount?: number
  payableOpenItemId?: string | null
  payableOpenItemStatus?: string | null
  payableOriginalAmount?: string | null
  payableOutstandingAmount?: string | null
  postedAt?: string | null
  postedBy?: string | null
  readyToPostAt?: string | null
  submittedAt?: string | null
  approvedAt?: string | null
  rejectedAt?: string | null
  cancelledAt?: string | null
  cancellationReason?: string | null
  createdAt: string
  updatedAt: string
  lines: VendorInvoiceLineDto[]
  sourceLinks?: VendorInvoiceSourceLinkDto[]
  approvalRequest?: VendorInvoiceApprovalSummary | null
  validation?: {
    isValid: boolean
    errors: VendorInvoiceValidationIssue[]
    warnings: VendorInvoiceValidationIssue[]
    duplicateAssessment?: VendorInvoiceDuplicateAssessment
    accountReadiness?: VendorInvoiceAccountReadiness
  } | null
  accountingPreviewSnapshot?: VendorInvoiceAccountingPreview | null
  allowedActions: VendorInvoiceAllowedActions
}

export interface VendorInvoiceLineInput {
  lineNumber: number
  lineType: VendorInvoiceLineType
  description: string
  itemId?: string | null
  itemCodeSnapshot?: string | null
  itemNameSnapshot?: string | null
  hsnSacCode?: string | null
  quantity: string
  unitPrice: string
  lineDiscountType?: 'PERCENTAGE' | 'AMOUNT'
  lineDiscountValue?: string
  gstRate?: string
  cgstRate?: string
  sgstRate?: string
  igstRate?: string
  cessRate?: string
  debitAccountId?: string | null
  costCentreId?: string | null
  projectReference?: string | null
  departmentReference?: string | null
  taxTreatment?: VendorInvoiceTaxTreatment | null
  itcEligibility?: InputTaxCreditEligibility | null
  itcEligiblePercent?: string | null
}

export interface VendorInvoiceSourceLinkInput {
  sourceType: VendorInvoiceSourceLinkType
  sourceDocumentId: string
  sourceDocumentNumberSnapshot?: string | null
  sourceDocumentDateSnapshot?: string | null
}

export interface CreateVendorInvoiceInput {
  legalEntityId: string
  branchId?: string | null
  vendorId: string
  invoiceType: VendorInvoiceType
  supplierInvoiceNumber: string
  supplierInvoiceDate: string
  documentDate: string
  dueDate?: string | null
  postingDate?: string
  currencyCode?: string
  exchangeRate?: string
  taxTreatment?: VendorInvoiceTaxTreatment
  itcEligibility?: InputTaxCreditEligibility
  itcEligiblePercent?: string
  tdsRecognitionMode?: TdsRecognitionMode
  tdsSectionCode?: string | null
  tdsRate?: string
  tdsBaseOverride?: string
  supplyType?: VendorInvoicePurchaseSupplyType
  placeOfSupply?: string | null
  companyStateCode?: string | null
  vendorStateCode?: string | null
  freightAmount?: string
  freightGstRate?: string | null
  otherChargeAmount?: string
  otherChargeGstRate?: string | null
  approvalRequiredOverride?: boolean
  paymentTermsDays?: number | null
  paymentTerms?: string | null
  lines: VendorInvoiceLineInput[]
  sourceLinks?: VendorInvoiceSourceLinkInput[]
  configuration?: {
    roundingMode?: 'NONE' | 'NEAREST_UNIT' | 'NEAREST_0_05' | 'MANUAL'
    manualRoundOff?: string
  }
}

export interface UpdateVendorInvoiceInput extends Omit<CreateVendorInvoiceInput, 'legalEntityId'> {
  expectedUpdatedAt: string
}

export interface ListVendorInvoicesQuery {
  legalEntityId: string
  branchId?: string
  vendorId?: string
  invoiceType?: VendorInvoiceType
  status?: VendorInvoiceStatus
  search?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedVendorInvoices {
  items: VendorInvoiceDto[]
  page: number
  limit: number
  total: number
  totalPages: number
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
}

export interface VendorInvoiceApprovalDetail {
  approvalRequest: VendorInvoiceApprovalSummary | null
  steps: Array<{
    id: string
    level: number
    sequence: number
    status: string
    actedBy?: string | null
    actedAt?: string | null
    comments?: string | null
  }>
}

/* ────────────────────────────────────────────────────────────────────────────
 * Vendor payments / advances / allocations — Phase 4B5
 * Aligns with backend payables vendor-payment API (4B1–4B4) + allocation (4B4).
 * ──────────────────────────────────────────────────────────────────────────── */

export type VendorPaymentStatus = VendorInvoiceStatus
export type VendorPaymentPurpose = 'INVOICE_SETTLEMENT' | 'ADVANCE' | 'MIXED'
export type VendorPaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'CHEQUE' | 'UPI' | 'CARD' | 'OTHER'

export type VendorPaymentAdjustmentType =
  | 'TDS'
  | 'DISCOUNT'
  | 'RETENTION'
  | 'WITHHOLDING'
  | 'BANK_CHARGE'
  | 'PROCESSING_CHARGE'
  | 'ROUND_OFF'
  | 'OTHER'

export type VendorPaymentAdjustmentAccountingRole =
  | 'SETTLEMENT_CREDIT'
  | 'PAYMENT_EXPENSE_DEBIT'
  | 'ROUND_OFF_DEBIT'
  | 'ROUND_OFF_CREDIT'
  | 'INFORMATION_ONLY'

export type VendorPaymentAllocationState =
  | 'UNALLOCATED'
  | 'PARTIALLY_ALLOCATED'
  | 'FULLY_ALLOCATED'

export interface VendorPaymentAllowedActions {
  view: boolean
  edit: boolean
  validate: boolean
  submit: boolean
  markReady: boolean
  approve: boolean
  reject: boolean
  revise: boolean
  cancel: boolean
  post: boolean
  reverse: boolean
  viewApproval: boolean
  viewAccountingPreview: boolean
  viewAccounting: boolean
  viewPayableOpenItem: boolean
  allocate: boolean
}

export interface VendorPaymentValidationIssue {
  code: string
  message: string
  field?: string | null
  adjustmentLineId?: string | null
  lineNumber?: number | null
  severity: 'ERROR' | 'WARNING' | 'INFO'
  metadata?: Record<string, unknown>
}

export interface VendorPaymentAdjustmentLineDto {
  id: string
  lineNumber: number
  adjustmentType: VendorPaymentAdjustmentType
  accountingRole: VendorPaymentAdjustmentAccountingRole
  description: string
  amount: string
  baseAmount: string
  calculationBaseAmount: string | null
  rate: string | null
  sectionCode?: string | null
  statutoryReference?: string | null
  accountId?: string | null
  costCentreId?: string | null
  projectReference?: string | null
  departmentReference?: string | null
}

export interface VendorPaymentPositionResult {
  vendorCreditOutstanding: string
  vendorDebitOutstanding: string
  netVendorPayable: string
  baseVendorCreditOutstanding: string
  baseVendorDebitOutstanding: string
  baseNetVendorPayable: string
  proposedVendorSettlementAmount: string
  excessSettlementAmount: string
  purposeConsistent: boolean
  suggestedPurpose: VendorPaymentPurpose | null
}

export interface VendorPaymentResolvedAccount {
  component: string
  adjustmentLineId?: string | null
  lineNumber?: number | null
  accountId: string | null
  accountCode: string | null
  accountName: string | null
  source: string
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

export interface VendorPaymentAccountingPreviewLine {
  sequence: number
  component: string
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

export interface VendorPaymentValidationSnapshot {
  isValid: boolean
  errors: VendorPaymentValidationIssue[]
  warnings: VendorPaymentValidationIssue[]
  paymentPosition?: VendorPaymentPositionResult
  accountReadiness?: VendorPaymentAccountReadiness
  accountingPreview?: VendorPaymentAccountingPreview
  openItemPreview?: VendorPaymentOpenItemPreview
}

export interface VendorPaymentDto {
  id: string
  tenantId: string
  legalEntityId: string
  branchId?: string | null
  vendorId: string
  financialYearId: string
  draftReference: string
  vendorPaymentNumber: string | null
  status: VendorPaymentStatus
  paymentPurpose: VendorPaymentPurpose
  paymentMethod: VendorPaymentMethod
  documentDate: string
  paymentDate: string
  proposedPostingDate: string | null
  valueDate: string | null
  dueReferenceDate: string | null
  currencyCode: string
  exchangeRate: string
  vendorCodeSnapshot: string
  vendorNameSnapshot: string
  vendorGstinSnapshot?: string | null
  vendorPanSnapshot?: string | null
  vendorStateCodeSnapshot?: string | null
  paymentAccountId?: string | null
  vendorPayableAccountId?: string | null
  tdsPayableAccountId?: string | null
  // Three distinct money concepts (all server-authoritative):
  paymentAmount: string // cash paid directly to vendor
  settlementAdjustmentAmount: string // settles liability without cash (TDS/discount/retention)
  paymentExpenseAmount: string // company expense not reducing vendor liability (bank charge)
  roundOffAmount: string
  vendorSettlementAmount: string // total liability reduced (open-item amount)
  cashOutflowAmount: string // total bank/cash credit
  basePaymentAmount: string
  baseSettlementAdjustmentAmount: string
  basePaymentExpenseAmount: string
  baseRoundOffAmount: string
  baseVendorSettlementAmount: string
  baseCashOutflowAmount: string
  tdsBaseAmount: string
  tdsAmount: string
  baseTdsBaseAmount: string
  baseTdsAmount: string
  paymentReference?: string | null
  bankReference?: string | null
  chequeNumber?: string | null
  chequeDate?: string | null
  instrumentReference?: string | null
  narration?: string | null
  approvalRequired: boolean
  approvalRequestId?: string | null
  calculationVersion?: number
  accountingVoucherId?: string | null
  accountingVoucherNumber?: string | null
  postingEventId?: string | null
  ledgerEntryCount?: number
  payableOpenItemId?: string | null
  payableOpenItemSide?: 'DEBIT' | null
  payableOpenItemDocumentType?: 'VENDOR_PAYMENT' | 'VENDOR_ADVANCE' | null
  payableOpenItemStatus?: string | null
  payableOriginalAmount?: string | null
  payableAllocatedAmount?: string | null
  payableOutstandingAmount?: string | null
  allocationState?: VendorPaymentAllocationState | null
  postedAt?: string | null
  postedBy?: string | null
  readyToPostAt?: string | null
  submittedAt?: string | null
  approvedAt?: string | null
  rejectedAt?: string | null
  cancelledAt?: string | null
  cancellationReason?: string | null
  createdAt: string
  updatedAt: string
  adjustmentLines: VendorPaymentAdjustmentLineDto[]
  approvalRequest?: VendorInvoiceApprovalSummary | null
  validation?: VendorPaymentValidationSnapshot | null
  allowedActions: VendorPaymentAllowedActions
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
}

export interface CreateVendorPaymentInput {
  legalEntityId: string
  branchId?: string | null
  vendorId: string
  paymentPurpose: VendorPaymentPurpose
  paymentMethod: VendorPaymentMethod
  documentDate: string
  paymentDate: string
  proposedPostingDate?: string | null
  valueDate?: string | null
  dueReferenceDate?: string | null
  currencyCode?: string
  exchangeRate?: string
  paymentAmount: string
  paymentAccountId?: string | null
  vendorPayableAccountId?: string | null
  paymentReference?: string | null
  bankReference?: string | null
  chequeNumber?: string | null
  chequeDate?: string | null
  instrumentReference?: string | null
  narration?: string | null
  approvalRequiredOverride?: boolean
  adjustments?: VendorPaymentAdjustmentInput[]
  configuration?: Record<string, unknown>
}

export interface UpdateVendorPaymentInput extends Omit<CreateVendorPaymentInput, 'legalEntityId'> {
  expectedUpdatedAt: string
}

export interface ListVendorPaymentsQuery {
  legalEntityId: string
  branchId?: string
  vendorId?: string
  paymentPurpose?: VendorPaymentPurpose
  paymentMethod?: VendorPaymentMethod
  status?: VendorPaymentStatus
  search?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedVendorPayments {
  items: VendorPaymentDto[]
  page: number
  limit: number
  total: number
  totalPages: number
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
}

export interface VendorPaymentApprovalDetail {
  approvalRequest: VendorInvoiceApprovalSummary | null
  steps: Array<{
    id: string
    level: number
    sequence: number
    status: string
    actedBy?: string | null
    actedAt?: string | null
    comments?: string | null
  }>
}

/* ── Payable allocations (subledger only, no GL) ── */

export interface AllocatableVendorInvoiceItem {
  vendorInvoiceId: string | null
  openItemId: string
  documentNumber: string
  supplierInvoiceNumber: string | null
  documentDate: string | null
  postingDate: string | null
  dueDate: string | null
  currencyCode: string
  exchangeRate: string
  originalAmount: string
  outstandingAmount: string
  baseOutstandingAmount: string
  status: string
  suggestedAllocationAmount: string
  updatedAt: string
}

export interface AllocatableVendorInvoicesResult {
  items: AllocatableVendorInvoiceItem[]
  total: number
  sourceOutstanding: string
  sourceUpdatedAt: string | null
  currencyCode: string
}

export interface CreateVendorPaymentAllocationInput {
  expectedPaymentUpdatedAt?: string
  expectedSourceOpenItemUpdatedAt: string
  allocationDate: string
  idempotencyKey: string
  lines: Array<{
    targetCreditOpenItemId: string
    expectedTargetUpdatedAt: string
    amount: string
  }>
}

export interface PayableOpenItemBalanceDto {
  id: string
  side: 'DEBIT' | 'CREDIT'
  documentType: string
  documentNumber: string
  currencyCode: string
  originalAmount: string
  allocatedAmount: string
  adjustedAmount: string
  writtenOffAmount: string
  outstandingAmount: string
  baseOutstandingAmount: string
  status: string
  settledAt: string | null
  updatedAt: string
}

export interface PayableAllocationBatchDto {
  id: string
  tenantId: string
  legalEntityId: string
  branchId: string | null
  vendorId: string
  allocationReference: string
  sourceDebitOpenItemId: string
  allocationDate: string
  currencyCode: string
  exchangeRate: string
  totalAllocatedAmount: string
  baseTotalAllocatedAmount: string
  status: string
  idempotencyKey: string | null
  payloadHash: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface PayableAllocationLineDto {
  id: string
  allocationBatchId: string
  sourceDebitOpenItemId: string
  targetCreditOpenItemId: string
  amount: string
  baseAmount: string
  reversedAmount: string
  baseReversedAmount: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface PayableAllocationResult {
  batch: PayableAllocationBatchDto
  lines: PayableAllocationLineDto[]
  payment: { id: string; vendorPaymentNumber: string | null }
  sourceBefore: PayableOpenItemBalanceDto
  sourceAfter: PayableOpenItemBalanceDto
  targets: Array<{
    targetCreditOpenItemId: string
    vendorInvoiceId: string | null
    before: PayableOpenItemBalanceDto
    after: PayableOpenItemBalanceDto
  }>
  vendorAdvanceRemaining: string
  idempotentReplay: boolean
}

export interface PayableAllocationHistoryRow {
  batchId: string
  allocationLineId: string
  allocationReference: string
  allocationDate: string
  vendorPaymentId: string | null
  vendorPaymentNumber: string | null
  sourceDebitOpenItemId: string
  targetCreditOpenItemId: string
  vendorInvoiceId: string | null
  vendorInvoiceNumber: string | null
  supplierInvoiceNumber: string | null
  currencyCode: string
  amount: string
  baseAmount: string
  status: string
  createdBy: string | null
  createdAt: string
}

export interface PayableAllocationDetail {
  batch: PayableAllocationBatchDto
  lines: PayableAllocationLineDto[]
  payment: { id: string | null; vendorPaymentNumber: string | null }
  source: {
    openItemId: string
    documentNumber: string
    outstandingAmount: string
    allocatedAmount: string
    status: string
  } | null
  targets: Array<{
    openItemId: string
    vendorInvoiceId: string | null
    documentNumber: string | null
    amount: string
    outstandingAmount: string | null
    status: string | null
  }>
  allowedActions?: { reverse: boolean }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Vendor adjustments (debit notes / credit adjustments) — Phase 4C2
 * ──────────────────────────────────────────────────────────────────────────── */

export type VendorAdjustmentStatus = VendorInvoiceStatus
export type VendorAdjustmentType = 'VENDOR_DEBIT_NOTE' | 'VENDOR_CREDIT_ADJUSTMENT'
export type VendorAdjustmentReason =
  | 'PURCHASE_RETURN'
  | 'RATE_DIFFERENCE'
  | 'SHORT_SUPPLY'
  | 'QUALITY_CLAIM'
  | 'DAMAGE_CLAIM'
  | 'COMMERCIAL_DISCOUNT'
  | 'FREIGHT_RECOVERY'
  | 'TAX_CORRECTION'
  | 'TDS_CORRECTION'
  | 'ROUND_OFF'
  | 'OPENING_CORRECTION'
  | 'OTHER'
export type VendorAdjustmentTaxEffect =
  | 'NONE'
  | 'ADD_RECOVERABLE_INPUT_TAX'
  | 'REVERSE_RECOVERABLE_INPUT_TAX'
  | 'NON_RECOVERABLE_TAX'
  | 'MIXED'
export type VendorAdjustmentItcTreatment =
  | 'NO_ITC_CHANGE'
  | 'FULL_ITC_ADDITION'
  | 'PARTIAL_ITC_ADDITION'
  | 'FULL_ITC_REVERSAL'
  | 'PARTIAL_ITC_REVERSAL'
  | 'NON_RECOVERABLE'
  | 'PENDING_REVIEW'
export type VendorAdjustmentTdsTreatment = 'NO_TDS_CHANGE' | 'ADD_TDS_LIABILITY' | 'REVERSE_TDS_LIABILITY'
export type VendorAdjustmentLineType =
  | 'ITEM'
  | 'SERVICE'
  | 'EXPENSE'
  | 'ASSET'
  | 'FREIGHT'
  | 'OTHER_CHARGE'
  | 'TAX_CORRECTION'
  | 'OTHER'
export type VendorAdjustmentSourceLinkType =
  | 'VENDOR_INVOICE'
  | 'PURCHASE_ORDER'
  | 'GOODS_RECEIPT'
  | 'PURCHASE_RECEIPT'
  | 'CONTRACT'
  | 'PROJECT'
  | 'OTHER'

export interface VendorAdjustmentAllowedActions {
  view: boolean
  edit: boolean
  validate: boolean
  submit: boolean
  markReady: boolean
  approve: boolean
  reject: boolean
  revise: boolean
  cancel: boolean
  post: boolean
  reverse: boolean
  viewApproval: boolean
  viewAccountingPreview: boolean
  viewAccounting: boolean
  viewPayableOpenItem: boolean
  pay: boolean
  allocate: boolean
}

export interface VendorAdjustmentLineDto {
  id: string
  lineNumber: number
  lineType: VendorAdjustmentLineType
  description: string
  itemId?: string | null
  itemCodeSnapshot?: string | null
  itemNameSnapshot?: string | null
  hsnSacCode?: string | null
  quantity: string
  uomCodeSnapshot?: string | null
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
  otherRecoverableTaxAmount: string
  nonRecoverableTaxAmount: string
  lineTotal: string
  offsetAccountId?: string | null
  costCentreId?: string | null
  projectReference?: string | null
  departmentReference?: string | null
}

export interface VendorAdjustmentSourceLinkDto {
  id: string
  sourceType: VendorAdjustmentSourceLinkType
  sourceDocumentId: string
  sourceDocumentNumberSnapshot?: string | null
  sourceDocumentDateSnapshot?: string | null
}

export interface VendorAdjustmentDto {
  id: string
  tenantId: string
  legalEntityId: string
  branchId?: string | null
  vendorId: string
  financialYearId: string
  draftReference: string
  vendorAdjustmentNumber: string | null
  supplierReferenceNumber: string
  supplierReferenceDate: string
  adjustmentType: VendorAdjustmentType
  reason: VendorAdjustmentReason
  status: VendorAdjustmentStatus
  taxEffect: VendorAdjustmentTaxEffect
  itcTreatment: VendorAdjustmentItcTreatment
  tdsTreatment: VendorAdjustmentTdsTreatment
  purchaseTaxTreatment: VendorInvoiceTaxTreatment
  documentDate: string
  postingDate: string | null
  dueDate: string | null
  currencyCode: string
  exchangeRate: string
  vendorCodeSnapshot: string
  vendorNameSnapshot: string
  vendorGstinSnapshot?: string | null
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
  otherChargeAmount: string
  roundOffAmount: string
  adjustmentGrandTotal: string
  tdsBaseAmount: string
  tdsAmount: string
  vendorPayableAmount: string
  approvalRequired: boolean
  approvalRequestId?: string | null
  accountingVoucherId?: string | null
  accountingVoucherNumber?: string | null
  postingEventId?: string | null
  ledgerEntryCount?: number
  payableOpenItemId?: string | null
  payableOpenItemStatus?: string | null
  payableOriginalAmount?: string | null
  payableAllocatedAmount?: string | null
  payableOutstandingAmount?: string | null
  payableSettlementState?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | null
  postedAt?: string | null
  createdAt: string
  updatedAt: string
  lines: VendorAdjustmentLineDto[]
  sourceLinks: VendorAdjustmentSourceLinkDto[]
  approvalRequest?: VendorInvoiceApprovalSummary | null
  validation?: {
    isValid: boolean
    errors: VendorInvoiceValidationIssue[]
    warnings: VendorInvoiceValidationIssue[]
    duplicateAssessment?: VendorInvoiceDuplicateAssessment
    accountReadiness?: VendorInvoiceAccountReadiness
  } | null
  allowedActions: VendorAdjustmentAllowedActions
}

export interface VendorAdjustmentLineInput {
  lineNumber: number
  lineType: VendorAdjustmentLineType
  description: string
  hsnSacCode?: string | null
  quantity?: string
  unitPrice?: string
  discountPercent?: string
  discountAmount?: string
  cgstRate?: string
  sgstRate?: string
  igstRate?: string
  cessRate?: string
  offsetAccountId?: string | null
  costCentreId?: string | null
  projectReference?: string | null
  departmentReference?: string | null
}

export interface CreateVendorAdjustmentInput {
  legalEntityId: string
  branchId?: string | null
  vendorId: string
  adjustmentType: VendorAdjustmentType
  reason?: VendorAdjustmentReason
  supplierReferenceNumber: string
  supplierReferenceDate: string
  documentDate: string
  dueDate?: string | null
  postingDate?: string
  currencyCode?: string
  exchangeRate?: string
  taxEffect?: VendorAdjustmentTaxEffect
  itcTreatment?: VendorAdjustmentItcTreatment
  tdsTreatment?: VendorAdjustmentTdsTreatment
  purchaseTaxTreatment?: VendorInvoiceTaxTreatment
  tdsSectionCode?: string | null
  tdsRate?: string
  supplyType?: VendorInvoicePurchaseSupplyType
  freightAmount?: string
  otherChargeAmount?: string
  approvalRequiredOverride?: boolean
  lines: VendorAdjustmentLineInput[]
  sourceLinks?: Array<{
    sourceType: VendorAdjustmentSourceLinkType
    sourceDocumentId: string
    sourceDocumentNumberSnapshot?: string | null
    sourceDocumentDateSnapshot?: string | null
  }>
}

export interface UpdateVendorAdjustmentInput extends Omit<CreateVendorAdjustmentInput, 'legalEntityId'> {
  expectedUpdatedAt: string
}

export interface ListVendorAdjustmentsQuery {
  legalEntityId: string
  branchId?: string
  vendorId?: string
  adjustmentType?: VendorAdjustmentType
  status?: VendorAdjustmentStatus
  search?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedVendorAdjustments {
  items: VendorAdjustmentDto[]
  page: number
  limit: number
  total: number
  totalPages: number
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
}

export interface VendorAdjustmentApprovalDetail {
  approvalRequest: VendorInvoiceApprovalSummary | null
  steps: Array<{
    id: string
    level: number
    sequence: number
    status: string
    actedBy?: string | null
    actedAt?: string | null
    comments?: string | null
  }>
}

export interface CreateVendorAdjustmentAllocationInput {
  expectedAdjustmentUpdatedAt?: string
  expectedSourceOpenItemUpdatedAt: string
  allocationDate: string
  idempotencyKey: string
  lines: Array<{
    targetCreditOpenItemId: string
    expectedTargetUpdatedAt: string
    amount: string
  }>
}

/* ── AP document reversal (Phase 4C1 + 4C2) ── */

export type ApReversalDocumentType = 'payment' | 'invoice' | 'adjustment' | 'allocation'

export interface ApDocumentReversalPreview {
  eligible: boolean
  requiresAllocationReversal?: boolean
  activeAllocationCount?: number
  activeAllocationAmount?: string
  blockingIssues: string[]
  allowedActions: { reverse: boolean; reverseWithCascade?: boolean }
  originalVoucherId?: string | null
  originalVoucherNumber?: string | null
  openItemId?: string | null
  openItemStatus?: string | null
  proposedReversalSummary?: {
    lineCount: number
    totalDebit: string
    totalCredit: string
  } | null
  /** Allocation-only context loaded client-side when no preview API exists */
  allocationBatchId?: string
  allocationReference?: string
  allocationTotal?: string
  documentLabel?: string
  documentUpdatedAt?: string
}

export interface ReverseApDocumentInput {
  reversalDate: string
  reason: string
  idempotencyKey: string
  expectedUpdatedAt: string
  cascadeAllocationReversals?: boolean
}

export interface ReverseVendorPaymentResult {
  idempotentReplay: boolean
  vendorPaymentId: string
  vendorPaymentNumber: string | null
  status: 'REVERSED'
  reversalVoucherId: string
  reversalVoucherNumber: string | null
  allocationReversals: Array<{ allocationBatchId: string; reversalBatchId: string }>
}

export interface ReverseVendorInvoiceResult {
  idempotentReplay: boolean
  vendorInvoiceId: string
  vendorInvoiceNumber: string | null
  status: 'REVERSED'
  reversalVoucherId: string
  reversalVoucherNumber: string | null
  allocationReversals: Array<{ allocationBatchId: string; reversalBatchId: string }>
}

export interface ReverseVendorAdjustmentResult {
  idempotentReplay: boolean
  vendorAdjustmentId: string
  vendorAdjustmentNumber: string | null
  status: 'REVERSED'
  reversalVoucherId: string
  reversalVoucherNumber: string | null
  allocationReversals: Array<{ allocationBatchId: string; reversalBatchId: string }>
}

export interface ReversePayableAllocationResult {
  idempotentReplay: boolean
  allocationBatchId: string
  reversalBatchId: string
  reversedAmount: string
}

export interface ApReversalHistoryRow {
  id: string
  documentType: ApReversalDocumentType
  documentId: string
  documentNumber: string | null
  reversalDate: string
  reason: string
  reversedBy: string | null
  reversedAt: string
  reversalVoucherNumber: string | null
}

// ─── AP reporting (Phase 4D1) ───────────────────────────────────────────────

export type PayableDueDateBucket =
  | 'CURRENT'
  | 'OVERDUE_1_30'
  | 'OVERDUE_31_60'
  | 'OVERDUE_61_90'
  | 'OVERDUE_91_120'
  | 'OVERDUE_ABOVE_120'
  | 'NO_DUE_DATE'

export type PayableDocumentAgeBucket = 'AGE_0_30' | 'AGE_31_60' | 'AGE_61_90' | 'AGE_91_120' | 'AGE_ABOVE_120'

export type PayableAgeingBasis = 'due_date' | 'document_age'

export type PayableOpenItemStatus = 'OPEN' | 'PARTIALLY_SETTLED' | 'SETTLED' | 'DISPUTED' | 'ON_HOLD' | 'WRITTEN_OFF'

export interface PayableOutstandingOpenItemDto {
  openItemId: string
  vendorInvoiceId: string | null
  vendorAdjustmentId: string | null
  documentType: string
  documentNumber: string | null
  documentStatus: string | null
  vendorId: string
  vendorCode: string | null
  vendorName: string | null
  supplierInvoiceNumber: string | null
  supplierReferenceNumber: string | null
  documentDate: string | null
  postingDate: string | null
  dueDate: string | null
  voucherNumber: string | null
  voucherId: string | null
  currencyCode: string
  exchangeRate: string
  outstandingAmount: string
  baseOutstandingAmount: string
  originalAmount: string
  baseOriginalAmount: string
  daysOutstanding: number
  daysOverdue: number | null
  dueDateBucket: PayableDueDateBucket
  documentAgeBucket: PayableDocumentAgeBucket
  status: PayableOpenItemStatus
  isDisputed: boolean
  isOnHold: boolean
  vendorPayableAccountId: string | null
  allowedActions: Record<string, false>
}

export interface PayableCurrencyBreakdownRow {
  currencyCode: string
  outstandingAmount: string
  baseOutstandingAmount: string
  openItemCount: number
}

export interface PayableAgeingBucketSummary {
  bucket: PayableDueDateBucket | PayableDocumentAgeBucket
  openItemCount: number
  outstandingAmount: string
  baseOutstandingAmount: string
}

export interface PayableAgeingReportDto {
  reportDate: string
  ageingBasis: PayableAgeingBasis
  limitations: string[]
  totals: {
    openItemCount: number
    outstandingAmount: string
    baseOutstandingAmount: string
  }
  buckets: PayableAgeingBucketSummary[]
  currencyBreakdown: PayableCurrencyBreakdownRow[]
}

export interface VendorPayableSummaryRow {
  vendorId: string
  vendorCode: string | null
  vendorName: string | null
  openItemCount: number
  outstandingAmount: string
  baseOutstandingAmount: string
  creditOutstandingBase?: string
  debitOutstandingBase?: string
  netPayableBase?: string
  oldestDueDate: string | null
  maxDaysOverdue: number | null
  disputedCount: number
  onHoldCount: number
  currencyBreakdown: PayableCurrencyBreakdownRow[]
}

export interface VendorPayableDetailDto extends VendorPayableSummaryRow {
  reportDate: string
  limitations: string[]
}

export interface PayableOverviewDto {
  reportDate: string
  legalEntityId: string
  limitations: string[]
  totals: {
    openItemCount: number
    vendorCount: number
    outstandingAmount: string
    baseOutstandingAmount: string
  }
  readyToPostCount: number
  postedThisMonthCount: number
  dataQualityExceptionCount: number
  currencyBreakdown: PayableCurrencyBreakdownRow[]
}

export interface PaymentPlanningOpenItemRow {
  openItemId: string
  documentType: string
  documentNumber: string | null
  vendorInvoiceId: string | null
  dueDate: string | null
  outstandingAmount: string
  baseOutstandingAmount: string
  currencyCode: string
  daysOverdue: number | null
}

export interface PaymentPlanningDueGroup {
  dueDate: string | null
  openItemCount: number
  outstandingAmount: string
  baseOutstandingAmount: string
  items: PaymentPlanningOpenItemRow[]
}

export interface PaymentPlanningVendorGroup {
  vendorId: string
  vendorCode: string | null
  vendorName: string | null
  openItemCount: number
  outstandingAmount: string
  baseOutstandingAmount: string
  dueGroups: PaymentPlanningDueGroup[]
}

export interface PaymentPlanningDto {
  asOfDate: string
  horizonDays: number
  horizonEndDate: string
  limitations: string[]
  totals: {
    openItemCount: number
    vendorCount: number
    outstandingAmount: string
    baseOutstandingAmount: string
  }
  vendors: PaymentPlanningVendorGroup[]
}

export interface PayableReportingListResult<T> {
  reportDate: string
  limitations: string[]
  items: T[]
}

// ─── AP reconciliation + close gate (Phase 4D2) ───────────────────────────────

export type PayableReconciliationRunStatus = 'STARTED' | 'COMPLETED' | 'FAILED'

export type PayableReconciliationStatus =
  | 'MATCHED'
  | 'MATCHED_WITH_WARNINGS'
  | 'MISMATCHED'
  | 'FAILED'

export type PayableReconciliationSourceMode = 'CURRENT_BALANCE' | 'HISTORICAL_RECONSTRUCTION'

export type PayableReconciliationExceptionSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKER'

export type PayableReconciliationExceptionCategory =
  | 'CONTROL_ACCOUNT_CONFIGURATION'
  | 'SUBLEDGER_BALANCE'
  | 'GENERAL_LEDGER_BALANCE'
  | 'SOURCE_DOCUMENT'
  | 'ACCOUNTING_VOUCHER'
  | 'GENERAL_LEDGER_ENTRY'
  | 'OPEN_ITEM'
  | 'ALLOCATION'
  | 'ALLOCATION_REVERSAL'
  | 'DOCUMENT_REVERSAL'
  | 'POSTING_EVENT'
  | 'VENDOR_PARTY'
  | 'CURRENCY'
  | 'BRANCH'
  | 'PERIOD_READINESS'
  | 'WORKFLOW'
  | 'DATA_INTEGRITY'

export type PayableCloseGateStatus = 'PASS' | 'PASS_WITH_WARNINGS' | 'BLOCKED' | 'FAILED'

export type PayableCloseGateCheckStatus = 'PASSED' | 'WARNING' | 'BLOCKED' | 'FAILED'

export interface CreatePayableReconciliationRunInput {
  legalEntityId: string
  asOfDate?: string
  includeVendorLevel?: boolean
  toleranceOverride?: string
}

export interface PayableReconciliationRunDto {
  id: string
  tenantId: string
  legalEntityId: string
  asOfDate: string
  sourceMode: PayableReconciliationSourceMode
  runStatus: PayableReconciliationRunStatus
  status: PayableReconciliationStatus | null
  baseCurrency: string
  tolerance: string
  includeVendorLevel: boolean
  controlAccountCount: number
  matchedAccountCount: number
  mismatchedAccountCount: number
  glTotal: string
  subledgerTotal: string
  variance: string
  exceptionCount: number
  infoCount: number
  warningCount: number
  errorCount: number
  blockerCount: number
  vendorCount: number
  vendorMismatchCount: number
  limitations: string[]
  errorMessage: string | null
  startedAt: string
  completedAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  isStale: boolean
}

export interface PayableReconciliationAccountResultDto {
  id: string
  runId: string
  accountId: string
  accountCode: string | null
  accountName: string | null
  glBalance: string
  subledgerBalance: string
  variance: string
  matched: boolean
  openItemCount: number
}

export interface PayableReconciliationVendorBalanceRow {
  vendorId: string
  vendorCode: string | null
  vendorName: string | null
  glBalance: string
  subledgerBalance: string
  variance: string
  matched: boolean
  openItemCount: number
}

export interface PayableReconciliationExceptionDto {
  id: string
  runId: string
  severity: PayableReconciliationExceptionSeverity
  category: PayableReconciliationExceptionCategory
  code: string
  message: string
  accountId: string | null
  vendorId: string | null
  openItemId: string | null
  voucherId: string | null
  documentType: string | null
  documentId: string | null
  details: Record<string, unknown> | null
  isAcknowledged: boolean
  acknowledgedBy: string | null
  acknowledgedAt: string | null
  acknowledgementNote: string | null
  createdAt: string
}

export interface ListPayableReconciliationRunsQuery {
  legalEntityId: string
  page?: number
  pageSize?: number
  sortOrder?: 'asc' | 'desc'
}

export interface ListPayableReconciliationExceptionsQuery {
  page?: number
  pageSize?: number
  severity?: PayableReconciliationExceptionSeverity
  category?: PayableReconciliationExceptionCategory
  isAcknowledged?: boolean
}

export interface PaginatedPayableReconciliationRuns {
  items: PayableReconciliationRunDto[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface PaginatedPayableReconciliationAccountResults {
  items: PayableReconciliationAccountResultDto[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface PaginatedPayableReconciliationVendorResults {
  items: PayableReconciliationVendorBalanceRow[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface PaginatedPayableReconciliationExceptions {
  items: PayableReconciliationExceptionDto[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface AcknowledgePayableReconciliationExceptionInput {
  note?: string
}

export interface CreatePayableCloseGateRunInput {
  legalEntityId: string
  periodId: string
  runFreshReconciliation?: boolean
  reconciliationRunId?: string
  includeVendorLevel?: boolean
}

export interface PayableCloseGateRunDto {
  id: string
  tenantId: string
  legalEntityId: string
  periodId: string
  asOfDate: string
  status: PayableCloseGateStatus
  reconciliationRunId: string | null
  checksTotal: number
  checksPassed: number
  checksWarning: number
  checksBlocked: number
  checksFailed: number
  summary: Record<string, unknown> | null
  startedAt: string
  completedAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface PayableCloseGateCheckDto {
  id: string
  runId: string
  checkCode: string
  checkName: string
  status: PayableCloseGateCheckStatus
  message: string
  details: Record<string, unknown> | null
  createdAt: string
}

export interface PayableCloseGateRunDetailDto {
  run: PayableCloseGateRunDto
  checks: PayableCloseGateCheckDto[]
}

export interface ListPayableCloseGateRunsQuery {
  legalEntityId: string
  page?: number
  pageSize?: number
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedPayableCloseGateRuns {
  items: PayableCloseGateRunDto[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}
