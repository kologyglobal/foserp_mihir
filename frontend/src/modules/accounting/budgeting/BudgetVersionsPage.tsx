import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Plus, RefreshCw, ShieldCheck } from 'lucide-react'
import { BudgetingShell } from '@/components/accounting/budgeting'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  createBudgetVersion,
  listBudgetVersions,
  updateBudgetVersionStatus,
} from '@/services/accounting/budgetingService'
import type { BudgetVersion, BudgetVersionKind, BudgetVersionStatus } from '@/types/budgeting'
import { BUDGET_VERSION_KIND_LABELS, BUDGET_VERSION_STATUS_LABELS } from '@/types/budgeting'
import { useBudgetingPermissions } from '@/utils/permissions/budgeting'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

function StatusBadge({ status, isPrimary }: { status: BudgetVersionStatus; isPrimary?: boolean }) {
  const tone =
    status === 'approved'
      ? 'bg-emerald-50 text-emerald-800'
      : status === 'locked'
        ? 'bg-slate-100 text-slate-800'
        : status === 'pending_approval'
          ? 'bg-amber-50 text-amber-900'
          : status === 'superseded' || status === 'cancelled'
            ? 'bg-rose-50 text-rose-800'
            : 'bg-erp-surface text-erp-muted'
  return (
    <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold', tone)}>
      {BUDGET_VERSION_STATUS_LABELS[status]}
      {isPrimary && status === 'approved' ? (
        <span className="rounded bg-emerald-600 px-1 text-[9px] text-white">Primary</span>
      ) : null}
    </span>
  )
}

export function BudgetVersionsPage() {
  const perms = useBudgetingPermissions()
  const [rows, setRows] = useState<BudgetVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listBudgetVersions())
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load versions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onCreate = async () => {
    if (!perms.canCreate) return
    setCreating(true)
    try {
      const name = window.prompt('New budget version name', 'Revised Budget Q2')
      if (!name?.trim()) return
      const kind = (window.prompt(
        'Kind: original | revised | forecast_1 | forecast_2 | best_case | expected_case | worst_case',
        'revised',
      ) ?? 'revised') as BudgetVersionKind
      await createBudgetVersion({
        name: name.trim(),
        kind,
        financialYear: '2025-26',
        budgetType: 'annual',
        notes: 'Created from Budget Versions register (demo).',
        copyFromId: 'bv-original',
      })
      notify.success('Budget version created')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  const setStatus = async (id: string, status: BudgetVersionStatus) => {
    if (!perms.canEdit && status !== 'approved') return
    if (status === 'approved' && !perms.canApprove) {
      notify.error('Approve permission required')
      return
    }
    try {
      await updateBudgetVersionStatus(id, status)
      notify.success(`Version marked ${BUDGET_VERSION_STATUS_LABELS[status]}`)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  return (
    <BudgetingShell
      title="Budget Versions"
      description="Original / revised / forecast versions — one approved primary per company & FY."
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
              id: 'new',
              label: creating ? 'Creating…' : 'New Version',
              icon: Plus,
              disabled: !perms.canCreate || creating,
              onClick: () => void onCreate(),
            }}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {loading ? <LoadingState /> : null}
      {!loading ? (
        <div className="overflow-x-auto rounded border border-erp-border">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-erp-surface text-[11px] uppercase tracking-wide text-erp-muted">
              <tr>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Kind</th>
                <th className="px-2 py-2">FY</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Prepared</th>
                <th className="px-2 py-2">Approved</th>
                <th className="px-2 py-2">Updated</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-erp-border hover:bg-erp-surface/50">
                  <td className="px-2 py-2 font-medium">
                    <Link className="text-erp-primary hover:underline" to={`/accounting/budgeting/annual?version=${r.id}`}>
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{BUDGET_VERSION_KIND_LABELS[r.kind]}</td>
                  <td className="px-2 py-2">{r.financialYear}</td>
                  <td className="px-2 py-2">
                    <StatusBadge status={r.status} isPrimary={r.isPrimary} />
                  </td>
                  <td className="px-2 py-2">{r.preparedBy}</td>
                  <td className="px-2 py-2">{r.approvedBy ?? '—'}</td>
                  <td className="px-2 py-2">{formatDate(r.lastUpdated)}</td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.status !== 'approved' && r.status !== 'locked' ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 rounded border border-erp-border px-1.5 py-0.5 text-[10px] font-semibold hover:bg-erp-surface disabled:opacity-40"
                          disabled={!perms.canApprove}
                          onClick={() => void setStatus(r.id, 'approved')}
                        >
                          <ShieldCheck className="h-3 w-3" /> Approve
                        </button>
                      ) : null}
                      {r.status === 'approved' ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 rounded border border-erp-border px-1.5 py-0.5 text-[10px] font-semibold hover:bg-erp-surface disabled:opacity-40"
                          disabled={!perms.canEdit}
                          onClick={() => void setStatus(r.id, 'locked')}
                        >
                          <Lock className="h-3 w-3" /> Lock
                        </button>
                      ) : null}
                      {r.status !== 'superseded' && r.status !== 'cancelled' ? (
                        <button
                          type="button"
                          className="rounded border border-erp-border px-1.5 py-0.5 text-[10px] font-semibold hover:bg-erp-surface disabled:opacity-40"
                          disabled={!perms.canEdit}
                          onClick={() => void setStatus(r.id, 'superseded')}
                        >
                          Supersede
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </BudgetingShell>
  )
}
