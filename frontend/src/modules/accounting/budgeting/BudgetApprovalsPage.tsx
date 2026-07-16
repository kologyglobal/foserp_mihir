import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { BudgetingShell } from '@/components/accounting/budgeting'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listBudgetApprovals, submitApprovalAction } from '@/services/accounting/budgetingService'
import type { BudgetApprovalItem } from '@/types/budgeting'
import { APPROVAL_LEVEL_LABELS } from '@/types/budgeting'
import { useBudgetingPermissions } from '@/utils/permissions/budgeting'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

export function BudgetApprovalsPage() {
  const perms = useBudgetingPermissions()
  const [rows, setRows] = useState<BudgetApprovalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<BudgetApprovalItem | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listBudgetApprovals()
      setRows(list)
      setSelected((prev) => (prev ? list.find((x) => x.id === prev.id) ?? null : null))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (action: 'approve' | 'reject' | 'send_back' | 'clarification') => {
    if (!selected) return
    if (!perms.canApprove) {
      notify.error('Approve permission required')
      return
    }
    if ((action === 'reject' || action === 'send_back' || action === 'clarification') && !comment.trim()) {
      notify.error('Comment is mandatory for reject, send back, and clarification')
      return
    }
    setBusy(true)
    try {
      const updated = await submitApprovalAction(selected.id, action, comment)
      setSelected(updated)
      setComment('')
      notify.success(`Action recorded: ${action}`)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BudgetingShell
      title="Budget Approvals"
      description="Multi-level worklist — reject / send-back require comments."
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'r', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {loading ? <LoadingState /> : null}
      {!loading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="overflow-x-auto rounded border border-erp-border">
            <table className="min-w-full text-left text-[12px]">
              <thead className="bg-erp-surface text-[11px] uppercase text-erp-muted">
                <tr>
                  <th className="px-2 py-2">Version</th>
                  <th className="px-2 py-2">Dept</th>
                  <th className="px-2 py-2">Amount</th>
                  <th className="px-2 py-2">Level</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={cn(
                      'cursor-pointer border-t border-erp-border hover:bg-erp-surface/40',
                      selected?.id === r.id && 'bg-erp-primary/5',
                    )}
                    onClick={() => {
                      setSelected(r)
                      setComment('')
                    }}
                  >
                    <td className="px-2 py-2 font-medium">{r.versionName}</td>
                    <td className="px-2 py-2">{r.department}</td>
                    <td className="px-2 py-2">{formatCurrency(r.requestedAmount)}</td>
                    <td className="px-2 py-2">{APPROVAL_LEVEL_LABELS[r.currentLevel]}</td>
                    <td className="px-2 py-2">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded border border-erp-border p-3 text-[12px]">
            {!selected ? (
              <p className="text-erp-muted">Select a worklist item to review.</p>
            ) : (
              <>
                <h3 className="text-[13px] font-semibold text-erp-text">{selected.versionName}</h3>
                <p className="mt-1 text-erp-muted">
                  {selected.department} · Owner {selected.budgetOwner} · Submitted{' '}
                  {formatDate(selected.submittedDate)}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <dt className="text-erp-muted">Requested</dt>
                    <dd className="font-medium">{formatCurrency(selected.requestedAmount)}</dd>
                  </div>
                  <div>
                    <dt className="text-erp-muted">Previous</dt>
                    <dd>{formatCurrency(selected.previousBudget)}</dd>
                  </div>
                  <div>
                    <dt className="text-erp-muted">Variance</dt>
                    <dd>{formatCurrency(selected.variance)}</dd>
                  </div>
                  <div>
                    <dt className="text-erp-muted">Level</dt>
                    <dd>{APPROVAL_LEVEL_LABELS[selected.currentLevel]}</dd>
                  </div>
                </dl>
                <label className="mt-3 block text-[11px] font-semibold text-erp-muted">
                  Comments
                  <textarea
                    className="mt-1 w-full rounded border border-erp-border px-2 py-1.5 text-[12px]"
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Required for reject / send back / clarification"
                  />
                </label>
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    disabled={busy || !perms.canApprove || selected.status === 'approved'}
                    className="rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                    onClick={() => void act('approve')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy || !perms.canApprove}
                    className="rounded border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800 disabled:opacity-40"
                    onClick={() => void act('reject')}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={busy || !perms.canApprove}
                    className="rounded border border-erp-border px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40"
                    onClick={() => void act('send_back')}
                  >
                    Send Back
                  </button>
                  <button
                    type="button"
                    disabled={busy || !perms.canApprove}
                    className="rounded border border-erp-border px-2.5 py-1 text-[11px] font-semibold disabled:opacity-40"
                    onClick={() => void act('clarification')}
                  >
                    Request Clarification
                  </button>
                </div>
                <h4 className="mt-4 text-[11px] font-bold uppercase tracking-wide text-erp-muted">
                  Change history
                </h4>
                <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto">
                  {selected.history.map((h, i) => (
                    <li key={`${h.at}-${i}`} className="rounded bg-erp-surface/60 px-2 py-1 text-[11px]">
                      <span className="font-semibold">{h.action}</span> · {h.actor} · {formatDate(h.at)}
                      {h.comment ? <div className="text-erp-muted">{h.comment}</div> : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      ) : null}
    </BudgetingShell>
  )
}
