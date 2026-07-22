import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate, formatDateTime } from '@/utils/dates/format'

export function parseDecimal(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function formatAdjustmentAmount(value: string | number | null | undefined): string {
  return formatCurrency(parseDecimal(value))
}

export function formatAdjustmentDate(value: string | null | undefined): string {
  return formatDate(value)
}

export function formatAdjustmentDateTime(value: string | null | undefined): string {
  return formatDateTime(value)
}

export function toIsoDateInput(value: string | null | undefined): string {
  if (!value) return ''
  return value.length >= 10 ? value.slice(0, 10) : value
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  BANK_CHARGES: 'Bank Charges',
  BANK_INTEREST_INCOME: 'Bank Interest Income',
  BANK_INTEREST_EXPENSE: 'Bank Interest Expense',
  COLLECTION_FEE: 'Collection Fee',
  MERCHANT_FEE: 'Merchant Fee',
  DIRECT_DEBIT: 'Direct Debit',
  DIRECT_CREDIT: 'Direct Credit',
  STANDING_INSTRUCTION_DEBIT: 'Standing Instruction Debit',
  STANDING_INSTRUCTION_CREDIT: 'Standing Instruction Credit',
  GST_ADJUSTMENT: 'GST Adjustment',
  OTHER_BANK_DEBIT: 'Other Bank Debit',
  OTHER_BANK_CREDIT: 'Other Bank Credit',
}

export const ADJUSTMENT_TYPE_OPTIONS = Object.entries(ADJUSTMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))

export const ADJUSTMENT_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'READY_TO_POST', label: 'Ready to Post' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REVERSED', label: 'Reversed' },
]

export const LINE_TYPE_OPTIONS = [
  { value: 'EXPENSE', label: 'Expense' },
  { value: 'INCOME', label: 'Income' },
  { value: 'ASSET', label: 'Asset' },
  { value: 'LIABILITY', label: 'Liability' },
  { value: 'RECOVERABLE_TAX', label: 'Recoverable Tax' },
  { value: 'NON_RECOVERABLE_TAX', label: 'Non-recoverable Tax' },
  { value: 'TDS_RECEIVABLE', label: 'TDS Receivable' },
  { value: 'ROUND_OFF', label: 'Round Off' },
  { value: 'OTHER', label: 'Other' },
]

export const GST_TREATMENT_OPTIONS = [
  { value: 'GST_NOT_APPLICABLE', label: 'GST Not Applicable' },
  { value: 'GST_APPLICABLE', label: 'GST Applicable' },
  { value: 'GST_NON_RECOVERABLE', label: 'GST Non-recoverable' },
  { value: 'GST_PENDING_REVIEW', label: 'GST Pending Review' },
]

export const TDS_TREATMENT_OPTIONS = [
  { value: 'TDS_NOT_APPLICABLE', label: 'TDS Not Applicable' },
  { value: 'TDS_DEDUCTED', label: 'TDS Deducted' },
  { value: 'TDS_PENDING_REVIEW', label: 'TDS Pending Review' },
]
