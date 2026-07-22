import type { TreasuryChequeDto } from '../api/treasury-cheque.types'
import { formatChequeAmount, formatChequeDate } from '../utils/format'
import { ChequeDirectionChip } from './ChequeStatusChip'

export function ChequeSummaryPanel({ cheque }: { cheque: TreasuryChequeDto }) {
  return (
    <div className="rounded-lg border border-erp-border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ChequeDirectionChip direction={cheque.direction} />
        {cheque.isPdc ? <span className="text-[12px] font-semibold text-amber-700">Post-dated</span> : null}
        {cheque.isTrackOnly ? <span className="text-[12px] text-erp-muted">Track only — no GL posting</span> : null}
      </div>
      <div className="grid gap-3 text-[12px] sm:grid-cols-2">
        <div>
          <span className="text-erp-muted">Cheque number</span>
          <p className="font-mono font-medium text-erp-text">{cheque.chequeNumber}</p>
        </div>
        <div>
          <span className="text-erp-muted">Cheque date</span>
          <p className="font-medium text-erp-text">{formatChequeDate(cheque.chequeDate)}</p>
        </div>
        <div>
          <span className="text-erp-muted">Payee / Drawer</span>
          <p className="font-medium text-erp-text">{cheque.payeeOrDrawerName}</p>
        </div>
        <div>
          <span className="text-erp-muted">Amount</span>
          <p className="font-semibold tabular-nums text-erp-text">{formatChequeAmount(cheque.amount)}</p>
        </div>
        {cheque.bankName ? (
          <div>
            <span className="text-erp-muted">Bank</span>
            <p className="font-medium text-erp-text">
              {cheque.bankName}
              {cheque.branchName ? `, ${cheque.branchName}` : ''}
            </p>
          </div>
        ) : null}
        {cheque.ifsc ? (
          <div>
            <span className="text-erp-muted">IFSC</span>
            <p className="font-mono font-medium text-erp-text">{cheque.ifsc}</p>
          </div>
        ) : null}
        {cheque.isPdc && cheque.pdcMaturityDate ? (
          <div>
            <span className="text-erp-muted">PDC maturity date</span>
            <p className="font-medium text-erp-text">{formatChequeDate(cheque.pdcMaturityDate)}</p>
          </div>
        ) : null}
        <div>
          <span className="text-erp-muted">Reference</span>
          <p className="font-mono font-medium text-erp-text">{cheque.chequeRegisterNumber || cheque.draftReference}</p>
        </div>
        {cheque.narration ? (
          <div className="sm:col-span-2">
            <span className="text-erp-muted">Narration</span>
            <p className="font-medium text-erp-text">{cheque.narration}</p>
          </div>
        ) : null}
        {cheque.internalNote ? (
          <div className="sm:col-span-2">
            <span className="text-erp-muted">Internal note</span>
            <p className="font-medium text-erp-text">{cheque.internalNote}</p>
          </div>
        ) : null}
        {cheque.bounceReason ? (
          <div className="sm:col-span-2">
            <span className="text-erp-muted">Bounce reason</span>
            <p className="font-medium text-rose-700">{cheque.bounceReason}</p>
          </div>
        ) : null}
        {cheque.stopReason ? (
          <div className="sm:col-span-2">
            <span className="text-erp-muted">Stop reason</span>
            <p className="font-medium text-rose-700">{cheque.stopReason}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
