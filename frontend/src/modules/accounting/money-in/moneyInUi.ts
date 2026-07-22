import type { ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import type {
  CalculationIssue,
  CustomerCreditNoteStatus,
  CustomerReceiptStatus,
  SalesInvoiceDto,
  SalesInvoiceSettlementStatus,
  SalesInvoiceStatus,
} from '@/types/moneyIn'
import { isApiMode } from '../../../config/apiConfig'

export const MONEY_IN_STATUS_LABELS: Record<SalesInvoiceStatus, string> = {
  DRAFT: 'Draft',
  READY_TO_POST: 'Ready to Post',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled',
  REVERSED: 'Reversed',
}

export function moneyInStatusTone(status: SalesInvoiceStatus): ErpStatusChipTone {
  switch (status) {
    case 'DRAFT':
      return 'neutral'
    case 'READY_TO_POST':
      return 'warning'
    case 'POSTED':
      return 'success'
    case 'CANCELLED':
      return 'critical'
    case 'REVERSED':
      return 'critical'
    default:
      return 'neutral'
  }
}

/** Settlement / collection status labels for invoice list + detail chips. */
export const SETTLEMENT_STATUS_LABELS: Record<SalesInvoiceSettlementStatus, string> = {
  UNPAID: 'Unpaid',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  NOT_APPLICABLE: '—',
}

export function settlementStatusTone(status: SalesInvoiceSettlementStatus): ErpStatusChipTone {
  switch (status) {
    case 'PAID':
      return 'success'
    case 'PARTIALLY_PAID':
      return 'warning'
    case 'OVERDUE':
      return 'critical'
    case 'UNPAID':
      return 'neutral'
    default:
      return 'neutral'
  }
}

/** Client-side fallback when API omits settlementStatus (demo mode). */
export function resolveSettlementStatus(
  invoice: Pick<SalesInvoiceDto, 'status' | 'outstandingAmount' | 'amountPaid' | 'dueDate' | 'settlementStatus'>,
): SalesInvoiceSettlementStatus | null {
  if (invoice.settlementStatus) return invoice.settlementStatus
  if (invoice.status !== 'POSTED') return null
  const open = parseDecimal(invoice.outstandingAmount)
  const paid = parseDecimal(invoice.amountPaid)
  if (open <= 0) return 'PAID'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDay = invoice.dueDate ? new Date(invoice.dueDate) : null
  if (dueDay) dueDay.setHours(0, 0, 0, 0)
  const pastDue = Boolean(dueDay && !Number.isNaN(dueDay.getTime()) && dueDay.getTime() < today.getTime())
  if (paid > 0) return pastDue ? 'OVERDUE' : 'PARTIALLY_PAID'
  return pastDue ? 'OVERDUE' : 'UNPAID'
}

/** Canonical AR workspace base path for the active mode. */
export function moneyInBasePath(): string {
  return isApiMode() ? '/accounting/receivables' : '/accounting/money-in'
}

export function moneyInPath(subpath: string): string {
  const base = moneyInBasePath()
  if (!subpath || subpath === '/') return base
  return subpath.startsWith('/') ? `${base}${subpath}` : `${base}/${subpath}`
}

export const CREDIT_NOTE_STATUS_LABELS: Record<CustomerCreditNoteStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  READY_TO_POST: 'Ready to Post',
  POSTED: 'Posted',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  REVERSED: 'Reversed',
}

export function creditNoteStatusTone(status: CustomerCreditNoteStatus): ErpStatusChipTone {
  switch (status) {
    case 'DRAFT':
      return 'neutral'
    case 'PENDING_APPROVAL':
      return 'warning'
    case 'READY_TO_POST':
      return 'warning'
    case 'POSTED':
      return 'success'
    case 'REJECTED':
      return 'critical'
    case 'CANCELLED':
      return 'critical'
    case 'REVERSED':
      return 'critical'
    default:
      return 'neutral'
  }
}

