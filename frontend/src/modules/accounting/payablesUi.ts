import type { ThreeWayMatchResult as DrawerThreeWayMatchResult } from '@/components/accounting/payables'
import type {
  MatchStatus,
  PayableAgeingBucket,
  PayableFilter,
  PayableInvoice,
  ThreeWayMatchResult,
  VendorOutstandingSummary,
} from '@/types/payables'
import type { PayableMatchStatus } from '@/components/accounting/payables/PayableStatusBadge'

export function downloadTextFile(filename: string, content: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export type VendorOutstandingSortKey =
  | 'vendorName'
  | 'totalOutstanding'
  | 'overdueAmount'
  | 'creditUtilization'
  | 'maximumOverdueDays'
  | 'openInvoiceCount'

export type PayableInvoiceSortKey =
  | 'invoiceNumber'
  | 'invoiceDate'
  | 'dueDate'
  | 'vendorName'
  | 'originalAmount'
  | 'outstandingBalance'
  | 'overdueDays'

export function sortVendorOutstandingRows(
  rows: VendorOutstandingSummary[],
  key: VendorOutstandingSortKey,
  dir: 'asc' | 'desc',
): VendorOutstandingSummary[] {
  const d = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'vendorName':
        cmp = a.vendorName.localeCompare(b.vendorName)
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

export function sortPayableInvoiceRows(
  rows: PayableInvoice[],
  key: PayableInvoiceSortKey,
  dir: 'asc' | 'desc',
): PayableInvoice[] {
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
      case 'vendorName':
        cmp = a.vendorName.localeCompare(b.vendorName)
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

export function ageingBucketHref(bucket: PayableAgeingBucket): string {
  return `/accounting/payables/invoices?ageingBucket=${encodeURIComponent(bucket)}`
}

export function clearPayableFilterFields(
  filter: PayableFilter,
  preserve: Partial<PayableFilter> = {},
): PayableFilter {
  return {
    ...filter,
    search: '',
    vendorId: '',
    vendorCategory: '',
    plant: '',
    costCentre: '',
    overdueStatus: 'all',
    ageingBucket: '',
    amountMin: null,
    amountMax: null,
    dueDateFrom: '',
    dueDateTo: '',
    invoiceStatus: '',
    matchStatus: '',
    invoiceTab: 'all',
    paymentTab: 'all',
    proposalTab: 'all',
    disputeTab: 'open',
    debitNoteTab: 'all',
    advanceTab: 'all',
    paymentMode: '',
    allocationStatus: '',
    paymentStatus: '',
    proposalStatus: '',
    vendorStatus: '',
    ...preserve,
  }
}

export const FINANCIAL_YEAR_OPTIONS = [
  { value: 'FY 2025-26', from: '2025-04-01', to: '2026-03-31' },
  { value: 'FY 2024-25', from: '2024-04-01', to: '2025-03-31' },
  { value: 'FY 2023-24', from: '2023-04-01', to: '2024-03-31' },
] as const

const MATCHED_STATUSES: MatchStatus[] = ['Fully Matched', 'Within Tolerance', 'Override Approved']

export function isPayableMatchMismatch(status: MatchStatus): boolean {
  return !MATCHED_STATUSES.includes(status)
}

export function mapMatchStatusForBadge(status: MatchStatus): PayableMatchStatus {
  if (status === 'Fully Matched' || status === 'Override Approved') return 'Matched'
  if (status === 'Within Tolerance') return 'Within Tolerance'
  if (status === 'Pending Verification') return 'Partial Match'
  if (status === 'Missing GRN' || status === 'Missing PO') return 'Unmatched'
  return 'Exception'
}

export function mapThreeWayMatchForDrawer(result: ThreeWayMatchResult): DrawerThreeWayMatchResult {
  return {
    invoiceNumber: result.invoiceNumber,
    poNumber: result.poNumber ?? '—',
    grnNumber: result.grnNumber ?? '—',
    vendorName: result.vendorName,
    matchStatus: mapMatchStatusForBadge(result.overallStatus),
    lines: result.lines.flatMap((line) => [
      {
        field: `${line.itemDescription} — Qty`,
        poValue: line.poQty,
        grnValue: line.grnQty,
        invoiceValue: line.invoiceQty,
        difference: line.invoiceQty - line.grnQty,
        tolerance: line.tolerance,
        withinTolerance: line.status === 'Fully Matched' || line.status === 'Within Tolerance',
      },
      {
        field: `${line.itemDescription} — Value`,
        poValue: line.poValue,
        grnValue: line.grnValue,
        invoiceValue: line.invoiceValue,
        difference: line.difference,
        tolerance: line.tolerance,
        withinTolerance: line.status === 'Fully Matched' || line.status === 'Within Tolerance',
      },
    ]),
    sourceLinks: result.poNumber
      ? [
          { label: 'View PO', href: `/purchase/orders/${encodeURIComponent(result.poNumber)}` },
          ...(result.grnNumber
            ? [{ label: 'View GRN', href: `/inventory/grn/${encodeURIComponent(result.grnNumber)}` }]
            : []),
        ]
      : undefined,
  }
}
