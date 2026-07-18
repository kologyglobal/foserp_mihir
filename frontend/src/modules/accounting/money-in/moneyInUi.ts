import type { ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import type { CalculationIssue, SalesInvoiceStatus } from '@/types/moneyIn'

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

export const MONEY_IN_WORKSPACE_TABS = [
  { label: 'Overview', path: '/accounting/money-in' },
  { label: 'Invoices', path: '/accounting/money-in/invoices' },
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
