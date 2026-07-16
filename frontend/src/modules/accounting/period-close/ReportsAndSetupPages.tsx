import { useCallback, useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { PeriodCloseShell } from '@/components/accounting/period-close'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  exportCloseReportDemo,
  getCloseReports,
  getPeriodCloseSetup,
  loadPeriodCloseFilter,
} from '@/services/accounting/periodCloseService'
import type { CloseReportDef, PeriodCloseSetup, PeriodFilterState } from '@/types/periodClose'
import { CLOSE_TASK_MODULE_LABELS } from '@/types/periodClose'
import { usePeriodClosePermissions } from '@/utils/permissions/periodClose'
import { notify } from '@/store/toastStore'
import { formatDate } from '@/utils/dates/format'

export function CloseReportsPage() {
  const perms = usePeriodClosePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodCloseFilter())
  const [reports, setReports] = useState<CloseReportDef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!perms.canView) {
      setError('You do not have permission to view period close.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setReports(await getCloseReports())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  const onExport = async (id: string) => {
    if (!perms.canExport) {
      notify.error('You do not have permission to export close reports.')
      return
    }
    const res = await exportCloseReportDemo(id)
    notify.info(res.message)
  }

  const categories = [...new Set(reports.map((r) => r.category))]

  return (
    <PeriodCloseShell
      title="Close Reports"
      description="Close progress, reconciliations, adjustments and lock history reports."
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
        <div className="space-y-4">
          {categories.map((cat) => (
            <section key={cat}>
              <h2 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-erp-muted">{cat}</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {reports
                  .filter((r) => r.category === cat)
                  .map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-2 rounded border border-erp-border p-3">
                      <div>
                        <div className="text-[13px] font-semibold text-erp-text">{r.name}</div>
                        <div className="mt-0.5 text-[12px] text-erp-muted">{r.description}</div>
                      </div>
                      <button
                        type="button"
                        className="inline-flex shrink-0 items-center gap-1 rounded border border-erp-border px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
                        disabled={!perms.canExport}
                        onClick={() => void onExport(r.id)}
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden />
                        Export
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </PeriodCloseShell>
  )
}

export function CloseSetupPage() {
  const perms = usePeriodClosePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodCloseFilter())
  const [setup, setSetup] = useState<PeriodCloseSetup | null>(null)
  const [tab, setTab] = useState<'periods' | 'tasks' | 'locks' | 'fx'>('periods')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!perms.canView) {
      setError('You do not have permission to view period close.')
      setLoading(false)
      return
    }
    if (!perms.canManageSetup && !perms.canView) {
      setError('You do not have permission to view close setup.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setSetup(await getPeriodCloseSetup())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load setup')
    } finally {
      setLoading(false)
    }
  }, [perms.canView, perms.canManageSetup])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <PeriodCloseShell
      title="Close Setup"
      description="Effective-dated close configuration: periods, task templates, lock policies and FX rates."
      periodFilter={filter}
      onPeriodChange={setFilter}
      showPeriodBar={false}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            {
              id: 'save',
              label: 'Save Demo Setup',
              disabled: !perms.canManageSetup,
              onClick: () =>
                notify.info('Setup changes are demo-only. Historical configuration versions are not overwritten.'),
            },
          ]}
        />
      }
    >
      <div className="mb-3 flex flex-wrap gap-1 border-b border-erp-border" role="tablist">
        {(
          [
            ['periods', 'Periods & FY'],
            ['tasks', 'Task Templates'],
            ['locks', 'Lock Policies'],
            ['fx', 'FX Rates'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={
              tab === id
                ? 'border-b-2 border-erp-primary px-3 py-2 text-[12px] font-semibold text-erp-primary'
                : 'border-b-2 border-transparent px-3 py-2 text-[12px] font-semibold text-erp-muted'
            }
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {loading ? <LoadingState /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {!loading && !error && setup ? (
        <div className="text-[12px]">
          {tab === 'periods' ? (
            <div className="space-y-3">
              <section>
                <h2 className="font-semibold text-erp-text">Financial years</h2>
                <ul className="mt-1 space-y-1">
                  {setup.fiscalYears.map((fy) => (
                    <li key={fy.code} className="text-erp-muted">
                      {fy.label}: {formatDate(fy.start)} – {formatDate(fy.end)}
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h2 className="font-semibold text-erp-text">Accounting periods</h2>
                <table className="mt-1 w-full max-w-xl border-collapse text-left">
                  <thead>
                    <tr className="border-b border-erp-border text-[10px] uppercase text-erp-muted">
                      <th className="py-1 pr-2">Code</th>
                      <th className="py-1 pr-2">Label</th>
                      <th className="py-1">FY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {setup.periods.map((p) => (
                      <tr key={p.code} className="border-b border-erp-border/60">
                        <td className="py-1 pr-2 font-medium">{p.code}</td>
                        <td className="py-1 pr-2">{p.label}</td>
                        <td className="py-1 text-erp-muted">{p.fiscalYear}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          ) : null}
          {tab === 'tasks' ? (
            <table className="w-full max-w-3xl border-collapse text-left">
              <thead>
                <tr className="border-b border-erp-border text-[10px] uppercase text-erp-muted">
                  <th className="py-1 pr-2">Task</th>
                  <th className="py-1 pr-2">Module</th>
                  <th className="py-1">Default Owner Role</th>
                </tr>
              </thead>
              <tbody>
                {setup.taskTemplates.map((t) => (
                  <tr key={t.id} className="border-b border-erp-border/60">
                    <td className="py-1.5 pr-2 font-medium text-erp-text">{t.task}</td>
                    <td className="py-1.5 pr-2 text-erp-muted">{CLOSE_TASK_MODULE_LABELS[t.module]}</td>
                    <td className="py-1.5 text-erp-muted">{t.defaultOwnerRole}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {tab === 'locks' ? (
            <table className="w-full max-w-2xl border-collapse text-left">
              <thead>
                <tr className="border-b border-erp-border text-[10px] uppercase text-erp-muted">
                  <th className="py-1 pr-2">Module</th>
                  <th className="py-1 pr-2">Soft Lock Days Before</th>
                  <th className="py-1">Hard Lock on Close</th>
                </tr>
              </thead>
              <tbody>
                {setup.lockPolicies.map((p) => (
                  <tr key={p.module} className="border-b border-erp-border/60">
                    <td className="py-1.5 pr-2 font-medium">{p.module}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{p.softLockDaysBefore}</td>
                    <td className="py-1.5">{p.hardLockOnClose ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {tab === 'fx' ? (
            <table className="w-full max-w-md border-collapse text-left">
              <thead>
                <tr className="border-b border-erp-border text-[10px] uppercase text-erp-muted">
                  <th className="py-1 pr-2">Currency</th>
                  <th className="py-1 pr-2">Closing Rate</th>
                  <th className="py-1">As Of</th>
                </tr>
              </thead>
              <tbody>
                {setup.fxRates.map((r) => (
                  <tr key={r.currency} className="border-b border-erp-border/60">
                    <td className="py-1.5 pr-2 font-medium">{r.currency}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{r.closingRate.toFixed(2)}</td>
                    <td className="py-1.5 text-erp-muted">{formatDate(r.asOf)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}
    </PeriodCloseShell>
  )
}
