import type { ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import type { TreasuryChequeDirection, TreasuryChequeStatus } from '../api/treasury-cheque.types'

export const CHEQUE_STATUS_LABELS: Record<TreasuryChequeStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  REJECTED: 'Rejected',
  READY: 'Ready',
  ISSUED: 'Issued',
  DEPOSITED: 'Deposited',
  CLEARED: 'Cleared',
  BOUNCED: 'Bounced',
  STOPPED: 'Stopped',
  CANCELLED: 'Cancelled',
  REVERSED: 'Reversed',
}

/** Human labels for direction — avoid raw enum noise (ISSUED/RECEIVED) in the UI. */
export const CHEQUE_DIRECTION_LABELS: Record<TreasuryChequeDirection, string> = {
  ISSUED: 'Issued (Payment)',
  RECEIVED: 'Received (Collection)',
}

/** Live cheque sub-routes under Bank & Cash (API mode) — Phase 5B2. */
export const CHEQUE_LIVE_LINKS = [{ label: 'Cheques', path: '/accounting/bank-cash/cheques' }] as const

export function chequeStatusTone(status: TreasuryChequeStatus): ErpStatusChipTone {
  switch (status) {
    case 'CLEARED':
      return 'success'
    case 'READY':
    case 'ISSUED':
    case 'DEPOSITED':
    case 'PENDING_APPROVAL':
      return 'warning'
    case 'REJECTED':
    case 'BOUNCED':
      return 'critical'
    case 'DRAFT':
      return 'neutral'
    case 'STOPPED':
    case 'CANCELLED':
    case 'REVERSED':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function chequeDirectionTone(direction: TreasuryChequeDirection): ErpStatusChipTone {
  return direction === 'ISSUED' ? 'info' : 'success'
}

export const CHEQUE_STATUS_OPTIONS: Array<{ value: '' | TreasuryChequeStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  ...Object.entries(CHEQUE_STATUS_LABELS).map(([value, label]) => ({ value: value as TreasuryChequeStatus, label })),
]

export const CHEQUE_DIRECTION_OPTIONS: Array<{ value: '' | TreasuryChequeDirection; label: string }> = [
  { value: '', label: 'All directions' },
  ...Object.entries(CHEQUE_DIRECTION_LABELS).map(([value, label]) => ({ value: value as TreasuryChequeDirection, label })),
]

/** Statuses where the record is still editable as a draft-like state. */
export const CHEQUE_OPEN_STATUSES: TreasuryChequeStatus[] = ['DRAFT', 'REJECTED', 'READY', 'PENDING_APPROVAL']

/** Statuses where the cheque has been posted to the ledger (issue/deposit leg). */
export const CHEQUE_POSTED_STATUSES: TreasuryChequeStatus[] = ['ISSUED', 'DEPOSITED']
