import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AlertTriangle } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import {
  getMachineHealth,
  type MachineHealthRow,
  type MaintenanceFailureCategory,
} from '@/services/api/maintenanceApi'
import { notify } from '@/store/toastStore'
import { useMaintenancePermissions } from '@/utils/permissions/maintenance'
import { MAINTENANCE_BREADCRUMB, formatInr } from '../maintenanceUi'

function healthTone(h: MachineHealthRow['healthStatus']) {
  if (h === 'DOWN') return 'bg-rose-100 text-rose-800'
  if (h === 'MAINTENANCE') return 'bg-amber-100 text-amber-900'
  if (h === 'ATTENTION') return 'bg-orange-100 text-orange-900'
  return 'bg-emerald-100 text-emerald-800'
}

export function MachineHealthPage() {
  const perms = useMaintenancePermissions()
  const [period, setPeriod] = useState<'YTD' | '30d' | '90d'>('YTD')
  const [status, setStatus] = useState('')
  const [failureCategory, setFailureCategory] = useState<MaintenanceFailureCategory | ''>('')
  const [rows, setRows] = useState<MachineHealthRow[]>([])
  const [attention, setAttention] = useState<MachineHealthRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!perms.canView) return
    setLoading(true)
    try {
      const res = await getMachineHealth({
        period,
        status: status || undefined,
        failureCategory: failureCategory || undefined,
      })
      setRows(res.data.items)
      setAttention(res.data.attention)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load machine health')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, status, failureCategory, perms.canView])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Maintenance"
      title="Machine Health"
      description="Breakdown frequency, downtime, cost, and repeat risk — read model only."
      breadcrumbs={[MAINTENANCE_BREADCRUMB, { label: 'Machine Health' }]}
      autoBreadcrumbs={false}
      favoritePath="/maintenance/machine-health"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: Activity, onClick: () => void load() }]}
        />
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <FormField label="Period">
          <Select value={period} onChange={(e) => setPeriod(e.target.value as 'YTD' | '30d' | '90d')}>
            <option value="YTD">YTD</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </Select>
        </FormField>
        <FormField label="Machine status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
            <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option>
            <option value="IN_USE">IN_USE</option>
          </Select>
        </FormField>
        <FormField label="Failure category">
          <Select
            value={failureCategory}
            onChange={(e) => setFailureCategory(e.target.value as MaintenanceFailureCategory | '')}
          >
            <option value="">{SELECT_PLACEHOLDER}</option>
            {['MECHANICAL', 'ELECTRICAL', 'HYDRAULIC', 'PNEUMATIC', 'CONTROL', 'SAFETY', 'OTHER'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {attention.length > 0 ? (
        <div className="mb-4 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-950">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> Needs attention ({attention.length})
          </div>
          <ul className="space-y-1">
            {attention.slice(0, 5).map((r) => (
              <li key={r.machineId}>
                <Link className="font-medium text-erp-primary hover:underline" to={`/maintenance/machines/${r.machineId}/history`}>
                  {r.machineCode}
                </Link>
                {' · '}
                {r.healthStatus}
                {r.repeatBreakdown
                  ? ` · Repeat breakdown (${r.repeatBreakdownCount} in ${r.repeatBreakdownDays}d)`
                  : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-erp-border">
        <table className="min-w-full text-left text-[13px]">
          <thead className="bg-slate-50 text-[11px] uppercase text-erp-muted">
            <tr>
              <th className="px-3 py-2">Machine</th>
              <th className="px-3 py-2">Work Centre</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Breakdowns</th>
              <th className="px-3 py-2 text-right">Downtime</th>
              <th className="px-3 py-2 text-right">Cost</th>
              <th className="px-3 py-2 text-right">Avg Repair</th>
              <th className="px-3 py-2">Last Breakdown</th>
              <th className="px-3 py-2">Health</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-4 text-erp-muted" colSpan={9}>
                  Loading…
                </td>
              </tr>
            ) : null}
            {!loading &&
              rows.map((r) => (
                <tr key={r.machineId} className="border-t border-erp-border/60">
                  <td className="px-3 py-2">
                    <Link
                      to={`/maintenance/machines/${r.machineId}/history`}
                      className="font-semibold text-erp-primary hover:underline"
                    >
                      {r.machineCode}
                    </Link>
                    <div className="text-[11px] text-erp-muted">{r.machineName}</div>
                    {r.repeatBreakdown ? (
                      <div className="mt-0.5 text-[11px] font-medium text-orange-700">
                        ⚠ Repeat · {r.repeatBreakdownCount} in {r.repeatBreakdownDays}d ·{' '}
                        {formatInr(r.repeatCost)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{r.workCentre ? `${r.workCentre.code}` : '—'}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {period === 'YTD' ? r.breakdownsYtd : period === '30d' ? r.breakdowns30d : r.breakdowns90d}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {period === 'YTD' ? r.downtimeYtdLabel : r.downtime30dLabel}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatInr(period === 'YTD' ? r.maintenanceCostYtd : r.maintenanceCost30d)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.averageRepairLabel ?? '—'}</td>
                  <td className="px-3 py-2">
                    {r.lastBreakdownAt ? new Date(r.lastBreakdownAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${healthTone(r.healthStatus)}`}>
                      {r.healthStatus}
                    </span>
                  </td>
                </tr>
              ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-erp-muted" colSpan={9}>
                  No machines found
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </OperationalPageShell>
  )
}
