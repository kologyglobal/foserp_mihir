import { ErpStatusChip, type ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import type { TreasuryAdjustmentStatus } from '../api/treasury-adjustment.types'

const STATUS_LABELS: Record<TreasuryAdjustmentStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  REJECTED: 'Rejected',
  READY_TO_POST: 'Ready to Post',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled',
  REVERSED: 'Reversed',
}

const STATUS_TONES: Record<TreasuryAdjustmentStatus, ErpStatusChipTone> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'pending',
  REJECTED: 'critical',
  READY_TO_POST: 'info',
  POSTED: 'success',
  CANCELLED: 'neutral',
  REVERSED: 'warning',
}

export function AdjustmentStatusChip({ status }: { status: TreasuryAdjustmentStatus }) {
  return <ErpStatusChip tone={STATUS_TONES[status] ?? 'neutral'} label={STATUS_LABELS[status] ?? status} />
}