export const RECEIPT_STATUS_LABELS: Record<CustomerReceiptStatus, string> = {
  DRAFT: 'Draft',
  READY_TO_POST: 'Ready to Post',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled',
  REVERSED: 'Reversed',
}

export function receiptStatusTone(status: CustomerReceiptStatus): ErpStatusChipTone {
  switch (status) {
    case 'DRAFT':
      return 'neutral'
    case 'READY_TO_POST':
      return 'warning'
    case 'POSTED':
      return 'success'
    case 'CANCELLED':
      return 'critical'
    case 'REVERSED':
      return 'critical'
    default:
      return 'neutral'
  }
}

export const MONEY_IN_ERROR_MESSAGES: Record<string, string> = {
  STALE_UPDATE: 'This invoice was changed by another user. Refresh and try again.',
  PERIOD_CLOSED: 'The accounting period is closed — choose an open period or reopen it.',
  CHANGED_AFTER_READY: 'Invoice changed after mark-ready — edit returns to draft.',
  ACCOUNT_MISSING: 'Required GL account mapping is missing. Check default mappings.',
  POSTING_IN_PROGRESS: 'Posting is already in progress — wait and refresh.',
  SALES_INVOICE_NOT_FOUND: 'Sales invoice not found.',
  SALES_INVOICE_VALIDATION_FAILED: 'Validation failed — review errors before continuing.',
  AR_HISTORICAL_AS_OF_NOT_SUPPORTED: 'Historical as-of dates are not supported for this report.',
  UNBALANCED: 'Invoice totals are unbalanced.',
  CUSTOMER_INACTIVE: 'Customer is inactive or not found.',
  INSUFFICIENT_LINES: 'At least one invoice line is required.',
  CREDIT_NOTE_NOT_FOUND: 'Credit note not found.',
  CUSTOMER_CREDIT_NOTE_NOT_FOUND: 'Credit note not found.',
  CREDIT_NOTE_LOCKED: 'Credit note is posted or cancelled — read-only.',
  CREDIT_NOTE_VALIDATION_FAILED: 'Validation failed — review errors before continuing.',
  ORIGINAL_INVOICE_REQUIRED: 'An original invoice is required for invoice-linked credit notes.',
  CREDIT_NOTE_ALLOCATION_NOTE_NOT_POSTED: 'Only posted credit notes can be allocated.',
  CREDIT_NOTE_ALLOCATION_CREDIT_MISSING: 'This credit note is missing its credit open item — contact finance.',
  CREDIT_NOTE_ALLOCATION_OVER_LIMIT: 'Allocation exceeds the unallocated credit note amount.',
  CREDIT_NOTE_ALLOCATION_EXCEEDS_CREDIT_NOTE: 'Allocation exceeds the unallocated credit note amount.',
  CREDIT_NOTE_ALLOCATION_EXCEEDS_INVOICE: 'Allocation exceeds the invoice outstanding amount.',
  CREDIT_NOTE_ALLOCATION_AMOUNT_INVALID: 'Allocation amount must be a positive number.',
  CREDIT_NOTE_ALLOCATION_CUSTOMER_MISMATCH: 'Selected invoice belongs to a different customer.',
  CREDIT_NOTE_ALLOCATION_CURRENCY_MISMATCH: 'Currency mismatch between credit note and invoice.',
  CREDIT_NOTE_ALLOCATION_OPEN_ITEM_INVALID: 'Selected invoice open item is not valid for allocation.',
  CREDIT_NOTE_ALLOCATION_DUPLICATE_OPEN_ITEM: 'The same invoice was selected more than once.',
  CREDIT_NOTE_ALLOCATION_INVOICE_NOT_FOUND: 'Selected invoice open item was not found.',
  CREDIT_NOTE_ALLOCATION_IDEMPOTENCY_KEY_REQUIRED: 'Missing idempotency key — retry the allocation.',
  CREDIT_NOTE_ALLOCATION_PAYLOAD_MISMATCH: 'Allocation request changed since the last attempt — refresh and retry.',
  CREDIT_NOTE_ALLOCATION_IN_PROGRESS: 'Another allocation is already in progress for this credit note — wait and refresh.',
  CREDIT_NOTE_ALLOCATION_CONCURRENT_CHANGE: 'Amounts changed elsewhere — refresh and retry the allocation.',
  CREDIT_NOTE_ALLOCATION_PERIOD_CLOSED: 'The accounting period for this allocation is closed.',
  CREDIT_NOTE_ALLOCATION_NOT_ALLOWED: 'You do not have permission to allocate credit notes.',
  CREDIT_NOTE_ALLOCATION_FAILED: 'Credit note allocation failed — try again.',
  CUSTOMER_RECEIPT_NOT_FOUND: 'Customer receipt not found.',
  CUSTOMER_RECEIPT_ALLOCATION_NOT_FOUND: 'Receipt allocation not found.',
  CUSTOMER_RECEIPT_ALLOCATION_CUSTOMER_MISMATCH: 'Receipt and invoice must belong to the same customer.',
  CUSTOMER_RECEIPT_ALLOCATION_SIDE_MISMATCH: 'Selected open item is not valid for this allocation.',
  CUSTOMER_RECEIPT_NOT_EDITABLE: 'Receipt is posted or cancelled — read-only.',
  CUSTOMER_RECEIPT_ALREADY_CANCELLED: 'Customer receipt is already cancelled.',
  CUSTOMER_RECEIPT_INVALID_STATUS: 'Invalid customer receipt status for this operation.',
  CUSTOMER_RECEIPT_STALE_UPDATE: 'This receipt was changed by another user. Refresh and try again.',
  CUSTOMER_RECEIPT_SOURCE_NOT_SUPPORTED: 'Source type BANK_IMPORT is not supported in this phase.',
  CUSTOMER_RECEIPT_DRAFT_CALCULATION_FAILED: 'Receipt calculation failed — review the amounts and try again.',
  CUSTOMER_RECEIPT_VALIDATION_FAILED: 'Validation failed — review errors before continuing.',
  CUSTOMER_RECEIPT_NOT_READY: 'Customer receipt is not ready to post.',
  CUSTOMER_RECEIPT_CHANGED_AFTER_VALIDATION: 'Customer receipt changed after validation — re-validate before proceeding.',
  CUSTOMER_RECEIPT_CHANGED_AFTER_READY: 'Receipt amounts changed since it was marked ready. Re-validate and mark ready before posting.',
  CUSTOMER_RECEIPT_CANCELLATION_REASON_REQUIRED: 'Cancellation reason is required.',
  CUSTOMER_RECEIPT_ALREADY_POSTED: 'Customer receipt is already posted.',
  CUSTOMER_RECEIPT_POSTING_VALIDATION_FAILED: 'Posting validation failed — review errors before continuing.',
  CUSTOMER_RECEIPT_POSTING_PERIOD_CLOSED: 'The accounting period is closed — choose an open period or reopen it.',
  CUSTOMER_RECEIPT_POSTING_PERIOD_UNDER_REVIEW: 'Accounting period is under review and cannot accept postings.',
  CUSTOMER_RECEIPT_ACCOUNT_NOT_READY: 'Required GL account mapping is missing. Check default mappings.',
  CUSTOMER_RECEIPT_NUMBER_SERIES_NOT_CONFIGURED: 'Customer receipt number series is not configured.',
  CUSTOMER_RECEIPT_CONCURRENT_POST: 'Another user posted this receipt concurrently. Refresh and retry if needed.',
  CUSTOMER_RECEIPT_POSTING_NOT_ALLOWED: 'You do not have permission to post customer receipts.',
  CUSTOMER_RECEIPT_POSTING_FAILED: 'Customer receipt posting failed — try again.',
  CUSTOMER_RECEIPT_INVALID_BANK_CASH_ACCOUNT: 'Bank/cash account must be an active BANK or CASH account in this legal entity.',
  CUSTOMER_RECEIPT_ACCOUNT_OWNERSHIP: 'Account does not belong to this legal entity.',
  RECEIPT_ALLOCATION_AMOUNT_INVALID: 'Allocation amount must be a positive number.',
  RECEIPT_ALLOCATION_EXCEEDS_RECEIPT: 'Allocation exceeds the unallocated receipt amount.',
  RECEIPT_ALLOCATION_EXCEEDS_INVOICE: 'Allocation exceeds the invoice outstanding amount.',
  RECEIPT_ALLOCATION_CUSTOMER_MISMATCH: 'Selected invoice belongs to a different customer.',
  RECEIPT_ALLOCATION_CURRENCY_MISMATCH: 'Currency mismatch between receipt and invoice.',
  RECEIPT_ALLOCATION_OPEN_ITEM_INVALID: 'Selected invoice open item is not valid for allocation.',
  RECEIPT_ALLOCATION_DUPLICATE_OPEN_ITEM: 'The same invoice was selected more than once.',
  RECEIPT_ALLOCATION_FOREX_REQUIRED: 'Cross-currency allocation is not supported in this phase.',
  RECEIPT_ALLOCATION_PAYLOAD_MISMATCH: 'Allocation request changed since the last attempt — refresh and retry.',
  RECEIPT_ALLOCATION_CONCURRENT_CHANGE: 'Amounts changed elsewhere — refresh and retry the allocation.',
  RECEIPT_ALLOCATION_RECEIPT_NOT_POSTED: 'Only posted receipts can be allocated.',
  RECEIPT_ALLOCATION_CREDIT_MISSING: 'This receipt is missing its credit open item — contact finance.',
  RECEIPT_ALLOCATION_IDEMPOTENCY_KEY_REQUIRED: 'Missing idempotency key — retry the allocation.',
  RECEIPT_ALLOCATION_PERIOD_CLOSED: 'The accounting period for this allocation is closed.',
  RECEIPT_ALLOCATION_PERIOD_UNDER_REVIEW: 'The accounting period for this allocation is under review.',
  RECEIPT_ALLOCATION_LEGAL_ENTITY_MISMATCH: 'Receipt and invoice must belong to the same legal entity.',
  RECEIPT_ALLOCATION_IN_PROGRESS: 'Another allocation is already in progress for this receipt — wait and refresh.',
  RECEIPT_ALLOCATION_NOT_ALLOWED: 'You do not have permission to allocate receipts.',
  RECEIPT_ALLOCATION_FAILED: 'Receipt allocation failed — try again.',
  RECEIPT_ALLOCATION_BATCH_NOT_FOUND: 'Allocation batch not found.',
  RECEIPT_ALLOCATION_BATCH_NOT_REVERSIBLE: 'Only posted allocation batches can be reversed.',
  CREDIT_NOTE_ALLOCATION_BATCH_NOT_FOUND: 'Allocation batch not found.',
  CREDIT_NOTE_ALLOCATION_BATCH_NOT_REVERSIBLE: 'Only posted allocation batches can be reversed.',
  CUSTOMER_RECEIPT_REVERSAL_NOT_ALLOWED: 'You do not have permission to reverse customer receipts.',
  CUSTOMER_RECEIPT_NOT_POSTED_FOR_REVERSAL: 'Only posted receipts can be reversed.',
  CUSTOMER_RECEIPT_ALLOCATIONS_MUST_BE_REVERSED: 'Reverse all posted allocations before reversing the receipt.',
  CUSTOMER_RECEIPT_REVERSAL_CREDIT_NOT_CLEAR: 'The receipt credit must be fully unallocated before reversal.',
  CUSTOMER_RECEIPT_REVERSAL_NOT_ELIGIBLE: 'This receipt cannot be reversed — refresh and check its status.',
  CUSTOMER_CREDIT_NOTE_REVERSAL_NOT_ALLOWED: 'You do not have permission to reverse credit notes.',
  CUSTOMER_CREDIT_NOTE_NOT_POSTED_FOR_REVERSAL: 'Only posted credit notes can be reversed.',
  CUSTOMER_CREDIT_NOTE_ALLOCATIONS_MUST_BE_REVERSED: 'Reverse all posted allocations before reversing the credit note.',
  CUSTOMER_CREDIT_NOTE_REVERSAL_CREDIT_NOT_CLEAR: 'The credit note credit must be fully unallocated before reversal.',
  CUSTOMER_CREDIT_NOTE_REVERSAL_NOT_ELIGIBLE: 'This credit note cannot be reversed — refresh and check its status.',
  SALES_INVOICE_REVERSAL_NOT_ALLOWED: 'You do not have permission to reverse sales invoices.',
  SALES_INVOICE_NOT_POSTED_FOR_REVERSAL: 'Only posted sales invoices can be reversed.',
  SALES_INVOICE_ALLOCATIONS_MUST_BE_REVERSED:
    'Reverse all posted receipt and credit-note allocations before reversing the invoice.',
  SALES_INVOICE_REVERSAL_DEBIT_NOT_CLEAR: 'The invoice debit must be fully unallocated before reversal.',
  SALES_INVOICE_REVERSAL_ELIGIBILITY: 'This invoice cannot be reversed — refresh and check its status.',
}

