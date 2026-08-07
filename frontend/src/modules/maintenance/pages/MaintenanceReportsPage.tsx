import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Input, Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listAllMachines } from '@/services/api/manufacturingApi'
import {
  getMaintenanceReports,
  getPmComplianceReport,
  type MaintenanceFailureCategory,
  type MaintenanceStatus,
} from '@/services/api/maintenanceApi'
import { notify } from '@/store/toastStore'
import { useMaintenancePermissions } from '@/utils/permissions/maintenance'
import { MAINTENANCE_BREADCRUMB, formatInr } from '../maintenanceUi'
import type { Machine } from '@/types/manufacturingSetup'

export function MaintenanceReportsPage() {
  const perms = useMaintenancePermissions()
  const [loading, setLoading] = useState(true)
  const [machines, setMachines] = useState<Machine[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [machineId, setMachineId] = useState('')
  const [status, setStatus] = useState<MaintenanceStatus | ''>('')
  const [failureCategory, setFailureCategory] = useState<MaintenanceFailureCategory | ''>('')
  const [data, setData] = useState<Awaited<ReturnType<typeof getMaintenanceReports>>['data'] | null>(null)
  const [pmCompliance, setPmCompliance] = useState<
    Awaited<ReturnType<typeof getPmComplianceReport>>['data'] | null
  >(null)

  useEffect(() => {
    void listAllMachines()
      .then((rows) => setMachines(rows))
      .catch(() => setMachines([]))
  }, [])

  const load = useCallback(async () => {
    if (!perms.canReport) {
      notify.error('Missing maintenance.report.view permission')
      return
    }
    setLoading(true)
    try {
      const [res, pm] = await Promise.all([
        getMaintenanceReports({
          from: from || undefined,
          to: to || undefined,
          machineId: machineId || undefined,
          status: status || undefined,
          failureCategory: failureCategory || undefined,
        }),
        getPmComplianceReport({
          from: from || undefined,
          to: to || undefined,
          machineId: machineId || undefined,
        }).catch(() => ({ data: null })),
      ])
      setData(res.data)
      setPmCompliance(pm.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load reports')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [from, to, machineId, status, failureCategory, perms.canReport])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Maintenance"
      title="Reports"
      description="Downtime, cost, and breakdown frequency."
      breadcrumbs={[MAINTENANCE_BREADCRUMB, { label: 'Reports' }]}
      autoBreadcrumbs={false}
      favoritePath="/maintenance/reports"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="grid gap-1 text-xs text-erp-muted">
          From
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="grid gap-1 text-xs text-erp-muted">
          To
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="grid gap-1 text-xs text-erp-muted">
          Machine
          <Select value={machineId} onChange={(e) => setMachineId(e.target.value)}>
            <option value="">All</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1 text-xs text-erp-muted">
          Status
          <Select value={status} onChange={(e) => setStatus(e.target.value as MaintenanceStatus | '')}>
            <option value="">All</option>
            {['REPORTED', 'IN_REPAIR', 'WAITING_FOR_PART', 'ON_HOLD', 'TESTING', 'CLOSED'].map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1 text-xs text-erp-muted">
          Failure category
          <Select
            value={failureCategory}
            onChange={(e) => setFailureCategory(e.target.value as MaintenanceFailureCategory | '')}
          >
            <option value="">All</option>
            {['MECHANICAL', 'ELECTRICAL', 'HYDRAULIC', 'PNEUMATIC', 'CONTROL', 'SAFETY', 'OTHER'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {loading ? (
        <LoadingState variant="card" />
      ) : !data ? (
        <p className="text-sm text-erp-muted">No report data.</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryCard label="Total Breakdowns" value={String(data.summary.totalBreakdowns)} />
            <SummaryCard
              label="Total Downtime"
              value={`${Math.floor(data.summary.totalDowntimeMinutes / 60)}h ${data.summary.totalDowntimeMinutes % 60}m`}
            />
            {perms.canViewCost ? (
              <SummaryCard label="Total Cost" value={formatInr(data.summary.totalCost)} />
            ) : null}
          </div>

          <MachineTable title="1. Machine Downtime" rows={data.downtimeByMachine} mode="downtime" showCost={perms.canViewCost} />
          {perms.canViewCost ? (
            <MachineTable title="2. Maintenance Cost" rows={data.costByMachine} mode="cost" showCost />
          ) : null}
          <MachineTable title="3. Breakdown Frequency" rows={data.breakdownFrequency} mode="freq" showCost={perms.canViewCost} />

          <section>
            <h2 className="mb-2 text-sm font-semibold">4. Machine Maintenance History</h2>
            <div className="overflow-hidden rounded-xl border border-erp-border bg-white">
              <table className="min-w-full text-left text-[13px]">
                <thead className="border-b border-erp-border bg-slate-50 text-[11px] uppercase text-erp-muted">
                  <tr>
                    <th className="px-3 py-2">Ticket</th>
                    <th className="px-3 py-2">Machine</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Downtime</th>
                    {perms.canViewCost ? <th className="px-3 py-2 text-right">Cost</th> : null}
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tickets.map((t) => (
                    <tr key={t.id} className="border-b border-erp-border/60 last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">
                        <Link to={`/maintenance/tickets/${t.id}`} className="text-erp-primary hover:underline">
                          {t.ticketNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{t.machineCode}</td>
                      <td className="px-3 py-2">{t.failureCategory ?? '-'}</td>
                      <td className="px-3 py-2 tabular-nums">{t.downtimeMinutes ?? '-'}m</td>
                      {perms.canViewCost ? (
                        <td className="px-3 py-2 text-right tabular-nums">{formatInr(t.totalCost)}</td>
                      ) : null}
                      <td className="px-3 py-2">{t.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {data.contractors.length > 0 && perms.canViewCost ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold">5. Contractor Performance</h2>
              <div className="overflow-hidden rounded-xl border border-erp-border bg-white">
                <table className="min-w-full text-left text-[13px]">
                  <thead className="border-b border-erp-border bg-slate-50 text-[11px] uppercase text-erp-muted">
                    <tr>
                      <th className="px-3 py-2">Contractor</th>
                      <th className="px-3 py-2">Jobs</th>
                      <th className="px-3 py-2">Closed</th>
                      <th className="px-3 py-2">Avg repair</th>
                      <th className="px-3 py-2 text-right">Total cost</th>
                      <th className="px-3 py-2 text-right">Avg cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.contractors.map((c) => (
                      <tr key={c.contractorId} className="border-b border-erp-border/60 last:border-0">
                        <td className="px-3 py-2">
                          {c.code} — {c.name}
                        </td>
                        <td className="px-3 py-2">{c.jobs}</td>
                        <td className="px-3 py-2">{c.closedJobs ?? '-'}</td>
                        <td className="px-3 py-2">{c.avgRepairMinutes}m</td>
                        <td className="px-3 py-2 text-right">{formatInr(c.totalCost)}</td>
                        <td className="px-3 py-2 text-right">
                          {formatInr(c.jobs ? c.totalCost / c.jobs : 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {(data.productionImpactByMachine?.length ?? 0) > 0 ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold">6. Production Impact</h2>
              <div className="overflow-hidden rounded-xl border border-erp-border bg-white">
                <table className="min-w-full text-left text-[13px]">
                  <thead className="border-b border-erp-border bg-slate-50 text-[11px] uppercase text-erp-muted">
                    <tr>
                      <th className="px-3 py-2">Machine</th>
                      <th className="px-3 py-2 text-right">Breakdowns</th>
                      <th className="px-3 py-2 text-right">Affected WOs</th>
                      <th className="px-3 py-2 text-right">Affected JCs</th>
                      <th className="px-3 py-2 text-right">Prod. downtime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.productionImpactByMachine!.map((r) => (
                      <tr key={r.machineId} className="border-b border-erp-border/60 last:border-0">
                        <td className="px-3 py-2">
                          {r.code} — {r.name}
                        </td>
                        <td className="px-3 py-2 text-right">{r.breakdowns}</td>
                        <td className="px-3 py-2 text-right">{r.affectedWorkOrders}</td>
                        <td className="px-3 py-2 text-right">{r.affectedJobCards}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Math.floor(r.productionDowntimeMinutes / 60)}h {r.productionDowntimeMinutes % 60}m
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {pmCompliance ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold">7. PM Compliance</h2>
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <SummaryCard label="Scheduled" value={String(pmCompliance.summary.scheduled)} />
                <SummaryCard label="On Time" value={String(pmCompliance.summary.completedOnTime)} />
                <SummaryCard label="Late" value={String(pmCompliance.summary.completedLate)} />
                <SummaryCard label="Overdue" value={String(pmCompliance.summary.overdue)} />
              </div>
              <div className="overflow-hidden rounded-xl border border-erp-border bg-white">
                <table className="min-w-full text-left text-[13px]">
                  <thead className="border-b border-erp-border bg-slate-50 text-[11px] uppercase text-erp-muted">
                    <tr>
                      <th className="px-3 py-2">Plan</th>
                      <th className="px-3 py-2">Machine</th>
                      <th className="px-3 py-2">Due</th>
                      <th className="px-3 py-2">Completed</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Delay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pmCompliance.rows.map((r, i) => (
                      <tr key={`${r.planNumber}-${r.dueDate}-${i}`} className="border-b border-erp-border/60 last:border-0">
                        <td className="px-3 py-2">
                          {r.ticketId ? (
                            <Link to={`/maintenance/tickets/${r.ticketId}`} className="text-erp-primary hover:underline">
                              {r.planNumber}
                            </Link>
                          ) : (
                            r.planNumber
                          )}
                          <div className="text-[11px] text-erp-muted">{r.planName}</div>
                        </td>
                        <td className="px-3 py-2">{r.machineCode}</td>
                        <td className="px-3 py-2">{r.dueDate ?? '-'}</td>
                        <td className="px-3 py-2">{r.completedDate ?? '-'}</td>
                        <td className="px-3 py-2">{r.status.replace(/_/g, ' ')}</td>
                        <td className="px-3 py-2 text-right">{r.delayDays ? `${r.delayDays}d` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </OperationalPageShell>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-erp-border bg-white px-3 py-3">
      <div className="text-[11px] uppercase tracking-wide text-erp-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function MachineTable({
  title,
  rows,
  mode,
  showCost,
}: {
  title: string
  rows: Array<{ machineId: string; code: string; name: string; breakdowns: number; downtimeMinutes: number; cost: number }>
  mode: 'downtime' | 'cost' | 'freq'
  showCost: boolean
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <div className="overflow-hidden rounded-xl border border-erp-border bg-white">
        <table className="min-w-full text-left text-[13px]">
          <thead className="border-b border-erp-border bg-slate-50 text-[11px] uppercase text-erp-muted">
            <tr>
              <th className="px-3 py-2">Machine</th>
              <th className="px-3 py-2">Breakdowns</th>
              <th className="px-3 py-2">Downtime</th>
              {showCost ? <th className="px-3 py-2 text-right">Cost</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${mode}-${r.machineId}`} className="border-b border-erp-border/60 last:border-0">
                <td className="px-3 py-2">
                  <Link to={`/maintenance/machines/${r.machineId}/history`} className="text-erp-primary hover:underline">
                    {r.code} — {r.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{r.breakdowns}</td>
                <td className="px-3 py-2">
                  {Math.floor(r.downtimeMinutes / 60)}h {r.downtimeMinutes % 60}m
                </td>
                {showCost ? <td className="px-3 py-2 text-right">{formatInr(r.cost)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
