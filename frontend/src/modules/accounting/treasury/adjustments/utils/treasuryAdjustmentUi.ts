import type { ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import type {
  GstTreatment,
  TdsTreatment,
  TreasuryAdjustmentDirection,
  TreasuryAdjustmentLineType,
  TreasuryAdjustmentStatus,
  TreasuryAdjustmentType,
} from '../api/treasury-adjustment.types'

export const ADJUSTMENT_STATUS_LABELS: Record<TreasuryAdjustmentStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  REJECTED: 'Rejected',
  READY_TO_POST: 'Ready to Post',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled',
  REVERSED: 'Reversed',
}

export const ADJUSTMENT_TYPE_LABELS: Record<TreasuryAdjustmentType, string> = {
  BANK_CHARGES: 'Bank Charges',
  BANK_INTEREST_INCOME: 'Bank Interest Income',
  BANK_INTEREST_EXPENSE: 'Bank Interest Expense',
  COLLECTION_FEE: 'Collection Fee',
  MERCHANT_FEE: 'Merchant Fee',
  DIRECT_DEBIT: 'Direct Debit',
  DIRECT_CREDIT: 'Direct Credit',
  STANDING_INSTRUCTION_DEBIT: 'Standing Instruction (Debit)',
  STANDING_INSTRUCTION_CREDIT: 'Standing Instruction (Credit)',
  GST_ADJUSTMENT: 'GST Adjustment',
  OTHER_BANK_DEBIT: 'Other Bank Debit',
  OTHER_BANK_CREDIT: 'Other Bank Credit',
}

export const ADJUSTMENT_DIRECTION_LABELS: Record<TreasuryAdjustmentDirection, string> = {
  BANK_DEBIT: 'Bank Debit (Money Out)',
  BANK_CREDIT: 'Bank Credit (Money In)',
}

export const ADJUSTMENT_LINE_TYPE_LABELS: Record<TreasuryAdjustmentLineType, string> = {
  EXPENSE: 'Expense',
  INCOME: 'Income',
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  RECOVERABLE_TAX: 'Recoverable Tax',
  NON_RECOVERABLE_TAX: 'Non-recoverable Tax',
  TDS_RECEIVABLE: 'TDS Receivable',
  ROUND_OFF: 'Round Off',
  OTHER: 'Other',
}

export const GST_TREATMENT_LABELS: Record<GstTreatment, string> = {
  GST_APPLICABLE: 'GST Applicable',
  GST_NOT_APPLICABLE: 'Not Applicable',
  GST_NON_RECOVERABLE: 'Non-recoverable',
  GST_PENDING_REVIEW: 'Pending Review',
}

export const TDS_TREATMENT_LABELS: Record<TdsTreatment, string> = {
  TDS_NOT_APPLICABLE: 'Not Applicable',
  TDS_DEDUCTED: 'Deducted',
  TDS_PENDING_REVIEW: 'Pending Review',
}

/** Live treasury-adjustment sub-routes under Bank & Cash (API mode) — Phase 5B3. */
export const ADJUSTMENT_LIVE_LINKS = [{ label: 'Bank Transactions', path: '/accounting/bank-cash/treasury-adjustments' }] as const

export function adjustmentStatusTone(status: TreasuryAdjustmentStatus): ErpStatusChipTone {
  switch (status) {
    case 'POSTED':
      return 'success'
    case 'READY_TO_POST':
    case 'PENDING_APPROVAL':
      return 'warning'
    case 'REJECTED':
      return 'critical'
    case 'DRAFT':
    case 'CANCELLED':
    case 'REVERSED':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function adjustmentDirectionTone(direction: TreasuryAdjustmentDirection): ErpStatusChipTone {
  return direction === 'BANK_CREDIT' ? 'success' : 'info'
}

export const ADJUSTMENT_STATUS_OPTIONS: Array<{ value: '' | TreasuryAdjustmentStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  ...Object.entries(ADJUSTMENT_STATUS_LABELS).map(([value, label]) => ({ value: value as TreasuryAdjustmentStatus, label })),
]

export const ADJUSTMENT_TYPE_OPTIONS: Array<{ value: '' | TreasuryAdjustmentType; label: string }> = [
  { value: '', label: 'All types' },
  ...Object.entries(ADJUSTMENT_TYPE_LABELS).map(([value, label]) => ({ value: value as TreasuryAdjustmentType, label })),
]

export const ADJUSTMENT_LINE_TYPE_OPTIONS: Array<{ value: TreasuryAdjustmentLineType; label: string }> = Object.entries(
  ADJUSTMENT_LINE_TYPE_LABELS,
).map(([value, label]) => ({ value: value as TreasuryAdjustmentLineType, label }))

export const GST_TREATMENT_OPTIONS: Array<{ value: GstTreatment; label: string }> = Object.entries(GST_TREATMENT_LABELS).map(
  ([value, label]) => ({ value: value as GstTreatment, label }),
)

export const TDS_TREATMENT_OPTIONS: Array<{ value: TdsTreatment; label: string }> = Object.entries(TDS_TREATMENT_LABELS).map(
  ([value, label]) => ({ value: value as TdsTreatment, label }),
)
