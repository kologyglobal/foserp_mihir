import { MQ_MOBILE, useMediaQuery } from '@/hooks/useMediaQuery'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import type { StatementLineDto } from '../api/bank-reconciliation.types'
import { DirectionLabel, LineMatchStatusChip } from './BankReconciliationStatusChip'
import { parseDecimal } from '../utils/bankReconciliationUi'

export interface StatementLineReconTableProps {
  lines: StatementLineDto[]
  selectedIds: Set<string>
  onToggleSelect: (lineId: string) => void
  selectable?: boolean
  onOpenLine?: (line: StatementLineDto) => void
  emptyMessage?: string
}

/** Statement line register — desktop table on `md+`, stacked cards on mobile. */
export function StatementLineReconTable({
  lines,
  selectedIds,
  onToggleSelect,
  selectable = true,
  onOpenLine,
  emptyMessage = 'No statement lines in this view.',
}: StatementLineReconTableProps) {
  const isMobile = useMediaQuery(MQ_MOBILE)

  if (lines.length === 0) {
    return <p className="px-2 py-6 text-center text-[13px] text-erp-muted">{emptyMessage}</p>
  }

  if (isMobile) {
    return (
      <div className="space-y-2">
        {lines.map((line) => (
          <div
            key={line.id}
            role={onOpenLine ? 'button' : undefined}
            tabIndex={onOpenLine ? 0 : undefined}
            className="rounded-lg border border-erp-border bg-white p-3 text-[12px]"
            onClick={() => onOpenLine?.(line)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {selectable ? (
                  <input
                    type="checkbox"
                    aria-label={`Select line ${line.lineNumber}`}
                    checked={selectedIds.has(line.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => onToggleSelect(line.id)}
                    className="h-4 w-4"
                  />
                ) : null}
                <span className="font-semibold text-erp-text">#{line.lineNumber}</span>
              </div>
              <LineMatchStatusChip status={line.matchStatus} />
            </div>
            <p className="mt-1 text-erp-muted">{formatDate(line.transactionDate)}</p>
            <p className="mt-1 truncate text-erp-text" title={line.description ?? undefined}>
              {line.description ?? '—'}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <DirectionLabel direction={line.direction} />
              <span className="tabular-nums font-semibold">{formatCurrency(parseDecimal(line.amount))}</span>
            </div>
            {parseDecimal(line.remainingAmount) > 0 && parseDecimal(line.remainingAmount) !== parseDecimal(line.amount) ? (
              <p className="mt-1 text-[11px] text-erp-muted">
                Remaining: {formatCurrency(parseDecimal(line.remainingAmount))}
              </p>
            ) : null}
            {line.referenceNumber ? <p className="mt-1 text-[11px] text-erp-muted">Ref: {line.referenceNumber}</p> : null}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded-lg border border-erp-border">
      <table className="w-full min-w-[52rem] text-[12px]">
        <thead className="bg-erp-surface/95 text-left text-[11px] font-semibold uppercase text-erp-muted">
          <tr>
            {selectable ? <th className="px-2 py-1.5 w-8" scope="col" /> : null}
            <th className="px-2 py-1.5" scope="col">
              #
            </th>
            <th className="px-2 py-1.5" scope="col">
              Date
            </th>
            <th className="px-2 py-1.5" scope="col">
              Direction
            </th>
            <th className="px-2 py-1.5 text-right" scope="col">
              Amount
            </th>
            <th className="px-2 py-1.5 text-right" scope="col">
              Remaining
            </th>
            <th className="px-2 py-1.5" scope="col">
              Description
            </th>
            <th className="px-2 py-1.5" scope="col">
              Reference
            </th>
            <th className="px-2 py-1.5" scope="col">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr
              key={line.id}
              className="cursor-default border-t border-erp-border hover:bg-erp-surface/40"
              onClick={() => onOpenLine?.(line)}
            >
              {selectable ? (
                <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select line ${line.lineNumber}`}
                    checked={selectedIds.has(line.id)}
                    onChange={() => onToggleSelect(line.id)}
                    className="h-4 w-4"
                  />
                </td>
              ) : null}
              <td className="px-2 py-1.5 tabular-nums text-erp-muted">{line.lineNumber}</td>
              <td className="px-2 py-1.5 whitespace-nowrap">{formatDate(line.transactionDate)}</td>
              <td className="px-2 py-1.5">
                <DirectionLabel direction={line.direction} />
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums font-medium">{formatCurrency(parseDecimal(line.amount))}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-erp-muted">
                {formatCurrency(parseDecimal(line.remainingAmount))}
              </td>
              <td className="max-w-[16rem] truncate px-2 py-1.5" title={line.description ?? undefined}>
                {line.description ?? '—'}
              </td>
              <td className="px-2 py-1.5">{line.referenceNumber ?? line.utrReference ?? line.chequeNumber ?? '—'}</td>
              <td className="px-2 py-1.5">
                <LineMatchStatusChip status={line.matchStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
