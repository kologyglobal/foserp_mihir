import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Plus, RefreshCw, Wrench } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { StatusDot } from '@/components/design-system/StatusDot'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { getMaintenanceDashboard, type MaintenanceDashboard } from '@/services/api/maintenanceApi'
import { notify } from '@/store/toastStore'
import { useMaintenancePermissions } from '@/utils/permissions/maintenance'
import { MAINTENANCE_BREADCRUMB, formatStatusLabel, maintenanceStatusTone } from '../maintenanceUi'

export function MaintenanceDashboardPage() {
  const navigate = useNavigate()
  const perms = useMaintenancePermissions()
  const [data, setData] = useState<MaintenanceDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMaintenanceDashboard()
      setData(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load dashboard')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const kpis = [
    { label: 'Open Tickets', value: String(data?.openTickets ?? 0) },
    { label: 'Machines Down', value: String(data?.machinesDown ?? 0) },
    { label: 'Under Repair', value: String(data?.underRepair ?? 0) },
    { label: 'Waiting for Parts', value: String(data?.waitingForParts ?? 0) },
    {
      label: 'Downtime This Month',
      value: data?.downtimeThisMonthLabel ?? '0m',
    },
    {
      label: 'Cost This Month',
      value:
        data?.maintenanceCostThisMonth != null
          ? new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: 'INR',
              maximumFractionDigits: 0,
            }).format(data.maintenanceCostThisMonth)
          : '-',
    },
    { label: 'PM Due Today', value: String(data?.pmDueToday ?? 0) },
    { label: 'PM Due This Week', value: String(data?.pmDueThisWeek ?? 0) },
    { label: 'PM Overdue', value: String(data?.pmOverdue ?? 0) },
  ]

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Maintenance"
      title="Dashboard"
      description="Open breakdowns and machines that need attention."
      breadcrumbs={[MAINTENANCE_BREADCRUMB, { label: 'Dashboard' }]}
      autoBreadcrumbs={false}
      favoritePath="/maintenance"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreate
              ? {
                  id: 'start-maintenance',
                  label: 'Start Maintenance',
                  icon: Plus,
                  onClick: () => navigate('/maintenance/tickets/new'),
                }
              : undefined
          }
          secondaryActions={[
            {
              id: 'report',
              label: 'Report Breakdown',
              icon: AlertTriangle,
              onClick: () => navigate('/maintenance/tickets/new'),
            },
            { id: 'tickets', label: 'Tickets', icon: Wrench, onClick: () => navigate('/maintenance/tickets') },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-950">
            <span className="font-semibold">Revised flow:</span> Start Maintenance → Upload Photos → Assign
            Technician/Contractor → Parts &amp; Service → Invoice &amp; Amount → Close
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-lg border border-erp-border bg-white px-3 py-3">
                <div className="text-[11px] uppercase tracking-wide text-erp-muted">{k.label}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-erp-fg">{k.value}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link to="/maintenance/machine-health" className="font-medium text-erp-primary hover:underline">
              Open Machine Health →
            </Link>
            <Link to="/maintenance/preventive?dueStatus=OVERDUE" className="font-medium text-erp-primary hover:underline">
              Preventive Maintenance Due →
            </Link>
          </div>

          {(data?.pmNeedsAttention?.length ?? 0) > 0 ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-erp-fg">Preventive Maintenance Due</h2>
              <div className="overflow-hidden rounded-xl border border-erp-border bg-white">
                <table className="min-w-full text-left text-[13px]">
                  <thead className="border-b border-erp-border bg-slate-50 text-[11px] uppercase text-erp-muted">
                    <tr>
                      <th className="px-3 py-2">Plan</th>
                      <th className="px-3 py-2">Machine</th>
                      <th className="px-3 py-2">Next Due</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.pmNeedsAttention!.map((p) => (
                      <tr key={p.id} className="border-b border-erp-border/60 last:border-0">
                        <td className="px-3 py-2">
                          <Link
                            to={`/maintenance/preventive/${p.id}`}
                            className="font-mono text-xs text-erp-primary hover:underline"
                          >
                            {p.planNumber}
                          </Link>
                          <div className="text-[12px]">{p.name}</div>
                        </td>
                        <td className="px-3 py-2">{p.machine?.code ?? '-'}</td>
                        <td className="px-3 py-2 tabular-nums">{p.nextDueDate}</td>
                        <td className="px-3 py-2">{p.dueStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="mb-2 text-sm font-semibold text-erp-fg">Needs Attention</h2>
            {!data?.needsAttention?.length ? (
              <EmptyState icon={AlertTriangle} title="Nothing urgent" description="No open tickets needing attention." />
            ) : (
              <TicketMiniTable rows={data.needsAttention} />
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-erp-fg">Recent Maintenance</h2>
            {!data?.recent?.length ? (
              <p className="text-sm text-erp-muted">No recent tickets.</p>
            ) : (
              <TicketMiniTable rows={data.recent} />
            )}
          </section>
        </div>
      )}
    </OperationalPageShell>
  )
}

function TicketMiniTable({ rows }: { rows: MaintenanceDashboard['needsAttention'] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-erp-border bg-white">
      <table className="min-w-full text-left text-[13px]">
        <thead className="border-b border-erp-border bg-slate-50 text-[11px] uppercase tracking-wide text-erp-muted">
          <tr>
            <th className="px-3 py-2">Ticket</th>
            <th className="px-3 py-2">Machine</th>
            <th className="px-3 py-2">Problem</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Downtime</th>
            <th className="px-3 py-2">Assigned</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-erp-border/60 last:border-0">
              <td className="px-3 py-2 font-mono text-xs">
                <Link to={`/maintenance/tickets/${row.id}`} className="text-erp-primary hover:underline">
                  {row.ticketNumber}
                </Link>
              </td>
              <td className="px-3 py-2">{row.machine?.code ?? '-'}</td>
              <td className="max-w-[240px] truncate px-3 py-2" title={row.problem}>
                {row.problem}
              </td>
              <td className="px-3 py-2">
                <StatusDot label={formatStatusLabel(row.status)} tone={maintenanceStatusTone(row.status)} />
              </td>
              <td className="px-3 py-2 tabular-nums">{row.downtimeLabel ?? '-'}</td>
              <td className="px-3 py-2">{row.technicianName ?? row.contractor?.name ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
