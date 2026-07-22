import { useState } from 'react'
import { ErpButton } from '@/components/erp/ErpButton'
import { formatDateTime } from '@/utils/dates/format'
import type { ExceptionDto } from '../api/bank-reconciliation.types'
import { ExceptionStatusChip } from './BankReconciliationStatusChip'
import { EXCEPTION_REASON_LABELS } from '../utils/bankReconciliationUi'

export interface ExceptionTableProps {
  exceptions: ExceptionDto[]
  canResolve: boolean
  busyExceptionId?: string | null
  onResolve?: (exception: ExceptionDto, resolutionReference: string) => void
  emptyMessage?: string
}

/** Bank reconciliation exception queue — statement-scoped or global (history/exceptions pages). */
export function ExceptionTable({ exceptions, canResolve, busyExceptionId, onResolve, emptyMessage }: ExceptionTableProps) {
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, string>>({})

  if (exceptions.length === 0) {
    return <p className="px-2 py-6 text-center text-[13px] text-erp-muted">{emptyMessage ?? 'No exceptions.'}</p>
  }

  return (
    <div className="overflow-auto rounded-lg border border-erp-border">
      <table className="w-full min-w-[52rem] text-[12px]">
        <thead className="bg-erp-surface/95 text-left text-[11px] font-semibold uppercase text-erp-muted">
          <tr>
            <th className="px-2 py-1.5">Reason</th>
            <th className="px-2 py-1.5">Comment</th>
            <th className="px-2 py-1.5">Status</th>
            <th className="px-2 py-1.5">Created</th>
            {canResolve ? <th className="px-2 py-1.5 text-right">Resolution</th> : null}
          </tr>
        </thead>
        <tbody>
          {exceptions.map((ex) => {
            const busy = busyExceptionId === ex.id
            const open = ex.status === 'OPEN'
            return (
              <tr key={ex.id} className="border-t border-erp-border">
                <td className="px-2 py-1.5 font-medium text-erp-text">{EXCEPTION_REASON_LABELS[ex.reason] ?? ex.reason}</td>
                <td className="max-w-[16rem] truncate px-2 py-1.5 text-erp-muted" title={ex.comment ?? undefined}>
                  {ex.comment ?? '—'}
                </td>
                <td className="px-2 py-1.5">
                  <ExceptionStatusChip status={ex.status} />
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-erp-muted">{formatDateTime(ex.createdAt)}</td>
                {canResolve ? (
                  <td className="px-2 py-1.5">
                    {open && onResolve ? (
                      <div className="flex justify-end gap-1.5">
                        <input
                          type="text"
                          placeholder="Resolution reference"
                          value={resolutionDrafts[ex.id] ?? ''}
                          onChange={(e) => setResolutionDrafts((prev) => ({ ...prev, [ex.id]: e.target.value }))}
                          className="h-7 w-36 rounded border border-erp-border px-1.5 text-[12px]"
                        />
                        <ErpButton
                          size="sm"
                          variant="secondary"
                          loading={busy}
                          onClick={() => onResolve(ex, (resolutionDrafts[ex.id] ?? '').trim())}
                        >
                          Resolve
                        </ErpButton>
                      </div>
                    ) : (
                      <span className="flex justify-end text-erp-muted">
                        {ex.resolutionReference ?? (ex.status === 'RESOLVED' ? 'Resolved' : '—')}
                      </span>
                    )}
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
