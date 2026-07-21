import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import type { TreasuryTransferPostingMode, TreasuryTransferStatus } from '../api/treasury-transfer.types'
import { TRANSFER_POSTING_MODE_LABELS, TRANSFER_STATUS_LABELS, transferPostingModeTone, transferStatusTone } from '../utils/treasuryTransferUi'

export function TransferStatusChip({ status }: { status: TreasuryTransferStatus }) {
  return <ErpStatusChip tone={transferStatusTone(status)} label={TRANSFER_STATUS_LABELS[status] ?? status} />
}

export function TransferPostingModeChip({ mode }: { mode: TreasuryTransferPostingMode }) {
  return <ErpStatusChip tone={transferPostingModeTone(mode)} label={TRANSFER_POSTING_MODE_LABELS[mode] ?? mode} />
}
