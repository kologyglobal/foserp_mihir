import type { ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import type {
  PayableCloseGateCheckStatus,
  PayableCloseGateStatus,
  PayableReconciliationExceptionSeverity,
  PayableReconciliationRunStatus,
  PayableReconciliationStatus,
  VendorInvoiceStatus,
  VendorInvoiceValidationIssue,
  VendorPaymentMethod,
  VendorPaymentPurpose,
} from '@/types/moneyOut'

export const MONEY_OUT_STATUS_LABELS: Record<VendorInvoiceStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  REJECTED: 'Rejected',
  READY_TO_POST: 'Ready to Post',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled',
  REVERSED: 'Reversed',
}

export function moneyOutStatusTone(status: VendorInvoiceStatus): ErpStatusChipTone {
  switch (status) {
    case 'DRAFT':
      return 'neutral'
    case 'PENDING_APPROVAL':
    case 'READY_TO_POST':
      return 'warning'
    case 'POSTED':
      return 'success'
    case 'REJECTED':
    case 'CANCELLED':
    case 'REVERSED':
      return 'critical'
    default:
      return 'neutral'
  }
}

export const MONEY_OUT_ERROR_MESSAGES: Record<string, string> = {
  VENDOR_INVOICE_NOT_FOUND: 'Vendor invoice not found.',
  VENDOR_INVOICE_STALE_VERSION: 'This invoice was changed by another user. Reload the latest version.',
  VENDOR_INVOICE_NOT_READY_TO_POST: 'Only READY_TO_POST vendor invoices can be posted.',
  VENDOR_INVOICE_ALREADY_POSTED: 'Vendor invoice is already posted.',
  VENDOR_INVOICE_POSTING_NOT_ALLOWED: 'You do not have permission to post vendor invoices.',
  VENDOR_INVOICE_CHANGED_AFTER_READY: 'Invoice amounts changed after ready-to-post. Revise and revalidate.',
  VENDOR_INVOICE_ACCOUNTING_PREVIEW_CHANGED: 'Accounting preview changed. Revise and revalidate before posting.',
  VENDOR_INVOICE_APPROVAL_INCOMPLETE: 'Approval is incomplete or not approved.',
  VENDOR_INVOICE_APPROVAL_MISMATCH: 'Approved amount does not match the current invoice.',
  VENDOR_INVOICE_APPROVAL_INVALIDATED: 'Approval request is no longer valid for posting.',
  VENDOR_INVOICE_EXACT_DUPLICATE: 'A vendor invoice with this supplier invoice number already exists.',
  VENDOR_INVOICE_UNIQUENESS_KEY_CONFLICT: 'Supplier invoice uniqueness key is already claimed.',
  VENDOR_INVOICE_UNIQUENESS_KEY_MISSING: 'Supplier uniqueness key is missing — mark ready or submit first.',
  VENDOR_INVOICE_VENDOR_INACTIVE: 'Vendor is inactive or blocked.',
  VENDOR_INVOICE_POSTING_PERIOD_CLOSED: 'Accounting period is closed for posting.',
  VENDOR_INVOICE_POSTING_PERIOD_UNDER_REVIEW: 'Accounting period is under review.',
  VENDOR_INVOICE_NUMBER_SERIES_MISSING: 'Vendor invoice number series is not configured.',
  VENDOR_INVOICE_POSTING_IN_PROGRESS: 'Posting is already in progress — wait and refresh.',
  VENDOR_INVOICE_CONCURRENT_POST: 'Another user posted this invoice concurrently. Refresh and retry.',
  VENDOR_INVOICE_PAYLOAD_MISMATCH: 'Posting payload mismatch — controlled review required.',
  VENDOR_INVOICE_POSTING_FAILED: 'Vendor invoice posting failed.',
  VENDOR_INVOICE_VALIDATION_FAILED: 'Validation failed — review errors before continuing.',
  VENDOR_INVOICE_INVALID_STATUS: 'Invalid vendor invoice status for this action.',
  VENDOR_INVOICE_EDIT_NOT_ALLOWED: 'Vendor invoice cannot be edited in its current status.',
  VENDOR_INVOICE_INACTIVE_VENDOR: 'Vendor is inactive or blocked.',
  VENDOR_INVOICE_REASON_REQUIRED: 'A reason is required for this action.',
  // Vendor payments (Phase 4B5)
  VENDOR_PAYMENT_NOT_FOUND: 'Vendor payment not found.',
  VENDOR_PAYMENT_STALE_VERSION: 'This payment was changed by another user. Reload the latest version.',
  VENDOR_PAYMENT_NOT_READY_TO_POST: 'Only READY_TO_POST vendor payments can be posted.',
  VENDOR_PAYMENT_ALREADY_POSTED: 'Vendor payment is already posted.',
  VENDOR_PAYMENT_POSTING_NOT_ALLOWED: 'You do not have permission to post vendor payments.',
  VENDOR_PAYMENT_CHANGED_AFTER_READY: 'Payment amounts changed after ready-to-post. Revise and revalidate.',
  VENDOR_PAYMENT_APPROVAL_INCOMPLETE: 'Approval is incomplete or not approved.',
  VENDOR_PAYMENT_APPROVAL_MISMATCH: 'Approved amount does not match the current payment.',
  VENDOR_PAYMENT_VALIDATION_FAILED: 'Validation failed — review errors before continuing.',
  VENDOR_PAYMENT_INVALID_STATUS: 'Invalid vendor payment status for this action.',
  VENDOR_PAYMENT_EDIT_NOT_ALLOWED: 'Vendor payment cannot be edited in its current status.',
  VENDOR_PAYMENT_VENDOR_INACTIVE: 'Vendor is inactive or blocked.',
  VENDOR_PAYMENT_POSTING_PERIOD_CLOSED: 'Accounting period is closed for posting.',
  VENDOR_PAYMENT_NUMBER_SERIES_MISSING: 'Vendor payment number series is not configured.',
  VENDOR_PAYMENT_POSTING_IN_PROGRESS: 'Posting is already in progress — wait and refresh.',
  VENDOR_PAYMENT_CONCURRENT_POST: 'Another user posted this payment concurrently. Refresh and retry.',
  VENDOR_PAYMENT_POSTING_FAILED: 'Vendor payment posting failed.',
  VENDOR_PAYMENT_REASON_REQUIRED: 'A reason is required for this action.',
  // Payable allocations (subledger only)
  PAYABLE_ALLOCATION_NOT_FOUND: 'Allocation not found.',
  PAYABLE_ALLOCATION_PAYMENT_NOT_FOUND: 'Vendor payment for this allocation was not found.',
  PAYABLE_ALLOCATION_SOURCE_STALE: 'The payment balance changed. Reload allocatable invoices and retry.',
  PAYABLE_ALLOCATION_TARGET_STALE: 'An invoice balance changed. Reload allocatable invoices and retry.',
  PAYABLE_ALLOCATION_OVER_SOURCE: 'Allocation exceeds the remaining payment balance.',
  PAYABLE_ALLOCATION_OVER_TARGET: 'Allocation exceeds an invoice outstanding amount.',
  PAYABLE_ALLOCATION_CURRENCY_MISMATCH: 'Allocation currency does not match the payment.',
  PAYABLE_ALLOCATION_PAYMENT_NOT_POSTED: 'Only posted payments can be allocated.',
  PAYABLE_ALLOCATION_INVALID_AMOUNT: 'Enter a valid allocation amount.',
  // Vendor adjustments (Phase 4C2)
  VENDOR_ADJUSTMENT_NOT_FOUND: 'Vendor adjustment not found.',
  VENDOR_ADJUSTMENT_STALE_VERSION: 'This adjustment was changed by another user. Reload the latest version.',
  VENDOR_ADJUSTMENT_NOT_READY_TO_POST: 'Only READY_TO_POST vendor adjustments can be posted.',
  VENDOR_ADJUSTMENT_ALREADY_POSTED: 'Vendor adjustment is already posted.',
  VENDOR_ADJUSTMENT_POSTING_NOT_ALLOWED: 'You do not have permission to post vendor adjustments.',
  VENDOR_ADJUSTMENT_VALIDATION_FAILED: 'Validation failed — review errors before continuing.',
  VENDOR_ADJUSTMENT_INVALID_STATUS: 'Invalid vendor adjustment status for this action.',
  VENDOR_ADJUSTMENT_EDIT_NOT_ALLOWED: 'Vendor adjustment cannot be edited in its current status.',
  VENDOR_ADJUSTMENT_REASON_REQUIRED: 'A reason is required for this action.',
  VENDOR_ADJUSTMENT_REVERSAL_NOT_ALLOWED: 'You do not have permission to reverse vendor adjustments.',
  VENDOR_ADJUSTMENT_REVERSAL_NOT_ELIGIBLE: 'This adjustment cannot be reversed — refresh and check its status.',
  // AP reversals (Phase 4C1)
  VENDOR_PAYMENT_REVERSAL_NOT_ALLOWED: 'You do not have permission to reverse vendor payments.',
  VENDOR_PAYMENT_REVERSAL_NOT_ELIGIBLE: 'This payment cannot be reversed — reverse allocations first or use cascade.',
  VENDOR_INVOICE_REVERSAL_NOT_ALLOWED: 'You do not have permission to reverse vendor invoices.',
  VENDOR_INVOICE_REVERSAL_NOT_ELIGIBLE: 'This invoice cannot be reversed — refresh and check its status.',
  PAYABLE_ALLOCATION_REVERSAL_NOT_ALLOWED: 'You do not have permission to reverse allocations.',
  PAYABLE_ALLOCATION_ALREADY_FULLY_REVERSED: 'Allocation batch is already fully reversed.',
}

