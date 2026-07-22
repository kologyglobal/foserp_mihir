import type { ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import type { StandingInstructionAmountMode, StandingInstructionFrequency, StandingInstructionStatus } from '../api/standing-instruction.types'
import { ADJUSTMENT_TYPE_LABELS } from '../../adjustments/utils/treasuryAdjustmentUi'

export { ADJUSTMENT_TYPE_LABELS }

export const SI_STATUS_LABELS: Record<StandingInstructionStatus, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
}

export const SI_FREQUENCY_LABELS: Record<StandingInstructionFrequency, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half-yearly',
  YEARLY: 'Yearly',
}

export const SI_AMOUNT_MODE_LABELS: Record<StandingInstructionAmountMode, string> = {
  FIXED: 'Fixed amount',
  VARIABLE: 'Variable (enter at generation time)',
}

/** Live standing-instruction sub-routes under Bank & Cash (API mode) — Phase 5B3. */
export const SI_LIVE_LINKS = [{ label: 'Standing Instructions', path: '/accounting/bank-cash/standing-instructions' }] as const

export function siStatusTone(status: StandingInstructionStatus): ErpStatusChipTone {
  switch (status) {
    case 'ACTIVE':
      return 'success'
    case 'PAUSED':
      return 'warning'
    case 'CANCELLED':
    case 'EXPIRED':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export const SI_STATUS_OPTIONS: Array<{ value: '' | StandingInstructionStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  ...Object.entries(SI_STATUS_LABELS).map(([value, label]) => ({ value: value as StandingInstructionStatus, label })),
]

export const SI_FREQUENCY_OPTIONS: Array<{ value: StandingInstructionFrequency; label: string }> = Object.entries(
  SI_FREQUENCY_LABELS,
).map(([value, label]) => ({ value: value as StandingInstructionFrequency, label }))
