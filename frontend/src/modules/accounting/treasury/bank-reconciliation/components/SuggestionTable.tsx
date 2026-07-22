import { ErpButton } from '@/components/erp/ErpButton'
import { formatCurrency } from '@/utils/formatters/currency'
import type { SuggestionDto } from '../api/bank-reconciliation.types'
import { ConfidenceChip, SuggestionStatusChip } from './BankReconciliationStatusChip'
import { parseDecimal } from '../utils/bankReconciliationUi'

export interface SuggestionTableProps {
  suggestions: SuggestionDto[]
  canAccept: boolean
  canReject: boolean
  busySuggestionId?: string | null
  onAccept: (suggestion: SuggestionDto) => void
  onReject: (suggestion: SuggestionDto) => void
}

const SUGGESTION_TYPE_LABELS: Record<SuggestionDto['suggestionType'], string> = {
  ONE_TO_ONE: '1 : 1',
  ONE_TO_MANY: '1 : N',
  MANY_TO_ONE: 'N : 1',
  MANY_TO_MANY: 'N : N',
}

/** System-generated match suggestions awaiting accept/reject — surfaced per statement line. */
export function SuggestionTable({ suggestions, canAccept, canReject, busySuggestionId, onAccept, onReject }: SuggestionTableProps) {
  if (suggestions.length === 0) {
    return <p className="px-2 py-6 text-center text-[13px] text-erp-muted">No pending suggestions for this statement.</p>
  }

  return (
    <div className="overflow-auto rounded-lg border border-erp-border">
      <table className="w-full min-w-[48rem] text-[12px]">
        <thead className="bg-erp-surface/95 text-left text-[11px] font-semibold uppercase text-erp-muted">
          <tr>
            <th className="px-2 py-1.5">Reference</th>
            <th className="px-2 py-1.5">Type</th>
            <th className="px-2 py-1.5">Lines / Entries</th>
            <th className="px-2 py-1.5 text-right">Amount</th>
            <th className="px-2 py-1.5">Confidence</th>
            <th className="px-2 py-1.5">Status</th>
            <th className="px-2 py-1.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {suggestions.map((s) => {
            const busy = busySuggestionId === s.id
            const pending = s.status === 'PENDING'
            return (
              <tr key={s.id} className="border-t border-erp-border">
                <td className="px-2 py-1.5 font-medium text-erp-text">{s.suggestionReference}</td>
                <td className="px-2 py-1.5">{SUGGESTION_TYPE_LABELS[s.suggestionType] ?? s.suggestionType}</td>
                <td className="px-2 py-1.5 text-erp-muted">
                  {s.statementLineIds.length} line(s) · {s.ledgerEntryIds.length} entry(ies)
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                  {formatCurrency(parseDecimal(s.suggestedAmount))}
                </td>
                <td className="px-2 py-1.5">
                  <ConfidenceChip level={s.confidenceLevel} />
                </td>
                <td className="px-2 py-1.5">
                  <SuggestionStatusChip status={s.status} />
                </td>
                <td className="px-2 py-1.5 text-right">
                  {pending ? (
                    <div className="flex justify-end gap-1.5">
                      {canAccept ? (
                        <ErpButton size="sm" loading={busy} onClick={() => onAccept(s)}>
                          Accept
                        </ErpButton>
                      ) : null}
                      {canReject ? (
                        <ErpButton size="sm" variant="secondary" disabled={busy} onClick={() => onReject(s)}>
                          Reject
                        </ErpButton>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-erp-muted">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