export function mapMoneyOutError(code: string | undefined, fallback?: string): string {
  if (!code) return fallback ?? 'Something went wrong'
  return MONEY_OUT_ERROR_MESSAGES[code] ?? fallback ?? code.replace(/_/g, ' ')
}

export function vendorInvoiceDisplayNumber(inv: {
  vendorInvoiceNumber: string | null
  draftReference: string | null
}) {
  return inv.vendorInvoiceNumber ?? inv.draftReference ?? '—'
}

export function vendorPaymentDisplayNumber(pmt: {
  vendorPaymentNumber: string | null
  draftReference: string | null
}) {
  return pmt.vendorPaymentNumber ?? pmt.draftReference ?? '—'
}

export function vendorAdjustmentDisplayNumber(adj: {
  vendorAdjustmentNumber: string | null
  draftReference: string | null
}) {
  return adj.vendorAdjustmentNumber ?? adj.draftReference ?? '—'
}

export const ADJUSTMENT_TYPE_LABELS: Record<'VENDOR_DEBIT_NOTE' | 'VENDOR_CREDIT_ADJUSTMENT', string> = {
  VENDOR_DEBIT_NOTE: 'Vendor debit note',
  VENDOR_CREDIT_ADJUSTMENT: 'Vendor credit adjustment',
}

