import type { TreasuryTransferDto } from '../api/treasury-transfer.types'
import { TRANSFER_PURPOSE_LABELS } from '../utils/treasuryTransferUi'
import { formatAccountLabel, formatTransferAmount, formatTransferDate } from '../utils/format'
import { TransferPostingModeChip } from './TransferStatusChip'
import { TransferTypeChip } from './TransferTypeChip'

export function TransferSummaryPanel({ transfer }: { transfer: TreasuryTransferDto }) {
  return (
    <div className="rounded-lg border border-erp-border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TransferTypeChip type={transfer.transferType} />
        <TransferPostingModeChip mode={transfer.postingMode} />
        <span className="text-[12px] text-erp-muted">{TRANSFER_PURPOSE_LABELS[transfer.transferPurpose]}</span>
      </div>
      <div className="grid gap-3 text-[12px] sm:grid-cols-2">
        <div>
          <span className="text-erp-muted">From</span>
          <p className="font-medium text-erp-text">{formatAccountLabel(transfer.sourceAccount)}</p>
        </div>
        <div>
          <span className="text-erp-muted">To</span>
          <p className="font-medium text-erp-text">{formatAccountLabel(transfer.destinationAccount)}</p>
        </div>
        <div>
          <span className="text-erp-muted">Amount</span>
          <p className="font-semibold tabular-nums text-erp-text">{formatTransferAmount(transfer.transferAmount)}</p>
        </div>
        <div>
          <span className="text-erp-muted">Transfer date</span>
          <p className="font-medium text-erp-text">{formatTransferDate(transfer.transferDate)}</p>
        </div>
        <div>
          <span className="text-erp-muted">Reference</span>
          <p className="font-medium text-erp-text">{transfer.externalReference || '—'}</p>
        </div>
        <div>
          <span className="text-erp-muted">Transfer no.</span>
          <p className="font-mono font-medium text-erp-text">{transfer.transferNumber || transfer.draftReference}</p>
        </div>
        {transfer.narration ? (
          <div className="sm:col-span-2">
            <span className="text-erp-muted">Narration</span>
            <p className="font-medium text-erp-text">{transfer.narration}</p>
          </div>
        ) : null}
        {transfer.internalNote ? (
          <div className="sm:col-span-2">
            <span className="text-erp-muted">Internal note</span>
            <p className="font-medium text-erp-text">{transfer.internalNote}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
