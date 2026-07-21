import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import {
  PeriodCloseShell,
  PeriodCloseStatusBadge,
  LockStatusBadge,
  ReconStatusBadge,
} from '@/components/accounting/period-close'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { getCloseDashboard, loadPeriodCloseFilter } from '@/services/accounting/periodCloseService'
import type { CloseDashboardData, PeriodFilterState } from '@/types/periodClose'
import { CLOSE_WORKFLOW_STAGES } from '@/types/periodClose'
import { usePeriodClosePermissions } from '@/utils/permissions/periodClose'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { cn } from '@/utils/cn'

export function CloseDashboardPage() {
  const navigate = useNavigate()
  const perms = usePeriodClosePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodCloseFilter())
  const [data, setData] = useState<CloseDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!perms.canView) {
      setError('You do not have permission to view period close.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await getCloseDashboard(filter))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [filter, perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  const kpis: EnterpriseKpiItem[] = useMemo(() => {
    if (!data) return []
    return [
      {
        id: 'period',
        label: 'Current Period',
        value: data.periodLabel,
        helper: data.periodStatusLabel,
        accent: 'blue',
      },
      {
        id: 'progress',
        label: 'Close Progress',
        value: `${data.overallProgressPct}%`,
        helper: `${data.tasksCompleted} of ${data.tasksCompleted + data.tasksPending} tasks`,
        accent: 'green',
        onClick: () => navigate('/accounting/period-close/checklist'),
      },
      {
        id: 'pending',
        label: 'Tasks Pending',
        value: String(data.tasksPending),
        accent: 'amber',
        onClick: () => navigate('/accounting/period-close/checklist'),
      },
      {
        id: 'overdue',
        label: 'Overdue Tasks',
        value: String(data.overdueTasks),
        accent: 'red',
        onClick: () => navigate('/accounting/period-close/checklist'),
      },
      {
        id: 'unposted',
        label: 'Unposted Documents',
        value: String(data.unpostedDocuments),
        accent: 'slate',
      },
      {
        id: 'recon',
        label: 'Recon Differences',
        value: String(data.reconciliationDifferences),
        accent: 'amber',
        onClick: () => navigate('/accounting/period-close/subledger-reconciliation'),
      },
      {
        id: 'block',
        label: 'Blocking Exceptions',
        value: String(data.blockingExceptions),
        accent: 'red',
      },
    ]
  }, [data, navigate])

  const stageIdx = CLOSE_WORKFLOW_STAGES.findIndex((s) => s.id === data?.workflowStage)

  return (
    <PeriodCloseShell
      title="Close Dashboard"
      description="Monitor month-end close progress. API mode uses real period status and finance readiness."
      periodFilter={filter}
      onPeriodChange={setFilter}
      kpiStrip={kpis}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {loading ? <LoadingState /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {!loading && !error && data ? (
        <div className="space-y-3">
          <section className="rounded border border-erp-border p-3" aria-label="Close workflow">
            <h2 className="text-[13px] font-semibold text-erp-text">Close workflow</h2>
            <ol className="mt-2 flex flex-wrap gap-1">
              {CLOSE_WORKFLOW_STAGES.map((s, i) => (
                <li
                  key={s.id}
                  className={cn(
                    'rounded border px-2 py-1 text-[11px] font-semibold',
                    i === stageIdx
                      ? 'border-erp-primary bg-erp-primary/10 text-erp-primary'
                      : i < stageIdx
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-erp-border bg-white text-erp-muted',
                  )}
                >
                  {s.label}
                  {i < CLOSE_WORKFLOW_STAGES.length - 1 ? <span className="ml-1 text-erp-muted">→</span> : null}
                </li>
              ))}
            </ol>
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded border border-erp-border p-3">
              <h2 className="text-[13px] font-semibold text-erp-text">Close progress by department</h2>
              <ul className="mt-2 space-y-2">
                {data.deptProgress.map((d) => (
                  <li key={d.department} className="text-[12px]">
                    <div className="mb-0.5 flex justify-between">
                      <span className="font-medium text-erp-text">{d.department}</span>
                      <span className="text-erp-muted">
                        {d.completed}/{d.total} ({d.pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-erp-surface">
                      <div className="h-full bg-erp-primary" style={{ width: `${d.pct}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded border border-erp-border p-3">
              <h2 className="text-[13px] font-semibold text-erp-text">Critical blockers</h2>
              <ul className="mt-2 space-y-2">
                {data.criticalBlockers.map((b) => (
                  <li key={b.id} className="flex items-start justify-between gap-2 text-[12px]">
                    <div>
                      <Link to={b.href} className="font-medium text-erp-primary hover:underline">
                        {b.title}
                      </Link>
                      <div className="text-erp-muted">{b.module}</div>
                    </div>
                    <PeriodCloseStatusBadge status="Blocked" />
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded border border-erp-border p-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-erp-text">Pending reconciliations</h2>
                <Link
                  to="/accounting/period-close/subledger-reconciliation"
                  className="text-[11px] font-semibold text-erp-primary hover:underline"
                >
                  Open workbench
                </Link>
              </div>
              <ul className="mt-2 space-y-2">
                {data.pendingReconciliations.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="min-w-0 truncate font-medium text-erp-text">{r.name}</span>
                    <span className="shrink-0 tabular-nums text-erp-muted">
                      {formatCompactCurrency(r.difference)}
                    </span>
                    <ReconStatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded border border-erp-border p-3">
              <h2 className="text-[13px] font-semibold text-erp-text">Unposted transactions</h2>
              <ul className="mt-2 space-y-2">
                {data.unpostedItems.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-2 text-[12px]">
                    <Link to={u.href} className="font-medium text-erp-primary hover:underline">
                      {u.docType} {u.docNo}
                    </Link>
                    <span className="tabular-nums text-erp-text">{formatCurrency(u.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded border border-erp-border p-3">
              <h2 className="text-[13px] font-semibold text-erp-text">Approval worklist</h2>
              <ul className="mt-2 space-y-2">
                {data.approvalWorklist.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-[12px]">
                    <div>
                      <div className="font-medium text-erp-text">{a.title}</div>
                      <div className="text-erp-muted">{a.owner}</div>
                    </div>
                    <PeriodCloseStatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded border border-erp-border p-3">
              <h2 className="text-[13px] font-semibold text-erp-text">Recent close activities</h2>
              <ul className="mt-2 space-y-2">
                {data.recentActivities.map((a) => (
                  <li key={a.id} className="text-[12px]">
                    <div className="font-medium text-erp-text">{a.summary}</div>
                    <div className="text-erp-muted">
                      {a.by} · {formatDate(a.at)}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="rounded border border-erp-border p-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-erp-text">Period lock status by module</h2>
              <Link
                to="/accounting/period-close/period-locking"
                className="text-[11px] font-semibold text-erp-primary hover:underline"
              >
                Manage locks
              </Link>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
                <thead>
                  <tr className="border-b border-erp-border text-[10px] uppercase text-erp-muted">
                    <th className="py-1.5 pr-2 font-semibold">Module</th>
                    <th className="py-1.5 pr-2 font-semibold">Lock Through</th>
                    <th className="py-1.5 pr-2 font-semibold">Status</th>
                    <th className="py-1.5 font-semibold">Locked By</th>
                  </tr>
                </thead>
                <tbody>
                  {data.moduleLocks.map((l) => (
                    <tr key={l.id} className="border-b border-erp-border/60">
                      <td className="py-1.5 pr-2 font-medium text-erp-text">{l.module}</td>
                      <td className="py-1.5 pr-2 text-erp-muted">{formatDate(l.lockThroughDate)}</td>
                      <td className="py-1.5 pr-2">
                        <LockStatusBadge status={l.status} />
                      </td>
                      <td className="py-1.5 text-erp-muted">{l.lockedBy ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </PeriodCloseShell>
  )
}
