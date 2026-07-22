import { PreviewRowStatusChip } from './BankStatementStatusChip'
import type { BankStatementLineDto, ImportPreviewRow } from '../api/bank-statement.types'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { parseDecimal } from '../utils/bankStatementUi'

type Row = ImportPreviewRow | BankStatementLineDto

function isPreviewRow(row: Row): row is ImportPreviewRow {
  return 'status' in row && 'sourceRowNumber' in row
}

export function StatementLineGrid({
  rows,
  maxHeight = '24rem',
}: {
  rows: Row[]
  currencyCode?: string
  maxHeight?: string
}) {
  if (rows.length === 0) {
    return <p className="text-[13px] text-erp-muted">No lines to display.</p>
  }

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
            {rows.some(isPreviewRow) ? <th className="px-2 py-1.5">Status</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const lineNo = isPreviewRow(row) ? row.sourceRowNumber : row.lineNumber ?? idx + 1
            const date = isPreviewRow(row) ? row.transactionDate : row.transactionDate
            const amount = parseDecimal(row.amount)
            return (
              <tr key={`${lineNo}-${idx}`} className="border-t border-erp-border">
                <td className="px-2 py-1.5 tabular-nums text-erp-muted">{lineNo}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{formatDate(date)}</td>
                <td className="px-2 py-1.5">{row.direction}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                  {formatCurrency(amount)}
                </td>
                <td className="max-w-[16rem] truncate px-2 py-1.5" title={row.description ?? undefined}>
                  {row.description ?? '—'}
                </td>
                <td className="px-2 py-1.5">{row.referenceNumber ?? '—'}</td>
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
