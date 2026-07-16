import type { TrialBalanceRow } from '@/types/financialReports'
import { formatCurrency } from '@/utils/formatters/currency'
import { cn } from '@/utils/cn'

export type TrialBalanceDrilldownColumn =
  | 'opening_debit'
  | 'opening_credit'
  | 'period_debit'
  | 'period_credit'
  | 'closing_debit'
  | 'closing_credit'

function AmountButton({
  value,
  accountId,
  column,
  onDrillDown,
}: {
  value: number
  accountId: string
  column: TrialBalanceDrilldownColumn
  onDrillDown?: (accountId: string, column: TrialBalanceDrilldownColumn) => void
}) {
  if (value === 0) {
    return <span className="tabular-nums text-erp-muted">—</span>
  }
  const clickable = Boolean(onDrillDown)
  const className = 'tabular-nums text-right text-[12px]'
  if (clickable) {
    return (
      <button
        type="button"
        className={cn(className, 'w-full hover:text-erp-primary hover:underline')}
        onClick={() => onDrillDown?.(accountId, column)}
        title="Drill down to account ledger"
      >
        {formatCurrency(value)}
      </button>
    )
  }
  return <span className={className}>{formatCurrency(value)}</span>
}

export function TrialBalanceTable({
  rows,
  onDrillDown,
  totals,
  loading,
  className,
}: {
  rows: TrialBalanceRow[]
  onDrillDown?: (accountId: string, column: TrialBalanceDrilldownColumn) => void
  totals?: Pick<
    TrialBalanceRow,
    'openingDebit' | 'openingCredit' | 'periodDebit' | 'periodCredit' | 'closingDebit' | 'closingCredit'
  >
  loading?: boolean
  className?: string
}) {
  const thClass =
    'sticky top-0 z-10 whitespace-nowrap border-b border-erp-border bg-erp-surface px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-erp-muted'

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-erp-border bg-white', className)}>
      <table className="w-full min-w-[56rem] border-collapse text-[12px]">
        <thead>
          <tr>
            <th className={cn(thClass, 'left-0 z-20 min-w-[5rem] text-left')}>Account Code</th>
            <th className={cn(thClass, 'min-w-[12rem] text-left')}>Name</th>
            <th className={cn(thClass, 'text-right')}>Opening Dr</th>
            <th className={cn(thClass, 'text-right')}>Opening Cr</th>
            <th className={cn(thClass, 'text-right')}>Period Dr</th>
            <th className={cn(thClass, 'text-right')}>Period Cr</th>
            <th className={cn(thClass, 'text-right')}>Closing Dr</th>
            <th className={cn(thClass, 'text-right')}>Closing Cr</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-erp-border/50">
                {Array.from({ length: 8 }).map((__, j) => (
                  <td key={j} className="px-2 py-2">
                    <div className="h-4 animate-pulse rounded bg-erp-surface-alt" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-[13px] text-erp-muted">
                No trial balance rows for the selected period.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.accountId} className="border-b border-erp-border/50 hover:bg-erp-surface-alt/30">
                <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[11px] text-erp-text">
                  {row.accountCode}
                </td>
                <td className="px-2 py-1.5 text-erp-text">
                  <span className="font-medium">{row.accountName}</span>
                  {row.accountGroup ? (
                    <span className="ml-1.5 text-[10px] text-erp-muted">({row.accountGroup})</span>
                  ) : null}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <AmountButton value={row.openingDebit} accountId={row.accountId} column="opening_debit" onDrillDown={onDrillDown} />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <AmountButton value={row.openingCredit} accountId={row.accountId} column="opening_credit" onDrillDown={onDrillDown} />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <AmountButton value={row.periodDebit} accountId={row.accountId} column="period_debit" onDrillDown={onDrillDown} />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <AmountButton value={row.periodCredit} accountId={row.accountId} column="period_credit" onDrillDown={onDrillDown} />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <AmountButton value={row.closingDebit} accountId={row.accountId} column="closing_debit" onDrillDown={onDrillDown} />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <AmountButton value={row.closingCredit} accountId={row.accountId} column="closing_credit" onDrillDown={onDrillDown} />
                </td>
              </tr>
            ))
          )}
          {totals && !loading && rows.length > 0 ? (
            <tr className="border-t-2 border-erp-border bg-erp-surface-alt/60 font-semibold">
              <td colSpan={2} className="px-2 py-2 text-[12px] text-erp-text">
                Totals
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(totals.openingDebit)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(totals.openingCredit)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(totals.periodDebit)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(totals.periodCredit)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(totals.closingDebit)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(totals.closingCredit)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
