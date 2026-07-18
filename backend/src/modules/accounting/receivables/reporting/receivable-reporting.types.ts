import type { ReceivableOpenItemStatus } from '../receivable-open-items/receivable-open-item.types.js'

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

export type ReconciliationExceptionCode =
  | 'POSTED_INVOICE_WITHOUT_OPEN_ITEM'
  | 'OPEN_ITEM_WITHOUT_VOUCHER'
  | 'OPEN_ITEM_GL_AMOUNT_MISMATCH'
  | 'CONTROL_ACCOUNT_MANUAL_POSTING'
  | 'ALLOCATION_WITHOUT_BATCH'
  | 'ALLOCATION_WITHOUT_RECEIPT'
  | 'ALLOCATION_WITHOUT_INVOICE'
  | 'ALLOCATION_RECEIPT_OPEN_ITEM_MISMATCH'
  | 'ALLOCATION_INVOICE_OPEN_ITEM_MISMATCH'
  | 'ALLOCATION_CUSTOMER_MISMATCH'
  | 'ALLOCATION_CURRENCY_MISMATCH'
  | 'ALLOCATION_AMOUNT_EXCEEDS_RECEIPT'
  | 'ALLOCATION_AMOUNT_EXCEEDS_INVOICE'
  | 'RECEIPT_BALANCE_MISMATCH'
  | 'INVOICE_BALANCE_MISMATCH'
  | 'CREDIT_OPEN_ITEM_BALANCE_MISMATCH'
  | 'DEBIT_OPEN_ITEM_BALANCE_MISMATCH'
  | 'ALLOCATION_BASE_AMOUNT_MISMATCH'
  | 'ALLOCATION_FOREX_REQUIRED'

export const OUTSTANDING_ACTIVE_STATUSES: ReceivableOpenItemStatus[] = [
  'OPEN',
  'PARTIALLY_SETTLED',
  'DISPUTED',
  'ON_HOLD',
]

export interface ReceivableReportingContext {
  tenantId: string
  legalEntityId: string
  reportDate: string
  today: string
  timezone: string
  limitations: string[]
}

export interface ReceivableReadOnlyActions {
  edit: false
  validate: false
  markReady: false
  cancel: false
  post: false
  allocate: false
  receipt: false
  dispute: false
  releaseHold: false
}

export const READ_ONLY_RECEIVABLE_ACTIONS: ReceivableReadOnlyActions = {
  edit: false,
  validate: false,
  markReady: false,
  cancel: false,
  post: false,
  allocate: false,
  receipt: false,
  dispute: false,
  releaseHold: false,
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
  allowedActions: ReceivableReadOnlyActions
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
  debitOutstandingBase: string
  creditOutstandingBase: string
  netReceivableBase: string
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
  code: ReconciliationExceptionCode
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

export interface ListOutstandingQuery {
  legalEntityId: string
  reportDate?: string
  customerId?: string
  status?: ReceivableOpenItemStatus
  includeSettled?: boolean
  receivableAccountId?: string
  currencyCode?: string
  amountFrom?: string
  amountTo?: string
  dueDateFrom?: string
  dueDateTo?: string
  ageingBucket?: DueDateBucket | InvoiceAgeBucket
  ageingBasis?: AgeingBasis
  search?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface CustomerSummaryQuery {
  legalEntityId: string
  reportDate?: string
  includeSettled?: boolean
  search?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface AgeingQuery {
  legalEntityId: string
  reportDate?: string
  ageingBasis?: AgeingBasis
  includeSettled?: boolean
  customerId?: string
  receivableAccountId?: string
}

export interface OverviewQuery {
  legalEntityId: string
  reportDate?: string
  includeSettled?: boolean
}

export interface ReconciliationQuery {
  legalEntityId: string
  asOfDate?: string
  includeSettled?: boolean
}
