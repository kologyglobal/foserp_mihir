import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import type { TreasuryChequeDirection, TreasuryChequeStatus } from '../api/treasury-cheque.types'
import { CHEQUE_DIRECTION_LABELS, CHEQUE_STATUS_LABELS, chequeDirectionTone, chequeStatusTone } from '../utils/treasuryChequeUi'

export function ChequeStatusChip({ status }: { status: TreasuryChequeStatus }) {
  return <ErpStatusChip tone={chequeStatusTone(status)} label={CHEQUE_STATUS_LABELS[status] ?? status} />
}

export function ChequeDirectionChip({ direction }: { direction: TreasuryChequeDirection }) {
  return <ErpStatusChip tone={chequeDirectionTone(direction)} label={CHEQUE_DIRECTION_LABELS[direction] ?? direction} />
}
