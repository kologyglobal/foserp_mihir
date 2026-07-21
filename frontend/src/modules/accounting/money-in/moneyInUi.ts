import type { ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import type { CalculationIssue, CustomerCreditNoteStatus, SalesInvoiceStatus } from '@/types/moneyIn'

export const MONEY_IN_STATUS_LABELS: Record<SalesInvoiceStatus, string> = {
  DRAFT: 'Draft',
  READY_TO_POST: 'Ready to Post',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled',
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
    default:
      return 'neutral'
  }
}

export const CREDIT_NOTE_STATUS_LABELS: Record<CustomerCreditNoteStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  READY_TO_POST: 'Ready to Post',
  POSTED: 'Posted',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
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

export const MONEY_IN_WORKSPACE_TABS = [
  { label: 'Overview', path: '/accounting/money-in' },
  { label: 'Invoices', path: '/accounting/money-in/invoices' },
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
