/** Money In (AR) DTOs — amounts as decimal strings matching backend Phase 3A. */

export type SalesInvoiceStatus = 'DRAFT' | 'READY_TO_POST' | 'POSTED' | 'CANCELLED'
export type SalesInvoiceSourceType = 'DIRECT' | 'SALES_ORDER'
export type SalesInvoiceSupplyType = 'INTRA_STATE' | 'INTER_STATE' | 'EXPORT' | 'SEZ' | 'NON_GST'
export type SalesInvoiceTaxTreatment =
  | 'REGISTERED'
  | 'UNREGISTERED'
  | 'EXPORT_WITH_TAX'
  | 'EXPORT_WITHOUT_TAX'
  | 'SEZ_WITH_TAX'
  | 'SEZ_WITHOUT_TAX'
  | 'NON_GST'

export type DueDateBucket =
  | 'CURRENT'
  | 'OVERDUE_1_30'
  | 'OVERDUE_31_60'
  | 'OVERDUE_61_90'
  | 'OVERDUE_91_120'
  | 'OVERDUE_ABOVE_120'
  | 'NO_DUE_DATE'

export type InvoiceAgeBucket = 'AGE_0_30' | 'AGE_31_60' | 'AGE_61_90' | 'AGE_91_120' | 'AGE_ABOVE_120'
export type AgeingBasis = 'due_date' | 'invoice_age'
export type ReconciliationStatus = 'MATCHED' | 'MISMATCH' | 'DATA_INCOMPLETE'
export type ReceivableOpenItemStatus = 'OPEN' | 'PARTIALLY_SETTLED' | 'SETTLED' | 'DISPUTED' | 'ON_HOLD' | 'WRITTEN_OFF'

export interface SalesInvoiceAllowedActions {
  edit: boolean
  validate: boolean
  markReady: boolean
  cancel: boolean
  post: boolean
  viewAccounting?: boolean
}

export interface CalculationIssue {
  code: string
  message: string
  field?: string
  severity?: 'error' | 'warning'
}

export interface SalesInvoiceValidationPreview {
  valid: boolean
  errors: CalculationIssue[]
  warnings: CalculationIssue[]
}

export interface SalesInvoiceLineDto {
  id: string
  lineNumber: number
  sourceLineId: string | null
  itemId: string | null
  itemCodeSnapshot: string | null
  itemNameSnapshot: string | null
  hsnCodeSnapshot: string | null
  uomSnapshot: string | null
  description: string | null
  quantity: string
  unitRate: string
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
  lineTotal: string
  revenueAccountId: string | null
  costCentreId: string | null
}

export interface SalesInvoiceDto {
  id: string
  tenantId: string
  legalEntityId: string
  branchId: string | null
  financialYearId: string | null
  invoiceNumber: string | null
  draftReference: string | null
  status: SalesInvoiceStatus
  customerId: string
  customerCodeSnapshot: string | null
  customerNameSnapshot: string
  customerGstinSnapshot: string | null
  customerPanSnapshot: string | null
  customerStateCodeSnapshot: string | null
  customerBillingAddressSnapshot: Record<string, unknown> | null
  customerShippingAddressSnapshot: Record<string, unknown> | null
  sourceType: SalesInvoiceSourceType
  sourceDocumentId: string | null
  sourceDocumentSnapshot: Record<string, unknown> | null
  invoiceDate: string
  postingDate: string | null
  referenceNumber: string | null
  customerPoNumber: string | null
  paymentTermsDays: number | null
  freightAmount: string
  otherChargesAmount: string
  dueDate: string | null
  placeOfSupply: string | null
  supplyType: SalesInvoiceSupplyType
  taxTreatment: SalesInvoiceTaxTreatment
  currencyCode: string
  exchangeRate: string
  subtotalAmount: string
  discountAmount: string
  taxableAmount: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  totalTaxAmount: string
  roundOffAmount: string
  totalAmount: string
  outstandingAmount: string
  amountPaid: string
  amountAdjusted: string
  baseSubtotalAmount: string
  baseDiscountAmount: string
  baseTaxableAmount: string
  baseCgstAmount: string
  baseSgstAmount: string
  baseIgstAmount: string
  baseCessAmount: string
  baseTotalTaxAmount: string
  baseRoundOffAmount: string
  baseTotalAmount: string
  narration: string | null
  accountingVoucherId: string | null
  postingEventId: string | null
  postedAt: string | null
  postedBy: string | null
  cancelledAt: string | null
  cancelledBy: string | null
  cancellationReason: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  lines?: SalesInvoiceLineDto[]
  allowedActions?: SalesInvoiceAllowedActions
  validationSummary?: SalesInvoiceValidationPreview | null
  metaWarnings?: Array<{ code: string; message: string }>
  receivableOpenItemId?: string | null
}

