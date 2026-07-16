import type { StatementLine } from '@/types/financialReports'
import { formatCurrency } from '@/utils/formatters/currency'
import { cn } from '@/utils/cn'

function effectiveAmount(line: StatementLine): number {
  const raw = line.amount
  return line.signReversed ? -raw : raw
}

function formatStatementAmount(amount: number): { text: string; negative: boolean } {
  const negative = amount < 0
  const abs = Math.abs(amount)
  if (negative) {
    return { text: `(${formatCurrency(abs)})`, negative: true }
  }
  return { text: formatCurrency(amount), negative: false }
}

function AmountCell({
  line,
  onAmountClick,
  showPrior,
  showBudget,
  showVariance,
}: {
  line: StatementLine
  onAmountClick?: (line: StatementLine) => void
  showPrior?: boolean
  showBudget?: boolean
  showVariance?: boolean
}) {
  const amount = effectiveAmount(line)
  const { text, negative } = formatStatementAmount(amount)
  const clickable = Boolean(onAmountClick && (line.accountId || line.accountRange) && !line.isHeader)

  const cellClass = cn(
    'tabular-nums text-right text-[12px]',
    line.bold && 'font-semibold',
    negative && 'text-rose-600',
    line.underline && 'underline decoration-erp-border underline-offset-2',
  )

  const renderAmount = (value: number | undefined, key: string) => {
    if (value === undefined) return <td key={key} className="px-3 py-1.5 text-right text-[12px] text-erp-muted">—</td>
    const fmt = formatStatementAmount(value)
    return (
      <td key={key} className={cn('px-3 py-1.5', fmt.negative && 'text-rose-600', 'tabular-nums text-right text-[12px]')}>
        {fmt.text}
      </td>
    )
  }

  return (
    <>
      <td className="px-3 py-1.5">
        {clickable ? (
          <button
            type="button"
            className={cn(cellClass, 'w-full hover:text-erp-primary hover:underline')}
            onClick={() => onAmountClick?.(line)}
            title="Drill down to ledger"
          >
            {text}
          </button>
        ) : (
          <span className={cellClass}>{line.isHeader ? '' : text}</span>
        )}
      </td>
      {showPrior ? renderAmount(line.priorAmount, 'prior') : null}
      {showBudget ? renderAmount(line.budgetAmount, 'budget') : null}
      {showVariance ? renderAmount(line.variance, 'variance') : null}
      {showVariance ? (
        <td className="px-3 py-1.5 tabular-nums text-right text-[12px] text-erp-muted">
          {line.variancePct !== undefined ? (
            <>
              {line.variancePct >= 0 ? '+' : ''}
              {line.variancePct.toFixed(1)}%
            </>
          ) : (
            '—'
          )}
        </td>
      ) : null}
    </>
  )
}

export function FinancialStatementTable({
  lines,
  onAmountClick,
  priorPeriodLabel,
  budgetLabel,
  showVariance = false,
  className,
  emptyMessage = 'No statement lines to display.',
}: {
  lines: StatementLine[]
  onAmountClick?: (line: StatementLine) => void
  priorPeriodLabel?: string
  budgetLabel?: string
  showVariance?: boolean
  className?: string
  emptyMessage?: string
}) {
  const visible = lines.filter((l) => !l.hide)
  const showPrior = visible.some((l) => l.priorAmount !== undefined) || Boolean(priorPeriodLabel)
  const showBudget = visible.some((l) => l.budgetAmount !== undefined) || Boolean(budgetLabel)

  if (visible.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-[13px] text-erp-muted">{emptyMessage}</p>
    )
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[28rem] border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-erp-border bg-erp-surface">
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
              Particulars
            </th>
            <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
              Amount
            </th>
            {showPrior ? (
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                {priorPeriodLabel ?? 'Prior'}
              </th>
            ) : null}
            {showBudget ? (
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                {budgetLabel ?? 'Budget'}
              </th>
            ) : null}
            {showVariance ? (
              <>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                  Variance
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                  Var %
                </th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {visible.map((line, idx) => (
            <tr
              key={`${line.code}-${idx}`}
              className={cn(
                'border-b border-erp-border/60',
                line.isTotal && 'bg-erp-surface-alt/50',
                line.isHeader && 'bg-erp-surface',
              )}
            >
              <td
                className={cn(
                  'px-3 py-1.5 text-erp-text',
                  line.bold && 'font-semibold',
                  line.underline && 'underline decoration-erp-border underline-offset-2',
                  line.isHeader && 'text-[11px] font-semibold uppercase tracking-wide text-erp-muted',
                )}
                style={{ paddingLeft: `${12 + line.indent * 16}px` }}
              >
                {line.code ? (
                  <span className="mr-2 font-mono text-[10px] text-erp-muted">{line.code}</span>
                ) : null}
                {line.label}
              </td>
              <AmountCell
                line={line}
                onAmountClick={onAmountClick}
                showPrior={showPrior}
                showBudget={showBudget}
                showVariance={showVariance}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
