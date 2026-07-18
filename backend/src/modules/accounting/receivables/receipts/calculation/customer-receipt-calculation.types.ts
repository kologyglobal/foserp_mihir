import type { CustomerReceiptPaymentMethod } from '../customer-receipt.types.js'

export type CustomerTdsMode = 'NONE' | 'AMOUNT' | 'PERCENTAGE'

export type ReceiptValidationSeverity = 'ERROR' | 'WARNING'

export interface ReceiptValidationIssue {
  code: string
  severity: ReceiptValidationSeverity
  field?: string
  rowIndex?: number
  invoiceId?: string
  invoiceOpenItemId?: string
  message: string
  details?: Record<string, unknown>
}

export interface CustomerTdsInput {
  mode: CustomerTdsMode
  value?: string | null
  calculationBase?: string | null
  sectionCode?: string | null
  certificateReference?: string | null
  accountId?: string | null
}

export interface ReceiptBankChargeInput {
  description: string
  amount: string
  accountId?: string | null
}

export interface ReceiptOtherDeductionInput {
  code: string
  description: string
  amount: string
  accountId?: string | null
}

export interface ProposedReceiptAllocationInput {
  invoiceId: string
  invoiceOpenItemId: string
  allocationAmount: string
}

export interface CustomerReceiptCalculationInput {
  tenantId: string
  legalEntityId: string
  branchId?: string | null

  customerId: string

  receiptDate: string
  postingDate: string
  valueDate?: string | null

  paymentMethod: CustomerReceiptPaymentMethod

  currencyCode: string
  exchangeRate?: string | null

  bankCashAmount: string

  customerTds?: CustomerTdsInput | null
  bankCharges?: ReceiptBankChargeInput[] | null
  otherDeductions?: ReceiptOtherDeductionInput[] | null

  bankCashAccountId?: string | null
  customerReceivableAccountId?: string | null

  instrumentNumber?: string | null
  instrumentDate?: string | null
  bankReference?: string | null
  transactionReference?: string | null
  narration?: string | null

  proposedAllocations?: ProposedReceiptAllocationInput[] | null
}

export interface CustomerReceiptTdsSummary {
  mode: CustomerTdsMode
  value: string | null
  calculationBase: string | null
  sectionCode: string | null
  certificateReference: string | null
  accountId: string | null
  amount: string
  baseAmount: string
}

export interface ReceiptChargeSummaryRow {
  rowIndex: number
  code?: string
  description: string
  amount: string
  baseAmount: string
  accountId: string | null
}

export interface ReceiptAllocationPreviewRow {
  invoiceId: string
  invoiceOpenItemId: string
  invoiceNumber: string
  invoiceDate: string
  dueDate?: string | null
  currencyCode: string
  invoiceOutstandingBefore: string
  proposedAllocationAmount: string
  invoiceOutstandingAfter: string
  baseInvoiceOutstandingBefore: string
  baseProposedAllocationAmount: string
  baseInvoiceOutstandingAfter: string
  status: 'VALID' | 'INVALID'
  issues: ReceiptValidationIssue[]
}

export interface ReceiptPostingPreviewLine {
  side: 'DEBIT' | 'CREDIT'
  accountId: string | null
  accountRole: string
  amount: string
  baseAmount: string
  partyType?: 'CUSTOMER' | null
  partyId?: string | null
  partyNameSnapshot?: string | null
  narration?: string | null
}

export interface CustomerReceiptPostingPreview {
  debitLines: ReceiptPostingPreviewLine[]
  creditLines: ReceiptPostingPreviewLine[]
  totalDebit: string
  totalCredit: string
  baseTotalDebit: string
  baseTotalCredit: string
  balanced: boolean
}

export interface CustomerReceiptCalculationResult {
  valid: boolean
  currencyCode: string
  exchangeRate: string

  bankCashAmount: string
  customerTdsAmount: string
  bankChargeAmount: string
  otherDeductionAmount: string

  grossReceiptAmount: string
  allocatableAmount: string

  proposedAllocatedAmount: string
  unallocatedAmount: string

  baseBankCashAmount: string
  baseCustomerTdsAmount: string
  baseBankChargeAmount: string
  baseOtherDeductionAmount: string

  baseGrossReceiptAmount: string
  baseAllocatableAmount: string
  baseProposedAllocatedAmount: string
  baseUnallocatedAmount: string

  tdsSummary: CustomerReceiptTdsSummary | null
  bankChargeSummary: ReceiptChargeSummaryRow[]
  otherDeductionSummary: ReceiptChargeSummaryRow[]
  /** Amount-only preview rows (invoice details filled by validation preview). */
  allocationPreview: ReceiptAllocationPreviewRow[]

  postingPreview: CustomerReceiptPostingPreview

  errors: ReceiptValidationIssue[]
  warnings: ReceiptValidationIssue[]
}

export interface MappingValidationResult {
  mappingKey: string
  required: boolean
  configured: boolean
  accountId: string | null
  accountCode: string | null
  accountName: string | null
  valid: boolean
  issues: ReceiptValidationIssue[]
}

export interface ReceiptValidationContext {
  tenantId: string
  /** Optional customer name snapshot for posting preview party line. */
  customerNameSnapshot?: string | null
  /** Max TDS percentage allowed (default 100). */
  maxTdsPercentage?: string
  /** When true, non-standard TDS rates are allowed (default true with warning). */
  allowCustomTdsRates?: boolean
}

export interface CustomerReceiptValidationPreview {
  valid: boolean
  calculation: CustomerReceiptCalculationResult | null
  errors: ReceiptValidationIssue[]
  warnings: ReceiptValidationIssue[]

  customerReadiness: {
    found: boolean
    active: boolean
    customerId?: string
    customerName?: string
  }

  accountReadiness: {
    bankCash: MappingValidationResult
    customerReceivable: MappingValidationResult
    customerTds: MappingValidationResult
    bankCharges: MappingValidationResult[]
    otherDeductions: MappingValidationResult[]
  }

  paymentMethodReadiness: {
    paymentMethod: CustomerReceiptPaymentMethod
    valid: boolean
    missingFields: string[]
  }

  currencyReadiness: {
    currencyCode: string
    baseCurrencyCode: string
    exchangeRate: string
    multiCurrencyEnabled: boolean
  }

  periodReadiness: {
    financialYearResolved: boolean
    accountingPeriodResolved: boolean
    periodStatus?: string
    financialYearId?: string | null
    periodId?: string | null
  }

  allocationReadiness: {
    proposedAllocationCount: number
    validAllocationCount: number
    invalidAllocationCount: number
    totalProposedAllocation: string
    unallocatedAmount: string
  }

  postingPreview: CustomerReceiptPostingPreview | null
}
