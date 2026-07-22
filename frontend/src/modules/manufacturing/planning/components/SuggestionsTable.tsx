import { Info, Wrench } from 'lucide-react'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/design-system/components/Button'
import { formatDate } from '@/utils/dates/format'
import type { WorkOrderSuggestion } from '../types'
import { suggestionStatusMeta } from '../utils/labels'

export interface SuggestionsTableProps {
  suggestions: WorkOrderSuggestion[]
  canReview: boolean
  busyId?: string | null
  onAccept?: (suggestion: WorkOrderSuggestion) => void
  onReject?: (suggestion: WorkOrderSuggestion) => void
}

/** Work order suggestions from the latest calculation run — accept/reject only; WO creation ships in Phase 6A4. */
export function SuggestionsTable({ suggestions, canReview, busyId, onAccept, onReject }: SuggestionsTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>Work Order creation will be available in Phase 6A4. Accept/Reject decisions are recorded now.</span>
      </div>
      {suggestions.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No suggestions"
          description="Calculate the plan to generate work order suggestions from net requirements."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="erp-table w-full text-[12px]">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Suggested Qty</th>
                <th>Start</th>
                <th>Due</th>
                <th>Status</th>
                {canReview ? <th className="text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s) => {
                const meta = suggestionStatusMeta(s.status)
                const busy = busyId === s.id
                return (
                  <tr key={s.id}>
                    <td>
                      <p className="font-mono text-[11px] font-medium text-erp-text">{s.itemCode}</p>
                      <p className="text-[11px] text-erp-muted">{s.itemName}</p>
                    </td>
                    <td className="text-right tabular-nums font-semibold">
                      {s.suggestedQuantity} {s.uomCode}
                    </td>
                    <td className="whitespace-nowrap">{s.suggestedStartDate ? formatDate(s.suggestedStartDate) : '—'}</td>
                    <td className="whitespace-nowrap">{s.suggestedDueDate ? formatDate(s.suggestedDueDate) : '—'}</td>
                    <td>
                      <DynamicsStatusChip label={meta.label} tone={meta.tone} />
                    </td>
                    {canReview ? (
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          {s.status === 'PENDING' ? (
                            <>
                              <Button size="sm" variant="secondary" disabled={busy} onClick={() => onAccept?.(s)}>
                                Accept
                              </Button>
                              <Button size="sm" variant="ghost" disabled={busy} onClick={() => onReject?.(s)}>
                                Reject
                              </Button>
                            </>
                          ) : (
                            <span className="text-[11px] text-erp-muted">
                              {s.decidedAt ? formatDate(s.decidedAt) : '—'}
                            </span>
                          )}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