export const ADJUSTMENT_REASON_LABELS: Record<string, string> = {
  PURCHASE_RETURN: 'Purchase return',
  RATE_DIFFERENCE: 'Rate difference',
  SHORT_SUPPLY: 'Short supply',
  QUALITY_CLAIM: 'Quality claim',
  DAMAGE_CLAIM: 'Damage claim',
  COMMERCIAL_DISCOUNT: 'Commercial discount',
  FREIGHT_RECOVERY: 'Freight recovery',
  TAX_CORRECTION: 'Tax correction',
  TDS_CORRECTION: 'TDS correction',
  ROUND_OFF: 'Round-off',
  OPENING_CORRECTION: 'Opening correction',
  OTHER: 'Other',
}

export const AP_REVERSAL_TYPE_LABELS: Record<string, string> = {
  payment: 'Vendor payment',
  invoice: 'Vendor invoice',
  adjustment: 'Vendor adjustment',
  allocation: 'Payable allocation',
}

export const PAYMENT_PURPOSE_LABELS: Record<VendorPaymentPurpose, string> = {
  INVOICE_SETTLEMENT: 'Invoice settlement',
  ADVANCE: 'Advance',
  MIXED: 'Mixed',
}

export const PAYMENT_METHOD_LABELS: Record<VendorPaymentMethod, string> = {
  BANK_TRANSFER: 'Bank transfer',
  CASH: 'Cash',
  CHEQUE: 'Cheque',
  UPI: 'UPI',
  CARD: 'Card',
  OTHER: 'Other',
}

