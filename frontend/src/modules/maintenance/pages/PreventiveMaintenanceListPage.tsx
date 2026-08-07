import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarCheck, Plus, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { StatusDot } from '@/components/design-system/StatusDot'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Input, Select } from '@/components/forms/Inputs'
import {
  listPreventivePlans,
  type PmDueStatus,
  type PreventiveMaintenancePlan,
} from '@/services/api/maintenanceApi'
import { notify } from '@/store/toastStore'
import { useMaintenancePermissions } from '@/utils/permissions/maintenance'
import { MAINTENANCE_BREADCRUMB } from '../maintenanceUi'

function dueTone(s: PmDueStatus): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (s === 'OVERDUE') return 'danger'
  if (s === 'DUE') return 'warning'
  return 'info'
}

export function PreventiveMaintenanceListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const perms = useMaintenancePermissions()
  const [rows, setRows] = useState<PreventiveMaintenancePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dueStatus, setDueStatus] = useState<PmDueStatus | ''>(
    () => (searchParams.get('dueStatus') as PmDueStatus | null) ?? '',
  )

  const load = useCallback(async () => {
    if (!perms.canView) return
    setLoading(true)
    try {
      const res = await listPreventivePlans({
        search: search || undefined,
        dueStatus: dueStatus || undefined,
        activeOnly: true,
        limit: 100,
      })
      setRows(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load PM plans')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [search, dueStatus, perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Maintenance"
      title="Preventive Maintenance"
      description="PM plans — due → create ticket → service → test → close → next due."
      breadcrumbs={[MAINTENANCE_BREADCRUMB, { label: 'Preventive Maintenance' }]}
      autoBreadcrumbs={false}
      favoritePath="/maintenance/preventive"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreate
              ? {
                  id: 'new-pm',
                  label: 'New Plan',
                  icon: Plus,
                  onClick: () => navigate('/maintenance/preventive/new'),
                }
              : undefined
          }
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      }
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Search plan / machine…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={dueStatus} onChange={(e) => setDueStatus(e.target.value as PmDueStatus | '')}>
          <option value="">All due status</option>
          <option value="OVERDUE">Overdue</option>
          <option value="DUE">Due</option>
          <option value="UPCOMING">Upcoming</option>
        </Select>
      </div>

      {loading ? (
        <LoadingState variant="card" />
      ) : !rows.length ? (
        <EmptyState
          icon={CalendarCheck}
          title="No PM plans"
          description="Create a preventive plan for a machine."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-erp-border bg-white">
          <table className="min-w-full text-left text-[13px]">
            <thead className="border-b border-erp-border bg-slate-50 text-[11px] uppercase text-erp-muted">
              <tr>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Machine</th>
                <th className="px-3 py-2">Frequency</th>
                <th className="px-3 py-2">Last Service</th>
                <th className="px-3 py-2">Next Due</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Assigned To</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-erp-border/60 last:border-0">
                  <td className="px-3 py-2">
                    <Link
                      to={`/maintenance/preventive/${r.id}`}
                      className="font-mono text-xs text-erp-primary hover:underline"
                    >
                      {r.planNumber}
                    </Link>
                    <div className="text-[12px] text-erp-fg">{r.name}</div>
                  </td>
                  <td className="px-3 py-2">{r.machine?.code ?? '-'}</td>
                  <td className="px-3 py-2">{r.frequencyLabel}</td>
                  <td className="px-3 py-2 tabular-nums">{r.lastCompletedDate ?? '-'}</td>
                  <td className="px-3 py-2 tabular-nums">{r.nextDueDate}</td>
                  <td className="px-3 py-2">
                    <StatusDot label={r.dueStatus} tone={dueTone(r.dueStatus)} />
                  </td>
                  <td className="px-3 py-2">
                    {r.contractor?.name ?? (r.assignedTechnicianId ? 'Internal' : '-')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </OperationalPageShell>
  )
}
