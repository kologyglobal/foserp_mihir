import { formatCurrency } from '@/utils/formatters/currency'
import type { SessionSummaryDto } from '../api/bank-reconciliation.types'
import { parseDecimal } from '../utils/bankReconciliationUi'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-erp-border/60 py-1.5 text-[12px] last:border-0">
      <span className="text-erp-muted">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

/** Statement vs book balance reconciliation — mirrors a classic bank reconciliation statement. */
export function DifferencePanel({ summary }: { summary: SessionSummaryDto }) {
  const difference = summary.reconciliationDifference != null ? parseDecimal(summary.reconciliationDifference) : null

  return (
    <div className="rounded-lg border border-erp-border bg-white p-4">
      <h3 className="mb-2 text-[13px] font-semibold text-erp-text">Reconciliation difference</h3>
      <Row label="Statement closing balance" value={formatCurrency(parseDecimal(summary.statementClosingBalance))} />
      <Row label="Matched statement amount" value={formatCurrency(parseDecimal(summary.matchedStatementAmount))} />
      <Row label="Unmatched statement amount" value={formatCurrency(parseDecimal(summary.unmatchedStatementAmount))} />
      <Row label="Matched book (ledger) amount" value={formatCurrency(parseDecimal(summary.matchedBookAmount))} />
      <Row label="Unmatched book (ledger) amount" value={formatCurrency(parseDecimal(summary.unmatchedBookAmount))} />
      {summary.adjustedStatementBalance != null ? (
        <Row label="Adjusted statement balance" value={formatCurrency(parseDecimal(summary.adjustedStatementBalance))} />
      ) : null}
      {summary.adjustedBookBalance != null ? (
        <Row label="Adjusted book balance" value={formatCurrency(parseDecimal(summary.adjustedBookBalance))} />
      ) : null}
      <div className="mt-2 flex items-center justify-between pt-2">
        <span className="text-[12px] font-semibold text-erp-text">Difference</span>
        <span
          className={`text-[14px] font-semibold tabular-nums ${
            difference != null && Math.abs(difference) > 0.005 ? 'text-rose-700' : 'text-emerald-700'
          }`}
        >
          {difference != null ? formatCurrency(difference) : 'Not yet computed'}
        </span>
      </div>
    </div>
  )
}