export function mapMoneyInError(code: string | undefined, fallback?: string): string {
  if (!code) return fallback ?? 'Something went wrong'
  return MONEY_IN_ERROR_MESSAGES[code] ?? fallback ?? code.replace(/_/g, ' ')
}

export function groupValidationIssues(issues: CalculationIssue[]) {
  const errors = issues.filter((i) => i.severity !== 'warning')
  const warnings = issues.filter((i) => i.severity === 'warning')
  return { errors, warnings }
}

export function invoiceDisplayNumber(inv: { invoiceNumber: string | null; draftReference: string | null }) {
  return inv.invoiceNumber ?? inv.draftReference ?? '—'
}

export function creditNoteDisplayNumber(note: { creditNoteNumber: string | null; draftReference: string | null }) {
  return note.creditNoteNumber ?? note.draftReference ?? '—'
}

export function receiptDisplayNumber(receipt: { receiptNumber: string | null; draftReference: string | null }) {
  return receipt.receiptNumber ?? receipt.draftReference ?? '—'
}

export const MONEY_IN_WORKSPACE_TABS = [
  { label: 'Overview', path: '/accounting/money-in' },
  { label: 'Invoices', path: '/accounting/money-in/invoices' },
  { label: 'Receipts', path: '/accounting/money-in/receipts' },
  { label: 'Credit Notes', path: '/accounting/money-in/credit-notes' },
  { label: 'Outstanding', path: '/accounting/money-in/outstanding' },
  { label: 'Customers', path: '/accounting/money-in/customers' },
  { label: 'Ageing', path: '/accounting/money-in/ageing' },
  { label: 'Reconciliation', path: '/accounting/money-in/reconciliation' },
] as const

export function parseDecimal(value: string | number | null | undefined): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export function formatDecimal(value: number, digits = 2): string {
  return value.toFixed(digits)
}

/** Simple intra-state GST line calculation for demo preview. */
export function previewLineTotal(qty: number, rate: number, gstPct = 18, discountPct = 0) {
  const gross = qty * rate
  const discount = gross * (discountPct / 100)
  const taxable = gross - discount
  const tax = taxable * (gstPct / 100)
  const half = tax / 2
  return {
    grossAmount: gross,
    discountAmount: discount,
    taxableAmount: taxable,
    cgstAmount: half,
    sgstAmount: half,
    igstAmount: 0,
    lineTotal: taxable + tax,
  }
}

export function previewInterLineTotal(qty: number, rate: number, gstPct = 18, discountPct = 0) {
  const gross = qty * rate
  const discount = gross * (discountPct / 100)
  const taxable = gross - discount
  const igst = taxable * (gstPct / 100)
  return {
    grossAmount: gross,
    discountAmount: discount,
    taxableAmount: taxable,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: igst,
    lineTotal: taxable + igst,
  }
}
