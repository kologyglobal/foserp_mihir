import { PreviewRowStatusChip } from './BankStatementStatusChip'
import type { BankStatementLineDto, ImportPreviewRow } from '../api/bank-statement.types'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { parseDecimal } from '../utils/bankStatementUi'

type Row = ImportPreviewRow | BankStatementLineDto

function isPreviewRow(row: Row): row is ImportPreviewRow {
  return 'status' in row && 'sourceRowNumber' in row
}

function isPersistedLine(row: Row): row is BankStatementLineDto {
  return 'lineNumber' in row && !('status' in row && 'issues' in row)
}

export function StatementLineGrid({
  rows,
  maxHeight = '24rem',
  hideExcludedMatching = false,
}: {
  rows: Row[]
  currencyCode?: string
  maxHeight?: string
  /** When true, grey out excluded/superseded provisional evidence lines. */
  hideExcludedMatching?: boolean
}) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-erp-muted">No lines to display.</p>
  }

  const showFlags = rows.some((r) => isPersistedLine(r) && (r.isProvisional || r.isExcluded || r.supersededByLineId))

  return (
    <div className="overflow-auto rounded-lg border border-erp-border" style={{ maxHeight }}>
      <table className="w-full min-w-[48rem] text-[12px]">
        <thead className="sticky top-0 bg-erp-surface/95 text-left text-[11px] font-semibold uppercase text-erp-muted">
          <tr>
            <th className="px-2 py-1.5">#</th>
            <th className="px-2 py-1.5">Date</th>
            <th className="px-2 py-1.5">Direction</th>
            <th className="px-2 py-1.5 text-right">Amount</th>
            <th className="px-2 py-1.5">Description</th>
            <th className="px-2 py-1.5">Reference</th>
            {showFlags ? <th className="px-2 py-1.5">Flags</th> : null}
            {rows.some(isPreviewRow) ? <th className="px-2 py-1.5">Status</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const lineNo = isPreviewRow(row) ? row.sourceRowNumber : row.lineNumber ?? idx + 1
            const date = row.transactionDate
            const amount = parseDecimal(row.amount)
            const excluded =
              isPersistedLine(row) &&
              (row.isExcluded === true || row.matchStatus === 'EXCLUDED' || Boolean(row.supersededByLineId))
            const muted = hideExcludedMatching && excluded
            return (
              <tr
                key={`${lineNo}-${idx}`}
                className={`border-t border-erp-border ${muted ? 'bg-erp-surface/60 text-erp-muted' : ''}`}
              >
                <td className="px-2 py-1.5 tabular-nums text-erp-muted">{lineNo}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{formatDate(date)}</td>
                <td className="px-2 py-1.5">{row.direction}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                  {formatCurrency(amount)}
                </td>
                <td className="max-w-[16rem] truncate px-2 py-1.5" title={row.description ?? undefined}>
                  {row.description ?? '-'}
                </td>
                <td className="px-2 py-1.5">{row.referenceNumber ?? '-'}</td>
                {showFlags ? (
                  <td className="px-2 py-1.5">
                    {isPersistedLine(row) ? (
                      <span className="flex flex-wrap gap-1">
                        {row.isProvisional ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                            Provisional
                          </span>
                        ) : null}
                        {excluded ? (
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                            Superseded
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </td>
                ) : null}
                {isPreviewRow(row) ? (
                  <td className="px-2 py-1.5">
                    <PreviewRowStatusChip status={row.status} />
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
