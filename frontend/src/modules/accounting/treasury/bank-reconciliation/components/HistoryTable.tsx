import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { TableLink } from '@/components/ui/AppLink'
import type { SessionDto } from '../api/bank-reconciliation.types'
import { SessionStatusChip } from './BankReconciliationStatusChip'
import { parseDecimal } from '../utils/bankReconciliationUi'

/** Finalized / reopened reconciliation session history. */
export function HistoryTable({ sessions }: { sessions: SessionDto[] }) {
  if (sessions.length === 0) {
    return <p className="px-2 py-6 text-center text-[13px] text-erp-muted">No finalized reconciliation sessions yet.</p>
  }

  return (
    <div className="overflow-auto rounded-lg border border-erp-border">
      <table className="w-full min-w-[48rem] text-[12px]">
        <thead className="bg-erp-surface/95 text-left text-[11px] font-semibold uppercase text-erp-muted">
          <tr>
            <th className="px-2 py-1.5">Period</th>
            <th className="px-2 py-1.5 text-right">Closing balance</th>
            <th className="px-2 py-1.5 text-right">Difference</th>
            <th className="px-2 py-1.5">Status</th>
            <th className="px-2 py-1.5">Finalized</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className="border-t border-erp-border hover:bg-erp-surface/40">
              <td className="px-2 py-1.5">
                <TableLink to={`/accounting/bank-cash/reconciliation/${s.bankStatementId}`}>
                  {formatDate(s.statementStartDate)} – {formatDate(s.statementEndDate)}
                </TableLink>
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {s.statementClosingBalance != null ? formatCurrency(parseDecimal(s.statementClosingBalance)) : '—'}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {s.reconciliationDifference != null ? formatCurrency(parseDecimal(s.reconciliationDifference)) : '—'}
              </td>
              <td className="px-2 py-1.5">
                <SessionStatusChip status={s.status} />
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap text-erp-muted">{s.finalizedAt ? formatDateTime(s.finalizedAt) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