export const PAYMENT_ALLOCATION_STATE_LABELS: Record<string, string> = {
  UNALLOCATED: 'Unallocated',
  PARTIALLY_ALLOCATED: 'Partially allocated',
  FULLY_ALLOCATED: 'Fully allocated',
}

export function groupValidationIssues(issues: VendorInvoiceValidationIssue[]) {
  const errors = issues.filter((i) => i.severity === 'ERROR')
  const warnings = issues.filter((i) => i.severity === 'WARNING')
  const info = issues.filter((i) => i.severity === 'INFO')
  return { errors, warnings, info }
}

export const MONEY_OUT_WORKSPACE_TABS = [
  { label: 'Overview', path: '/accounting/money-out' },
  { label: 'Vendor Invoices', path: '/accounting/money-out/vendor-invoices' },
  { label: 'Vendor Payments', path: '/accounting/money-out/vendor-payments' },
  { label: 'Vendor Advances', path: '/accounting/money-out/vendor-advances' },
  { label: 'Vendor Adjustments', path: '/accounting/money-out/vendor-adjustments' },
  { label: 'Payables', path: '/accounting/money-out/payables' },
  { label: 'Outstanding', path: '/accounting/money-out/outstanding' },
  { label: 'Vendors', path: '/accounting/money-out/vendors' },
  { label: 'Ageing', path: '/accounting/money-out/ageing' },
  { label: 'Payment Planning', path: '/accounting/money-out/payment-planning' },
  { label: 'Approvals', path: '/accounting/money-out/approvals' },
  { label: 'Corrections', path: '/accounting/money-out/corrections' },
  { label: 'Reconciliation', path: '/accounting/money-out/reconciliation' },
  { label: 'Close Gate', path: '/accounting/money-out/close-gate' },
] as const

export function payableReconciliationStatusTone(
  status: PayableReconciliationStatus | null | undefined,
): ErpStatusChipTone {
  if (status === 'MATCHED') return 'success'
  if (status === 'MATCHED_WITH_WARNINGS') return 'warning'
  if (status === 'MISMATCHED' || status === 'FAILED') return 'critical'
  return 'neutral'
}

export function payableReconciliationRunStatusTone(status: PayableReconciliationRunStatus): ErpStatusChipTone {
  if (status === 'COMPLETED') return 'success'
  if (status === 'FAILED') return 'critical'
  return 'warning'
}

export function payableReconciliationExceptionSeverityTone(
  severity: PayableReconciliationExceptionSeverity,
): ErpStatusChipTone {
  if (severity === 'INFO') return 'neutral'
  if (severity === 'WARNING') return 'warning'
  return 'critical'
}

export function payableCloseGateStatusTone(status: PayableCloseGateStatus): ErpStatusChipTone {
  if (status === 'PASS') return 'success'
  if (status === 'PASS_WITH_WARNINGS') return 'warning'
  if (status === 'BLOCKED') return 'critical'
  return 'critical'
}

export function payableCloseGateCheckStatusTone(status: PayableCloseGateCheckStatus): ErpStatusChipTone {
  if (status === 'PASSED') return 'success'
  if (status === 'WARNING') return 'warning'
  return 'critical'
}

export function downloadBlobFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function parseDecimal(value: string | number | null | undefined): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function addDaysIso(dateIso: string, days: number) {
  const d = new Date(`${dateIso}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
