import type {
  CollectionWorklistItem,
  CustomerOutstandingSummary,
  ReceivableAgeingBucket,
  ReceivableFilter,
  ReceivableInvoice,
} from '@/types/receivables'

export function downloadTextFile(filename: string, content: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export type OutstandingSortKey =
  | 'customerName'
  | 'totalOutstanding'
  | 'overdueAmount'
  | 'creditUtilization'
  | 'maximumOverdueDays'
  | 'openInvoiceCount'

export type InvoiceSortKey =
  | 'invoiceNumber'
  | 'invoiceDate'
  | 'dueDate'
  | 'customerName'
  | 'originalAmount'
  | 'outstandingBalance'
  | 'overdueDays'

export type WorklistSortKey =
  | 'priority'
  | 'customerName'
  | 'totalOutstanding'
  | 'overdue'
  | 'oldestOverdueDays'
  | 'nextFollowUp'

export function sortOutstandingRows(
  rows: CustomerOutstandingSummary[],
  key: OutstandingSortKey,
  dir: 'asc' | 'desc',
): CustomerOutstandingSummary[] {
  const d = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'customerName':
        cmp = a.customerName.localeCompare(b.customerName)
        break
      case 'totalOutstanding':
        cmp = a.totalOutstanding - b.totalOutstanding
        break
      case 'overdueAmount':
        cmp = a.overdueAmount - b.overdueAmount
        break
      case 'creditUtilization':
        cmp = a.creditUtilization - b.creditUtilization
        break
      case 'maximumOverdueDays':
        cmp = a.maximumOverdueDays - b.maximumOverdueDays
        break
      case 'openInvoiceCount':
        cmp = a.openInvoiceCount - b.openInvoiceCount
        break
      default:
        cmp = 0
    }
    return cmp * d
  })
}

export function sortInvoiceRows(
  rows: ReceivableInvoice[],
  key: InvoiceSortKey,
  dir: 'asc' | 'desc',
): ReceivableInvoice[] {
  const d = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'invoiceNumber':
        cmp = a.invoiceNumber.localeCompare(b.invoiceNumber)
        break
      case 'invoiceDate':
        cmp = a.invoiceDate.localeCompare(b.invoiceDate)
        break
      case 'dueDate':
        cmp = a.dueDate.localeCompare(b.dueDate)
        break
      case 'customerName':
        cmp = a.customerName.localeCompare(b.customerName)
        break
      case 'originalAmount':
        cmp = a.originalAmount - b.originalAmount
        break
      case 'outstandingBalance':
        cmp = a.outstandingBalance - b.outstandingBalance
        break
      case 'overdueDays':
        cmp = a.overdueDays - b.overdueDays
        break
      default:
        cmp = 0
    }
    return cmp * d
  })
}

export function sortWorklistRows(
  rows: CollectionWorklistItem[],
  key: WorklistSortKey,
  dir: 'asc' | 'desc',
): CollectionWorklistItem[] {
  const d = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'priority':
        cmp = a.priority - b.priority
        break
      case 'customerName':
        cmp = a.customerName.localeCompare(b.customerName)
        break
      case 'totalOutstanding':
        cmp = a.totalOutstanding - b.totalOutstanding
        break
      case 'overdue':
        cmp = a.overdue - b.overdue
        break
      case 'oldestOverdueDays':
        cmp = a.oldestOverdueDays - b.oldestOverdueDays
        break
      case 'nextFollowUp':
        cmp = (a.nextFollowUp ?? '').localeCompare(b.nextFollowUp ?? '')
        break
      default:
        cmp = 0
    }
    return cmp * d
  })
}

export function ageingBucketHref(bucket: ReceivableAgeingBucket): string {
  return `/accounting/receivables/invoices?ageingBucket=${encodeURIComponent(bucket)}`
}

export function clearReceivableFilterFields(
  filter: ReceivableFilter,
  preserve: Partial<ReceivableFilter> = {},
): ReceivableFilter {
  return {
    ...filter,
    search: '',
    customerId: '',
    customerGroup: '',
    salesperson: '',
    territory: '',
    state: '',
    location: '',
    creditStatus: '',
    overdueStatus: 'all',
    ageingBucket: '',
    amountMin: null,
    amountMax: null,
    dueDateFrom: '',
    dueDateTo: '',
    gstRegistrationType: '',
    hasDispute: 'all',
    hasPaymentPromise: 'all',
    invoiceStatus: '',
    paymentMode: '',
    allocationStatus: '',
    voucherStatus: '',
    collectionOwner: '',
    priority: '',
    reminderCategory: '',
    ...preserve,
  }
}

export const FINANCIAL_YEAR_OPTIONS = [
  { value: 'FY 2025-26', from: '2025-04-01', to: '2026-03-31' },
  { value: 'FY 2024-25', from: '2024-04-01', to: '2025-03-31' },
  { value: 'FY 2023-24', from: '2023-04-01', to: '2024-03-31' },
] as const
