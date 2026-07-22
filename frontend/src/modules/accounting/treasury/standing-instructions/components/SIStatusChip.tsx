import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import type { StandingInstructionStatus } from '../api/standing-instruction.types'
import { SI_STATUS_LABELS, siStatusTone } from '../utils/standingInstructionUi'

export function SIStatusChip({ status }: { status: StandingInstructionStatus }) {
  return <ErpStatusChip tone={siStatusTone(status)} label={SI_STATUS_LABELS[status] ?? status} />
}