export type SalesInvoiceListItemDto = Omit<SalesInvoiceDto, 'lines' | 'validationSummary'>

export interface SalesInvoiceLineInput {
  lineNumber: number
  itemId?: string | null
  itemCode?: string | null
  itemName?: string | null
  description: string
  hsnCode?: string | null
  uom?: string | null
  quantity: string
  unitPrice: string
  lineDiscountType?: 'PERCENTAGE' | 'AMOUNT'
  lineDiscountValue?: string
  gstRate?: string
  cessRate?: string
  revenueAccountId?: string | null
  costCentreId?: string | null
  isTaxInclusive?: boolean
  sourceLineId?: string | null
}

export interface CreateSalesInvoiceInput {
  legalEntityId: string
  branchId?: string | null
  customerId: string
  sourceType?: SalesInvoiceSourceType
  sourceDocumentId?: string | null
  invoiceDate: string
  postingDate: string
  dueDate?: string | null
  paymentTermsDays?: number | null
  placeOfSupply?: string | null
  supplyType?: SalesInvoiceSupplyType
  taxTreatment: SalesInvoiceTaxTreatment
  currencyCode?: string
  exchangeRate?: string
  freightAmount?: string
  otherChargesAmount?: string
  referenceNumber?: string | null
  customerPoNumber?: string | null
  narration?: string | null
  invoiceDiscountType?: 'PERCENTAGE' | 'AMOUNT'
  invoiceDiscountValue?: string
  lines: SalesInvoiceLineInput[]
}

export interface UpdateSalesInvoiceInput extends CreateSalesInvoiceInput {
  updatedAt: string
}

export interface ListSalesInvoicesQuery {
  legalEntityId: string
  branchId?: string
  customerId?: string
  status?: SalesInvoiceStatus
  sourceType?: SalesInvoiceSourceType
  search?: string
  invoiceDateFrom?: string
  invoiceDateTo?: string
  page?: number
  limit?: number
  sortOrder?: 'asc' | 'desc'
}

export interface PostSalesInvoiceResult {
  invoice: SalesInvoiceDto
  posting: { voucherId: string; voucherNumber: string; postingEventId: string }
  receivableOpenItemId: string
  idempotentReplay: boolean
}

export interface OutstandingOpenItemDto {
  openItemId: string
  salesInvoiceId: string | null
  invoiceNumber: string | null
  invoiceStatus: string | null
  customerId: string
  customerCode: string | null
  customerName: string | null
  referenceNumber: string | null
  customerPoNumber: string | null
  invoiceDate: string | null
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
  dueDateBucket: DueDateBucket
  invoiceAgeBucket: InvoiceAgeBucket
  status: ReceivableOpenItemStatus
  isDisputed: boolean
  isOnHold: boolean
  receivableAccountId: string | null
  allowedActions: Record<string, false>
}

export interface CurrencyBreakdownRow {
  currencyCode: string
  outstandingAmount: string
  baseOutstandingAmount: string
  openItemCount: number
}

export interface AgeingBucketSummary {
  bucket: DueDateBucket | InvoiceAgeBucket
  openItemCount: number
  outstandingAmount: string
  baseOutstandingAmount: string
}

