import type { TreasuryAdjustmentDto } from '../api/treasury-adjustment.types'
import { ADJUSTMENT_TYPE_LABELS, formatAdjustmentAmount, formatAdjustmentDate } from '../utils/format'
import { AdjustmentLinesPanel } from './AdjustmentLinesPanel'

export function AdjustmentSummaryPanel({ adjustment }: { adjustment: TreasuryAdjustmentDto }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-erp-border bg-white p-4">
        <h3 className="mb-3 text-[13px] font-semibold text-erp-text">Summary</h3>
        <dl className="grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-3">
          <div>
            <dt className="font-semibold uppercase text-[11px] text-erp-muted">Type</dt>
            <dd>{ADJUSTMENT_TYPE_LABELS[adjustment.adjustmentType] ?? adjustment.adjustmentType}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase text-[11px] text-erp-muted">Direction</dt>
            <dd>{adjustment.direction === 'BANK_DEBIT' ? 'Bank Debit (money out)' : 'Bank Credit (money in)'}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase text-[11px] text-erp-muted">Date</dt>
            <dd>{formatAdjustmentDate(adjustment.adjustmentDate)}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase text-[11px] text-erp-muted">Bank amount</dt>
            <dd className="font-semibold tabular-nums">
              {formatAdjustmentAmount(adjustment.bankAmount)} {adjustment.currencyCode}
            </dd>
          </div>
          <div>
            <dt className="font-semibold uppercase text-[11px] text-erp-muted">Source</dt>
            <dd>
              {adjustment.sourceMode === 'MANUAL'
                ? 'Manual'
                : adjustment.sourceMode === 'BANK_STATEMENT'
                  ? 'Bank statement'
                  : 'Standing instruction'}
            </dd>
          </div>
          <div>
            <dt className="font-semibold uppercase text-[11px] text-erp-muted">Voucher</dt>
            <dd>{adjustment.voucherNumber ?? 'â€”'}</dd>
          </div>
          {adjustment.narration ? (
            <div className="col-span-2 sm:col-span-3">
              <dt className="font-semibold uppercase text-[11px] text-erp-muted">Narration</dt>
              <dd>{adjustment.narration}</dd>
            </div>
          ) : null}
          {adjustment.internalNote ? (
            <div className="col-span-2 sm:col-span-3">
              <dt className="font-semibold uppercase text-[11px] text-erp-muted">Internal note</dt>
              <dd>{adjustment.internalNote}</dd>
            </div>
          ) : null}
          {adjustment.rejectionReason ? (
            <div className="col-span-2 sm:col-span-3">
              <dt className="font-semibold uppercase text-[11px] text-rose-600">Rejection reason</dt>
              <dd>{adjustment.rejectionReason}</dd>
            </div>
          ) : null}
          {adjustment.cancellationReason ? (
            <div className="col-span-2 sm:col-span-3">
              <dt className="font-semibold uppercase text-[11px] text-erp-muted">Cancellation reason</dt>
              <dd>{adjustment.cancellationReason}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="rounded-lg border border-erp-border bg-white p-4">
        <h3 className="mb-3 text-[13px] font-semibold text-erp-text">Offset lines</h3>
        <AdjustmentLinesPanel lines={adjustment.lines} />
      </div>
    </div>
  )
}
