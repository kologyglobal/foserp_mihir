import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  PeriodCloseShell,
  PeriodCloseStatusBadge,
  TaskStatusBadge,
  ReconStatusBadge,
} from '@/components/accounting/period-close'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  addReconciliationNote,
  getCloseCalendar,
  getCloseTasks,
  getSubledgerReconciliations,
  loadPeriodCloseFilter,
  markReconciliationReviewed,
  updateCloseTaskStatus,
} from '@/services/accounting/periodCloseService'
import type {
  CloseCalendarEvent,
  CloseTask,
  CloseTaskStatus,
  PeriodFilterState,
  SubledgerReconciliation,
} from '@/types/periodClose'
import { CLOSE_TASK_MODULE_LABELS, CLOSE_TASK_STATUS_LABELS } from '@/types/periodClose'
import { usePeriodClosePermissions } from '@/utils/permissions/periodClose'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { isApiMode } from '@/config/apiConfig'

export function CloseCalendarPage() {
  const perms = usePeriodClosePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodCloseFilter())
  const [events, setEvents] = useState<CloseCalendarEvent[]>([])
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
      setEvents(await getCloseCalendar(filter.periodCode))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }, [filter.periodCode, perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <PeriodCloseShell
      title="Close Calendar"
      description="Close milestones from setup configuration (not hardcoded statutory deadlines)."
      periodFilter={filter}
      onPeriodChange={setFilter}
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
      {!loading && !error ? (
        events.length === 0 ? (
          <p className="text-[13px] text-erp-muted">No close calendar events for the selected period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-erp-border text-[10px] uppercase text-erp-muted">
                  <th className="py-1.5 pr-2 font-semibold">Compliance</th>
                  <th className="py-1.5 pr-2 font-semibold">Category</th>
                  <th className="py-1.5 pr-2 font-semibold">Due Date</th>
                  <th className="py-1.5 pr-2 font-semibold">Owner</th>
                  <th className="py-1.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-erp-border/60">
                    <td className="py-1.5 pr-2 font-medium text-erp-text">{e.title}</td>
                    <td className="py-1.5 pr-2 capitalize text-erp-muted">{e.category.replace('_', ' ')}</td>
                    <td className="py-1.5 pr-2 text-erp-muted">{formatDate(e.dueDate)}</td>
                    <td className="py-1.5 pr-2 text-erp-muted">{e.owner}</td>
                    <td className="py-1.5">
                      <PeriodCloseStatusBadge
                        status={
                          e.status === 'due_soon'
                            ? 'Due Soon'
                            : e.status === 'due_today'
                              ? 'Due Today'
                              : e.status === 'not_applicable'
                                ? 'Not Applicable'
                                : e.status.charAt(0).toUpperCase() + e.status.slice(1)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </PeriodCloseShell>
  )
}

export function CloseChecklistPage() {
  const perms = usePeriodClosePermissions()
  const api = isApiMode()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodCloseFilter())
  const [tasks, setTasks] = useState<CloseTask[]>([])
  const [moduleFilter, setModuleFilter] = useState<string>('all')
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
      setTasks(await getCloseTasks(filter.periodCode))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load checklist')
    } finally {
      setLoading(false)
    }
  }, [filter.periodCode, filter.periodId, perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(
    () => (moduleFilter === 'all' ? tasks : tasks.filter((t) => t.module === moduleFilter)),
    [tasks, moduleFilter],
  )

  const onStatus = async (id: string, status: CloseTaskStatus) => {
    if (api) {
      notify.error('Readiness checklist is computed in API mode — resolve the underlying finance item instead.')
      return
    }
    if (!perms.canManageChecklist) {
      notify.error('You do not have permission to update close tasks.')
      return
    }
    try {
      await updateCloseTaskStatus(id, status)
      notify.success('Task updated in demo mode.')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  return (
    <PeriodCloseShell
      title="Close Checklist"
      description={
        api
          ? 'Phase 1 readiness checklist composed from period status, AP close gate, unposted journals, and bank recon.'
          : 'Configurable department close tasks with owners, dependencies and evidence.'
      }
      periodFilter={filter}
      onPeriodChange={setFilter}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {api ? (
        <p className="mb-2 text-[12px] text-erp-muted">
          Soft warnings only — closing a period is not hard-blocked by AP gate or unposted journals in Phase 1.
        </p>
      ) : (
      <div className="mb-2 flex flex-wrap gap-2">
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-erp-muted">
          Module
          <select
            className="h-8 rounded border border-erp-border px-2 text-[12px] text-erp-text"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            aria-label="Filter by module"
          >
            <option value="all">All</option>
            {Object.entries(CLOSE_TASK_MODULE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      )}
      {loading ? <LoadingState /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {!loading && !error ? (
        filtered.length === 0 ? (
          <p className="text-[13px] text-erp-muted">No close tasks for the selected filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left text-[12px]">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-erp-border text-[10px] uppercase text-erp-muted">
                  <th className="py-1.5 pr-2 font-semibold">Task</th>
                  <th className="py-1.5 pr-2 font-semibold">Module</th>
                  <th className="py-1.5 pr-2 font-semibold">Owner</th>
                  <th className="py-1.5 pr-2 font-semibold">Reviewer</th>
                  <th className="py-1.5 pr-2 font-semibold">Due Date</th>
                  <th className="py-1.5 pr-2 font-semibold">Status</th>
                  <th className="py-1.5 pr-2 font-semibold">%</th>
                  <th className="py-1.5 pr-2 font-semibold">Evidence</th>
                  <th className="py-1.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-erp-border/60 align-top">
                    <td className="py-1.5 pr-2 font-medium text-erp-text">
                      {t.task}
                      {t.comments ? <div className="text-[11px] font-normal text-erp-muted">{t.comments}</div> : null}
                    </td>
                    <td className="py-1.5 pr-2 text-erp-muted">{CLOSE_TASK_MODULE_LABELS[t.module]}</td>
                    <td className="py-1.5 pr-2 text-erp-muted">{t.owner}</td>
                    <td className="py-1.5 pr-2 text-erp-muted">{t.reviewer}</td>
                    <td className="py-1.5 pr-2 text-erp-muted">{formatDate(t.dueDate)}</td>
                    <td className="py-1.5 pr-2">
                      <TaskStatusBadge status={t.status} />
                    </td>
                    <td className="py-1.5 pr-2 tabular-nums text-erp-muted">{t.completionPct}%</td>
                    <td className="py-1.5 pr-2 text-erp-muted">{t.evidence ?? '—'}</td>
                    <td className="py-1.5">
                      {api ? (
                        <span className="text-[11px] text-erp-muted">Computed</span>
                      ) : (
                      <select
                        className="h-8 max-w-[140px] rounded border border-erp-border px-1 text-[11px]"
                        value={t.status}
                        disabled={!perms.canManageChecklist}
                        aria-label={`Update status for ${t.task}`}
                        onChange={(e) => void onStatus(t.id, e.target.value as CloseTaskStatus)}
                      >
                        {Object.entries(CLOSE_TASK_STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </PeriodCloseShell>
  )
}

export function SubledgerReconciliationPage() {
  const perms = usePeriodClosePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodCloseFilter())
  const [rows, setRows] = useState<SubledgerReconciliation[]>([])
  const [selected, setSelected] = useState<SubledgerReconciliation | null>(null)
  const [note, setNote] = useState('')
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
      setRows(await getSubledgerReconciliations(filter.periodCode))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reconciliations')
    } finally {
      setLoading(false)
    }
  }, [filter.periodCode, perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  const onReviewed = async (id: string) => {
    if (!perms.canReconcile) {
      notify.error('You do not have permission to mark reconciliations reviewed.')
      return
    }
    try {
      await markReconciliationReviewed(id)
      notify.success('Marked reviewed in demo mode. Balances were not edited.')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Cannot mark reviewed')
    }
  }

  const onNote = async () => {
    if (!selected || !note.trim()) return
    if (!perms.canReconcile) {
      notify.error('You do not have permission to add reconciliation notes.')
      return
    }
    try {
      await addReconciliationNote(selected.id, note.trim())
      notify.success('Note saved in demo mode.')
      setNote('')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to save note')
    }
  }

  return (
    <PeriodCloseShell
      title="Subledger Reconciliation"
      description="Compare subledgers to control accounts. Differences cannot be forced by editing balances."
      periodFilter={filter}
      onPeriodChange={setFilter}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            {
              id: 'export',
              label: 'Export',
              disabled: !perms.canExport,
              onClick: () => notify.info('Placeholder export — reconciliation CSV not generated.'),
            },
          ]}
        />
      }
    >
      {loading ? <LoadingState /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {!loading && !error ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelected(r)
                  setNote(r.notes ?? '')
                }}
                className="rounded border border-erp-border bg-white p-3 text-left hover:border-erp-primary"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[12px] font-semibold text-erp-text">{r.name}</span>
                  <ReconStatusBadge status={r.status} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
                  <span className="text-erp-muted">Subledger</span>
                  <span className="text-right tabular-nums">{formatCurrency(r.subledgerBalance)}</span>
                  <span className="text-erp-muted">GL</span>
                  <span className="text-right tabular-nums">{formatCurrency(r.glBalance)}</span>
                  <span className="text-erp-muted">Difference</span>
                  <span className="text-right tabular-nums font-semibold">{formatCurrency(r.difference)}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-erp-border text-[10px] uppercase text-erp-muted">
                  <th className="py-1.5 pr-2 font-semibold">Reconciliation</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Subledger</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">GL</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Difference</th>
                  <th className="py-1.5 pr-2 font-semibold">Last Reconciled</th>
                  <th className="py-1.5 pr-2 font-semibold">Owner</th>
                  <th className="py-1.5 pr-2 font-semibold">Status</th>
                  <th className="py-1.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-erp-border/60">
                    <td className="py-1.5 pr-2 font-medium text-erp-text">{r.name}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{formatCurrency(r.subledgerBalance)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{formatCurrency(r.glBalance)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums font-semibold">{formatCurrency(r.difference)}</td>
                    <td className="py-1.5 pr-2 text-erp-muted">
                      {r.lastReconciled ? formatDate(r.lastReconciled) : '—'}
                    </td>
                    <td className="py-1.5 pr-2 text-erp-muted">{r.owner}</td>
                    <td className="py-1.5 pr-2">
                      <ReconStatusBadge status={r.status} />
                    </td>
                    <td className="py-1.5">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] font-semibold"
                          onClick={() => {
                            setSelected(r)
                            setNote(r.notes ?? '')
                          }}
                        >
                          View Difference
                        </button>
                        <button
                          type="button"
                          className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] font-semibold disabled:opacity-50"
                          disabled={!perms.canReconcile || Math.abs(r.difference) > 0.5}
                          onClick={() => void onReviewed(r.id)}
                        >
                          Mark Reviewed
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected ? (
            <aside className="rounded border border-erp-border bg-erp-surface/40 p-3" aria-label="Reconciliation detail">
              <h2 className="text-[13px] font-semibold text-erp-text">{selected.name}</h2>
              <p className="mt-1 text-[12px] text-erp-muted">
                Difference {formatCurrency(selected.difference)}. Balances are read-only — resolve via source documents.
              </p>
              <p className="mt-2 text-[12px] text-erp-text">
                Supporting entries: open AR/AP/Inventory/Bank modules for drill-down (demo links on dashboard unposted
                list).
              </p>
              <label className="mt-3 flex flex-col gap-1 text-[11px] font-semibold text-erp-muted">
                Reconciliation note
                <textarea
                  className="min-h-[64px] rounded border border-erp-border bg-white px-2 py-1.5 text-[12px] text-erp-text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  aria-label="Reconciliation note"
                />
              </label>
              <button
                type="button"
                className="mt-2 rounded bg-erp-primary px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                disabled={!perms.canReconcile}
                onClick={() => void onNote()}
              >
                Add Reconciliation Note
              </button>
            </aside>
          ) : null}
        </div>
      ) : null}
    </PeriodCloseShell>
  )
}
