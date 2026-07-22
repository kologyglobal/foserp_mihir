import { useState } from 'react'
import { CheckCircle2, Lock, RotateCcw, XCircle } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import type { SessionAllowedActions, SessionSummaryDto } from '../api/bank-reconciliation.types'

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-[12px]">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
      )}
      <span className={ok ? 'text-erp-text' : 'text-erp-muted'}>{label}</span>
    </li>
  )
}

export interface FinalizationChecklistProps {
  summary: SessionSummaryDto
  allowedActions: SessionAllowedActions
  finalizing: boolean
  reopening: boolean
  onFinalize: (force: boolean) => void
  onReopen: (reason: string) => void
}

/** Pre-finalize readiness checklist + finalize/reopen actions for the reconciliation session. */
export function FinalizationChecklist({
  summary,
  allowedActions,
  finalizing,
  reopening,
  onFinalize,
  onReopen,
}: FinalizationChecklistProps) {
  const [reopenReason, setReopenReason] = useState('')

  const unresolved = summary.unmatchedLineCount + summary.partiallyMatchedLineCount
  const allMatched = unresolved === 0
  const noOpenExceptions = summary.openExceptionCount === 0
  const isFinalized = summary.status === 'FINALIZED'

  if (isFinalized) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-900">
          <Lock className="h-4 w-4" /> Session finalized
        </p>
        <p className="mt-1 text-[12px] text-emerald-800">
          Finalized {summary.finalizedAt ? new Date(summary.finalizedAt).toLocaleString('en-IN') : ''}.
        </p>
        {allowedActions.reopen ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[12rem]">
              <label className="mb-1 block text-[11px] font-semibold text-emerald-900" htmlFor="reopen-reason">
                Reopen reason
              </label>
              <input
                id="reopen-reason"
                type="text"
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                className="h-8 w-full rounded border border-erp-border px-2 text-[12px]"
                placeholder="Why is this session being reopened?"
              />
            </div>
            <ErpButton
              variant="secondary"
              size="sm"
              icon={RotateCcw}
              loading={reopening}
              disabled={!reopenReason.trim()}
              onClick={() => onReopen(reopenReason.trim())}
            >
              Reopen
            </ErpButton>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-erp-border bg-white p-4">
      <h3 className="mb-2 text-[13px] font-semibold text-erp-text">Finalization checklist</h3>
      <ul className="space-y-1.5">
        <ChecklistItem ok={allMatched} label={`All statement lines matched or excluded (${unresolved} remaining)`} />
        <ChecklistItem ok={noOpenExceptions} label={`No open exceptions (${summary.openExceptionCount} open)`} />
        <ChecklistItem
          ok={summary.pendingSuggestionCount === 0}
          label={`No pending suggestions (${summary.pendingSuggestionCount} pending)`}
        />
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {allowedActions.finalize ? (
          <ErpButton size="sm" loading={finalizing} disabled={!allMatched} onClick={() => onFinalize(false)}>
            Finalize
          </ErpButton>
        ) : null}
        {allowedActions.finalizeWithExceptions && !allMatched ? (
          <ErpButton size="sm" variant="secondary" loading={finalizing} onClick={() => onFinalize(true)}>
            Finalize with exceptions
          </ErpButton>
        ) : null}
      </div>
    </div>
  )
}
