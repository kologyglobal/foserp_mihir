import { formatCurrency } from '@/utils/formatters/currency'
import type { SessionSummaryDto } from '../api/bank-reconciliation.types'
import { parseDecimal } from '../utils/bankReconciliationUi'

function Card({ label, value, tone }: { label: string; value: string; tone?: 'default' | 'warning' | 'critical' | 'success' }) {
  const toneClass =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50'
      : tone === 'critical'
        ? 'border-rose-200 bg-rose-50'
        : tone === 'success'
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-erp-border bg-white'
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-wide text-erp-muted">{label}</p>
      <p className="mt-1 text-[16px] font-semibold tabular-nums text-erp-text">{value}</p>
    </div>
  )
}

/** Header summary tiles for the reconciliation workspace — statement/book match progress + difference. */
export function ReconciliationSummaryCards({ summary }: { summary: SessionSummaryDto }) {
  const difference = summary.reconciliationDifference != null ? parseDecimal(summary.reconciliationDifference) : null

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card label="Statement lines" value={String(summary.lineCount)} />
      <Card
        label="Matched"
        value={`${summary.matchedLineCount} / ${summary.lineCount}`}
        tone={summary.matchedLineCount === summary.lineCount && summary.lineCount > 0 ? 'success' : 'default'}
      />
      <Card
        label="Unmatched / Partial"
        value={String(summary.unmatchedLineCount + summary.partiallyMatchedLineCount)}
        tone={summary.unmatchedLineCount + summary.partiallyMatchedLineCount > 0 ? 'warning' : 'default'}
      />
      <Card
        label="Open exceptions"
        value={String(summary.openExceptionCount)}
        tone={summary.openExceptionCount > 0 ? 'critical' : 'default'}
      />
      <Card label="Matched statement amount" value={formatCurrency(parseDecimal(summary.matchedStatementAmount))} />
      <Card label="Unmatched statement amount" value={formatCurrency(parseDecimal(summary.unmatchedStatementAmount))} />
      <Card label="Pending suggestions" value={String(summary.pendingSuggestionCount)} />
      <Card
        label="Reconciliation difference"
        value={difference != null ? formatCurrency(difference) : '—'}
        tone={difference != null && Math.abs(difference) > 0.005 ? 'warning' : 'default'}
      />
    </div>
  )
}
