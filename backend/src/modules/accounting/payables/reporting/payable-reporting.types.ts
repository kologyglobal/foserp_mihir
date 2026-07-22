import type { PayableOpenItemStatus } from '@prisma/client'

export type DueDateBucket =
  | 'CURRENT'
  | 'OVERDUE_1_30'
  | 'OVERDUE_31_60'
  | 'OVERDUE_61_90'
  | 'OVERDUE_91_120'
  | 'OVERDUE_ABOVE_120'
  | 'NO_DUE_DATE'

export type DocumentAgeBucket = 'AGE_0_30' | 'AGE_31_60' | 'AGE_61_90' | 'AGE_91_120' | 'AGE_ABOVE_120'

export type AgeingBasis = 'due_date' | 'document_age'

export const OUTSTANDING_ACTIVE_STATUSES: PayableOpenItemStatus[] = [
  'OPEN',
  'PARTIALLY_SETTLED',
  'DISPUTED',
  'ON_HOLD',
]

export interface PayableReportingContext {
  tenantId: string
  legalEntityId: string
  reportDate: string
  today: string
  timezone: string
  limitations: string[]
}

export interface PayableReadOnlyActions {
  edit: false
  validate: false
  markReady: false
  cancel: false
  post: false
  allocate: false
  payment: false
  dispute: false
  releaseHold: false
}

export const READ_ONLY_PAYABLE_ACTIONS: PayableReadOnlyActions = {
  edit: false,
  validate: false,
  markReady: false,
  cancel: false,
  post: false,
  allocate: false,
  payment: false,
  dispute: false,
  releaseHold: false,
}

export interface OutstandingOpenItemDto {
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
  dueDateBucket: DueDateBucket
  documentAgeBucket: DocumentAgeBucket
  status: PayableOpenItemStatus
  isDisputed: boolean
  isOnHold: boolean
  vendorPayableAccountId: string | null
  allowedActions: PayableReadOnlyActions
}

export interface CurrencyBreakdownRow {
  currencyCode: string
  outstandingAmount: string
  baseOutstandingAmount: string
  openItemCount: number
}

export interface AgeingBucketSummary {
  bucket: DueDateBucket | DocumentAgeBucket
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

export interface VendorPayableSummaryRow {
  vendorId: string
  vendorCode: string | null
  vendorName: string | null
  openItemCount: number
  outstandingAmount: string
  baseOutstandingAmount: string
  creditOutstandingBase: string
  debitOutstandingBase: string
  netPayableBase: string
  oldestDueDate: string | null
  maxDaysOverdue: number | null
  disputedCount: number
  onHoldCount: number
  currencyBreakdown: CurrencyBreakdownRow[]
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
  currencyBreakdown: CurrencyBreakdownRow[]
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

export interface ListOutstandingQuery {
  legalEntityId: string
  reportDate?: string
  vendorId?: string
  status?: PayableOpenItemStatus
  includeSettled?: boolean
  vendorPayableAccountId?: string
  currencyCode?: string
  amountFrom?: string
  amountTo?: string
  dueDateFrom?: string
  dueDateTo?: string
  ageingBucket?: DueDateBucket | DocumentAgeBucket
  ageingBasis?: AgeingBasis
  search?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface VendorSummaryQuery {
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
  vendorId?: string
  vendorPayableAccountId?: string
}

export interface OverviewQuery {
  legalEntityId: string
  reportDate?: string
  includeSettled?: boolean
}

export interface PaymentPlanningQuery {
  legalEntityId: string
  asOfDate?: string
  horizonDays?: 7 | 14 | 30
  vendorId?: string
  includeSettled?: boolean
}
