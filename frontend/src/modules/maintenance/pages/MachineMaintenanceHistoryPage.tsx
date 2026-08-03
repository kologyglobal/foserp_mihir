import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RefreshCw, Wrench } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { StatusDot } from '@/components/design-system/StatusDot'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { getMachineMaintenanceHistory, type MaintenanceTicket } from '@/services/api/maintenanceApi'
import { notify } from '@/store/toastStore'
import { useMaintenancePermissions } from '@/utils/permissions/maintenance'
import {
  MAINTENANCE_BREADCRUMB,
  formatInr,
  formatStatusLabel,
  maintenanceStatusTone,
} from '../maintenanceUi'

export function MachineMaintenanceHistoryPage() {
  const { machineId = '' } = useParams()
  const perms = useMaintenancePermissions()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Awaited<ReturnType<typeof getMachineMaintenanceHistory>>['data'] | null>(null)

  const load = useCallback(async () => {
    if (!machineId) return
    setLoading(true)
    try {
      const res = await getMachineMaintenanceHistory(machineId)
      setData(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load history')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [machineId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Maintenance"
      title={data?.machine ? `${data.machine.code} — ${data.machine.name}` : 'Machine History'}
      description="Maintenance history for this machine."
      breadcrumbs={[
        MAINTENANCE_BREADCRUMB,
        { label: 'Machines' },
        { label: data?.machine?.code ?? 'History' },
      ]}
      autoBreadcrumbs={false}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : !data ? (
        <EmptyState icon={Wrench} title="Not found" description="Machine history unavailable." />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Tickets" value={String(data.ticketCount)} />
            <Kpi label="Downtime" value={data.downtimeLabel} />
            {perms.canViewCost ? <Kpi label="Repair Cost" value={formatInr(data.repairCost)} /> : null}
            <Kpi label="Closed" value={String(data.closedCount)} />
          </div>
          <HistoryTable rows={data.tickets} showCost={perms.canViewCost} />
        </div>
      )}
    </OperationalPageShell>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-erp-border bg-white px-3 py-3">
      <div className="text-[11px] uppercase tracking-wide text-erp-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function HistoryTable({ rows, showCost }: { rows: MaintenanceTicket[]; showCost: boolean }) {
  if (!rows.length) {
    return <EmptyState icon={Wrench} title="No tickets" description="No maintenance history for this machine." />
  }
  return (
    <div className="overflow-hidden rounded-xl border border-erp-border bg-white">
      <table className="min-w-full text-left text-[13px]">
        <thead className="border-b border-erp-border bg-slate-50 text-[11px] uppercase tracking-wide text-erp-muted">
          <tr>
            <th className="px-3 py-2">Ticket</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Downtime</th>
            {showCost ? <th className="px-3 py-2 text-right">Cost</th> : null}
            <th className="px-3 py-2">Status</th>
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
              <td className="px-3 py-2">{row.failureCategory ?? '—'}</td>
              <td className="px-3 py-2 tabular-nums">{row.downtimeLabel ?? '—'}</td>
              {showCost ? <td className="px-3 py-2 text-right tabular-nums">{formatInr(row.totalCost)}</td> : null}
              <td className="px-3 py-2">
                <StatusDot label={formatStatusLabel(row.status)} tone={maintenanceStatusTone(row.status)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
