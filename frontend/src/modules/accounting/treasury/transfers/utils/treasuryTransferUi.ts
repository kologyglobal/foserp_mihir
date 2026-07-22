import type { ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import type {
  TreasuryTransferPostingMode,
  TreasuryTransferPurpose,
  TreasuryTransferStatus,
  TreasuryTransferType,
} from '../api/treasury-transfer.types'

export const TRANSFER_STATUS_LABELS: Record<TreasuryTransferStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  REJECTED: 'Rejected',
  READY_TO_POST: 'Ready to Post',
  IN_TRANSIT: 'In Transit',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REVERSED: 'Reversed',
}

export const TRANSFER_TYPE_LABELS: Record<TreasuryTransferType, string> = {
  BANK_TO_BANK: 'Bank → Bank',
  BANK_TO_CASH: 'Bank → Cash',
  CASH_TO_BANK: 'Cash → Bank',
  CASH_TO_CASH: 'Cash → Cash',
}

export const TRANSFER_POSTING_MODE_LABELS: Record<TreasuryTransferPostingMode, string> = {
  DIRECT: 'Direct',
  IN_TRANSIT: 'In Transit (clearing)',
}

export const TRANSFER_PURPOSE_LABELS: Record<TreasuryTransferPurpose, string> = {
  FUND_MOVEMENT: 'Fund Movement',
  CASH_REPLENISHMENT: 'Cash Replenishment',
  CASH_DEPOSIT: 'Cash Deposit',
  BANK_ACCOUNT_BALANCING: 'Bank Account Balancing',
  INTER_BRANCH_FUNDING: 'Inter-branch Funding',
  PETTY_CASH_REPLENISHMENT: 'Petty Cash Replenishment',
  OTHER: 'Other',
}

/** Live transfer sub-routes under Bank & Cash (API mode) — Phase 5B1. */
export const TRANSFER_LIVE_LINKS = [
  { label: 'Transfers', path: '/accounting/bank-cash/transfers' },
  { label: 'In Transit', path: '/accounting/bank-cash/transfers/in-transit' },
  { label: 'Approvals', path: '/accounting/bank-cash/transfers/approvals' },
] as const

export function transferStatusTone(status: TreasuryTransferStatus): ErpStatusChipTone {
  switch (status) {
    case 'COMPLETED':
      return 'success'
    case 'READY_TO_POST':
    case 'IN_TRANSIT':
    case 'PENDING_APPROVAL':
      return 'warning'
    case 'REJECTED':
      return 'critical'
    case 'DRAFT':
      return 'neutral'
    case 'CANCELLED':
    case 'REVERSED':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function transferPostingModeTone(mode: TreasuryTransferPostingMode): ErpStatusChipTone {
  return mode === 'DIRECT' ? 'info' : 'warning'
}

export function parseDecimal(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Best-effort masking when the backend does not supply a pre-masked account number. */
export function maskAccountNumber(raw: string | null | undefined): string {
  if (!raw) return '—'
  const digits = raw.replace(/\s+/g, '')
  if (digits.length <= 4) return digits
  return `••••${digits.slice(-4)}`
}

export const TRANSFER_STATUS_OPTIONS: Array<{ value: '' | TreasuryTransferStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  ...Object.entries(TRANSFER_STATUS_LABELS).map(([value, label]) => ({ value: value as TreasuryTransferStatus, label })),
]

export const TRANSFER_TYPE_OPTIONS: Array<{ value: '' | TreasuryTransferType; label: string }> = [
  { value: '', label: 'All types' },
  ...Object.entries(TRANSFER_TYPE_LABELS).map(([value, label]) => ({ value: value as TreasuryTransferType, label })),
]

export const TRANSFER_PURPOSE_OPTIONS: Array<{ value: TreasuryTransferPurpose; label: string }> = Object.entries(
  TRANSFER_PURPOSE_LABELS,
).map(([value, label]) => ({ value: value as TreasuryTransferPurpose, label }))

/** Derives the transfer type from a pair of account types — mirrors backend enum derivation. */
export function deriveTransferType(
  sourceAccountType: 'BANK' | 'CASH' | undefined,
  destinationAccountType: 'BANK' | 'CASH' | undefined,
): TreasuryTransferType | null {
  if (!sourceAccountType || !destinationAccountType) return null
  if (sourceAccountType === 'BANK' && destinationAccountType === 'BANK') return 'BANK_TO_BANK'
  if (sourceAccountType === 'BANK' && destinationAccountType === 'CASH') return 'BANK_TO_CASH'
  if (sourceAccountType === 'CASH' && destinationAccountType === 'BANK') return 'CASH_TO_BANK'
  return 'CASH_TO_CASH'
}

/** Statuses where the record is still editable as a draft (edit/validate/submit/delete). */
export const DRAFT_LIKE_STATUSES: TreasuryTransferStatus[] = ['DRAFT', 'REJECTED']

/** Statuses where dispatch is the next in-transit action. */
export const DISPATCHABLE_STATUSES: TreasuryTransferStatus[] = ['READY_TO_POST']

/** Statuses where receipt closes out an in-transit transfer. */
export const RECEIVABLE_STATUSES: TreasuryTransferStatus[] = ['IN_TRANSIT']

/** Statuses eligible for reversal. */
export const REVERSIBLE_STATUSES: TreasuryTransferStatus[] = ['COMPLETED']