export interface AgeingReportDto {
  reportDate: string
  ageingBasis: AgeingBasis
  limitations: string[]
  totals: {
    openItemCount: number
    outstandingAmount: string
    baseOutstandingAmount: string
  }
  buckets: AgeingBucketSummary[]
  currencyBreakdown: CurrencyBreakdownRow[]
}

export interface CustomerReceivableSummaryRow {
  customerId: string
  customerCode: string | null
  customerName: string | null
  openItemCount: number
  outstandingAmount: string
  baseOutstandingAmount: string
  debitOutstandingBase?: string
  creditOutstandingBase?: string
  netReceivableBase?: string
  oldestDueDate: string | null
  maxDaysOverdue: number | null
  disputedCount: number
  onHoldCount: number
  currencyBreakdown: CurrencyBreakdownRow[]
}

export interface CustomerReceivableDetailDto extends CustomerReceivableSummaryRow {
  reportDate: string
  limitations: string[]
}

export interface ReceivableOverviewDto {
  reportDate: string
  legalEntityId: string
  limitations: string[]
  totals: {
    openItemCount: number
    customerCount: number
    outstandingAmount: string
    baseOutstandingAmount: string
  }
  readyToPostCount: number
  postedThisMonthCount: number
  dataQualityExceptionCount: number
  currencyBreakdown: CurrencyBreakdownRow[]
}

export interface ReconciliationAccountRow {
  receivableAccountId: string
  accountCode: string | null
  accountName: string | null
  subledgerBalance: string
  glBalance: string
  variance: string
  matched: boolean
}

export interface ReconciliationException {
  code: string
  message: string
  receivableAccountId?: string
  salesInvoiceId?: string
  openItemId?: string
  voucherId?: string
  details?: Record<string, string>
}

