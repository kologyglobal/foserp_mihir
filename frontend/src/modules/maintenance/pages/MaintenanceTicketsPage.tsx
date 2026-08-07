import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, Wrench } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { StatusDot } from '@/components/design-system/StatusDot'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Input, Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import {
  listMaintenanceTickets,
  type MaintenanceStatus,
  type MaintenanceTicket,
} from '@/services/api/maintenanceApi'
import { notify } from '@/store/toastStore'
import { useMaintenancePermissions } from '@/utils/permissions/maintenance'
import {
  MAINTENANCE_BREADCRUMB,
  formatInr,
  formatStatusLabel,
  maintenanceStatusTone,
} from '../maintenanceUi'

const STATUSES: MaintenanceStatus[] = [
  'REPORTED',
  'IN_REPAIR',
  'WAITING_FOR_PART',
  'ON_HOLD',
  'TESTING',
  'CLOSED',
  'CANCELLED',
]

export function MaintenanceTicketsPage() {
  const navigate = useNavigate()
  const perms = useMaintenancePermissions()
  const [rows, setRows] = useState<MaintenanceTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<MaintenanceStatus | ''>('')
  const [openOnly, setOpenOnly] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listMaintenanceTickets({
        search: search || undefined,
        status: status || undefined,
        openOnly: openOnly || undefined,
        limit: 100,
      })
      setRows(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load tickets')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [search, status, openOnly])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Maintenance"
      title="Tickets"
      description="Breakdown tickets — report, repair, test, close."
      breadcrumbs={[MAINTENANCE_BREADCRUMB, { label: 'Tickets' }]}
      autoBreadcrumbs={false}
      favoritePath="/maintenance/tickets"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreate
              ? { id: 'report', label: 'Report Breakdown', icon: Plus, onClick: () => navigate('/maintenance/tickets/new') }
              : undefined
          }
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-erp-muted">
          Search
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ticket / machine / problem" className="min-w-[200px]" />
        </label>
        <label className="grid gap-1 text-xs text-erp-muted">
          Status
          <Select value={status} onChange={(e) => setStatus(e.target.value as MaintenanceStatus | '')}>
            <option value="">{SELECT_PLACEHOLDER}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {formatStatusLabel(s)}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-erp-fg">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
          Open only
        </label>
      </div>

      {loading ? (
        <LoadingState variant="card" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Wrench} title="No tickets" description="Report a breakdown to create the first ticket." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-erp-border bg-white">
          <table className="min-w-full text-left text-[13px]">
            <thead className="border-b border-erp-border bg-slate-50 text-[11px] uppercase tracking-wide text-erp-muted">
              <tr>
                <th className="px-3 py-2">Ticket</th>
                <th className="px-3 py-2">Machine</th>
                <th className="px-3 py-2">Problem</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Downtime</th>
                {perms.canViewCost ? <th className="px-3 py-2 text-right">Cost</th> : null}
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
                  <td className="px-3 py-2">
                    <Link
                      to={`/maintenance/machines/${row.machineId}/history`}
                      className="text-erp-primary hover:underline"
                    >
                      {row.machine?.code ?? '-'}
                    </Link>
                  </td>
                  <td className="max-w-[280px] truncate px-3 py-2" title={row.problem}>
                    {row.problem}
                  </td>
                  <td className="px-3 py-2">{row.priority}</td>
                  <td className="px-3 py-2">
                    <StatusDot label={formatStatusLabel(row.status)} tone={maintenanceStatusTone(row.status)} />
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.downtimeLabel ?? '-'}</td>
                  {perms.canViewCost ? (
                    <td className="px-3 py-2 text-right tabular-nums">{formatInr(row.totalCost)}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </OperationalPageShell>
  )
}