export interface ReceivableReconciliationDto {
  asOfDate: string
  legalEntityId: string
  status: ReconciliationStatus
  tolerance: string
  subledgerTotal: string
  glTotal: string
  variance: string
  accounts: ReconciliationAccountRow[]
  exceptions: ReconciliationException[]
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// ─── Customer credit notes (Phase 3C6) ─────────────────────────────────────

export type CustomerCreditNoteStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'READY_TO_POST'
  | 'POSTED'
  | 'REJECTED'
  | 'CANCELLED'

export type CreditNotePurpose =
  | 'SALES_RETURN'
  | 'PRICE_ADJUSTMENT'
  | 'QUANTITY_ADJUSTMENT'
  | 'QUALITY_CLAIM'
  | 'DISCOUNT'
  | 'FREIGHT_ADJUSTMENT'
  | 'TAX_CORRECTION'
  | 'COMMERCIAL_SETTLEMENT'
  | 'OTHER'

export type CreditNoteSourceType = 'SALES_INVOICE' | 'DIRECT'

export type CreditNoteAdjustmentMode = 'FULL_LINE' | 'QUANTITY' | 'VALUE' | 'RATE' | 'TAX_ONLY' | 'FULL_INVOICE'

export interface CustomerCreditNoteAllowedActions {
  edit: boolean
  validate: boolean
  markReady: boolean
  submit: boolean
  approve: boolean
  reject: boolean
  cancel: boolean
  post: boolean
  viewAccounting?: boolean
  allocate?: boolean
  viewAllocations?: boolean
  reverse?: boolean
}

export interface CustomerCreditNoteLineDto {
  id: string
  lineNumber: number
  originalInvoiceLineId: string | null
  itemId: string | null
  itemCodeSnapshot: string | null
  itemNameSnapshot: string | null
  hsnCodeSnapshot: string | null
  uomSnapshot: string | null
  description: string | null
  adjustmentMode: CreditNoteAdjustmentMode
  quantity: string
  unitRate: string
  revisedUnitRate: string | null
  grossAmount: string
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
  lineTotal: string
  revenueReversalAccountId: string | null
  costCentreId: string | null
}

export interface CustomerCreditNoteOpenItemSummary {
  id: string
  side: 'CREDIT'
  originalAmount: string
  openAmount: string
  status: ReceivableOpenItemStatus
}

export interface CustomerCreditNoteDto {
  id: string
  tenantId: string
  legalEntityId: string
  branchId: string | null
  financialYearId: string | null
  creditNoteNumber: string | null
  draftReference: string | null
  status: CustomerCreditNoteStatus
  purpose: CreditNotePurpose
  reasonId: string | null
  reasonCodeSnapshot: string | null
  reasonNameSnapshot: string | null
  sourceType: CreditNoteSourceType
  originalInvoiceId: string | null
  originalInvoiceNumberSnapshot: string | null
  customerId: string
  customerCodeSnapshot: string | null
  customerNameSnapshot: string
  customerGstinSnapshot: string | null
  customerPanSnapshot: string | null
  customerStateCodeSnapshot: string | null
  customerBillingAddressSnapshot: Record<string, unknown> | null
  creditNoteDate: string
  postingDate: string | null
  supplyType: SalesInvoiceSupplyType
  taxTreatment: SalesInvoiceTaxTreatment
  currencyCode: string
  exchangeRate: string
  taxableAmount: string
  cgstAmount: string
  sgstAmount: string
  igstAmount: string
  cessAmount: string
  totalTaxAmount: string
  discountAmount: string
  freightAmount: string
  otherChargesAmount: string
  roundOffAmount: string
  grandTotal: string
  baseTaxableAmount: string
  baseCgstAmount: string
  baseSgstAmount: string
  baseIgstAmount: string
  baseCessAmount: string
  baseTotalTaxAmount: string
  baseDiscountAmount: string
  baseFreightAmount: string
  baseOtherChargesAmount: string
  baseRoundOffAmount: string
  baseGrandTotal: string
  allocatableAmount: string
  allocatedAmount: string
  unallocatedAmount: string
  baseAllocatableAmount: string
  baseAllocatedAmount: string
  baseUnallocatedAmount: string
  inventoryReturnRequired: boolean
  approvalRequired: boolean
  approvalRequestId: string | null
  accountingVoucherId: string | null
  postingEventId: string | null
  creditOpenItemId: string | null
  postedAt: string | null
  postedBy: string | null
  cancelledAt: string | null
  cancelledBy: string | null
  cancellationReason: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  lines?: CustomerCreditNoteLineDto[]
  creditOpenItem?: CustomerCreditNoteOpenItemSummary | null
  allowedActions?: CustomerCreditNoteAllowedActions
}

export type CustomerCreditNoteListItemDto = Omit<CustomerCreditNoteDto, 'lines'>

export interface CreditNoteLineInput {
  lineNumber: number
  originalInvoiceLineId?: string | null
  adjustmentMode: CreditNoteAdjustmentMode
  quantity?: string
  value?: string
  revisedUnitRate?: string | null
  itemId?: string | null
  itemCode?: string | null
  itemName?: string | null
  hsnCode?: string | null
  uom?: string | null
  description?: string | null
  unitRate?: string
  gstRate?: string
  cessRate?: string
  revenueReversalAccountId?: string | null
  costCentreId?: string | null
}

export interface CreateCustomerCreditNoteInput {
  legalEntityId: string
  branchId?: string | null
  purpose: CreditNotePurpose
  reasonId?: string | null
  sourceType: CreditNoteSourceType
  originalInvoiceId?: string | null
  customerId: string
  creditNoteDate: string
  postingDate: string
  supplyType?: SalesInvoiceSupplyType
  taxTreatment?: SalesInvoiceTaxTreatment
  currencyCode?: string
  exchangeRate?: string
  freightAmount?: string
  otherChargesAmount?: string
  roundOffAmount?: string
  inventoryReturnRequired?: boolean
  approvalRequired?: boolean
  lines: CreditNoteLineInput[]
}

export interface UpdateCustomerCreditNoteInput extends Omit<CreateCustomerCreditNoteInput, 'legalEntityId'> {
  updatedAt: string
}

export interface ListCustomerCreditNotesQuery {
  legalEntityId: string
  branchId?: string
  customerId?: string
  originalInvoiceId?: string
  status?: CustomerCreditNoteStatus
  purpose?: CreditNotePurpose
  search?: string
  page?: number
  limit?: number
  sortOrder?: 'asc' | 'desc'
}

export interface CreditNoteValidationPreview {
  valid: boolean
  errors: CalculationIssue[]
  warnings: CalculationIssue[]
}

export interface PostCreditNoteResult {
  creditNote: CustomerCreditNoteDto
  posting: { voucherId: string; voucherNumber: string; postingEventId: string }
  creditOpenItemId: string
  idempotentReplay: boolean
}

// ─── Credit note allocations (Phase 3C5 backend / 3C6 frontend) ────────────

export interface CreditNoteAllocationLineInput {
  invoiceId: string
  invoiceOpenItemId: string
  amount: string
}

export interface CreditNoteAllocationRequest {
  allocationDate: string
  allocations: CreditNoteAllocationLineInput[]
}

export interface CreditNoteAllocationPreviewLine {
  invoiceId: string
  invoiceOpenItemId: string
  invoiceNumber: string | null
  currencyCode: string
  invoiceOutstandingBefore: string
  proposedAllocationAmount: string
  invoiceOutstandingAfter: string
  baseInvoiceOutstandingBefore: string
  baseProposedAllocationAmount: string
  baseInvoiceOutstandingAfter: string
  status: 'VALID' | 'INVALID'
  issues: CalculationIssue[]
}

export interface CreditNoteAllocationPreview {
  creditNoteId: string
  creditOpenItemId: string
  currencyCode: string
  exchangeRate: string
  creditNoteUnallocatedBefore: string
  totalProposedAllocation: string
  creditNoteUnallocatedAfter: string
  customerAdvanceAfter: string
  valid: boolean
  lines: CreditNoteAllocationPreviewLine[]
  errors: CalculationIssue[]
  warnings: CalculationIssue[]
}

export interface CreditNoteAllocationBatchDto {
  id: string
  status: string
  allocationDate: string
  currencyCode: string
  exchangeRate: string
  totalAllocatedAmount: string
  baseTotalAllocatedAmount: string
  allocationCount: number
  createdBy: string | null
  createdAt: string
  completedAt: string | null
}

export interface CustomerCreditNoteAllocationDto {
  id: string
  batchId: string | null
  creditNoteId: string
  invoiceId: string | null
  invoiceOpenItemId: string
  allocationDate: string
  allocatedAmount: string
  baseAllocatedAmount: string
  invoiceOutstandingBefore: string | null
  invoiceOutstandingAfter: string | null
  status: string
  createdBy: string | null
  createdAt: string
}

export interface CreditNoteAllocationResultInvoiceRow {
  invoiceId: string
  openItemId: string
  openAmount: string
  allocatedAmount: string
  status: string
  amountPaid: string
  outstandingAmount: string
}

export interface CreditNoteAllocationResult {
  batch: CreditNoteAllocationBatchDto
  allocations: CustomerCreditNoteAllocationDto[]
  creditNote: {
    id: string
    allocatedAmount: string
    unallocatedAmount: string
    baseAllocatedAmount: string
    baseUnallocatedAmount: string
  }
  creditOpenItem: {
    id: string
    openAmount: string
    allocatedAmount: string
    status: string
  }
  invoices: CreditNoteAllocationResultInvoiceRow[]
  customerAdvance: string
  idempotentReplay: boolean
}

export interface CreditNoteAllocationHistoryRow {
  batchId: string | null
  allocationId: string
  allocationDate: string
  allocationSequence: number
  invoiceId: string | null
  invoiceNumber: string | null
  invoiceOpenItemId: string
  allocatedAmount: string
  baseAllocatedAmount: string
  invoiceOutstandingBefore: string | null
  invoiceOutstandingAfter: string | null
  status: string
  createdBy: string | null
  createdAt: string
}
