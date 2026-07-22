import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, ShieldOff, Wrench } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { Select } from '@/components/forms/Inputs'
import {
  FixedAssetsDemoBanner,
  FixedAssetsGenericStatusBadge,
  FixedAssetsSummaryCards,
  FixedAssetsWorkspaceTabs,
} from '@/components/accounting/fixedAssets'
import { getMaintenance } from '@/services/accounting/fixedAssetsService'
import type { AssetMaintenance, MaintenanceStatus, MaintenanceType } from '@/types/fixedAssets'
import { useFixedAssetsPermissions } from '@/utils/permissions/fixedAssets'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import type { LoadState } from './fixedAssetsUi'

const MAINTENANCE_TYPES: MaintenanceType[] = ['Preventive', 'Breakdown', 'Calibration', 'AMC', 'Inspection']
const MAINTENANCE_STATUSES: MaintenanceStatus[] = ['Scheduled', 'In Progress', 'Completed', 'Cancelled']

export function AssetMaintenancePage() {
  const perms = useFixedAssetsPermissions()
  const [rows, setRows] = useState<AssetMaintenance[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<MaintenanceType | ''>('')
  const [statusFilter, setStatusFilter] = useState<MaintenanceStatus | ''>('')

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const list = await getMaintenance()
      setRows(list)
      setLoadState(list.length === 0 ? 'empty' : 'ready')
    } catch {
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    return rows.filter((r) => {
      if (search && !`${r.maintenanceNumber} ${r.assetNumber} ${r.assetName} ${r.vendorName ?? ''}`.toLowerCase().includes(search.toLowerCase())) return false
      if (typeFilter && r.maintenanceType !== typeFilter) return false
      if (statusFilter && r.status !== statusFilter) return false
      return true
    })
  }, [rows, search, typeFilter, statusFilter])

  const kpis: EnterpriseKpiItem[] = useMemo(() => {
    const scheduled = rows.filter((r) => r.status === 'Scheduled').length
    const inProgress = rows.filter((r) => r.status === 'In Progress').length
    const totalCost = rows.reduce((s, r) => s + r.cost, 0)
    return [
      { id: 'count', label: 'Maintenance Records', value: rows.length, accent: 'blue' },
      { id: 'scheduled', label: 'Scheduled', value: scheduled, accent: 'amber' },
      { id: 'progress', label: 'In Progress', value: inProgress, accent: inProgress > 0 ? 'red' : 'slate' },
      { id: 'cost', label: 'Total Cost', value: formatCompactCurrency(totalCost), helper: formatCurrency(totalCost), accent: 'slate' },
    ]
  }, [rows])

  if (!perms.canMaintain && !perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Maintenance" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Maintenance' }]} autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Asset Maintenance"
      description="Preventive, breakdown, AMC and calibration maintenance history across fixed assets."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Maintenance' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/fixed-assets/maintenance"
      showDescription
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]} />}
    >
      <FixedAssetsWorkspaceTabs active="maintenance" />
      <div className="space-y-3 p-4">
        <FixedAssetsDemoBanner variant="partial" />
        <FixedAssetsSummaryCards items={kpis} columns={4} />

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search maintenance number, asset, vendor…" />
          </div>
          <label className="text-[11px] text-erp-muted">
            Type
            <Select wrapClassName="w-40" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as MaintenanceType | '')}>
              <option value="">All types</option>
              {MAINTENANCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </label>
          <label className="text-[11px] text-erp-muted">
            Status
            <Select wrapClassName="w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as MaintenanceStatus | '')}>
              <option value="">All statuses</option>
              {MAINTENANCE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </label>
        </div>

        <EnterpriseRegisterTableShell>
          {loadState === 'loading' ? <div className="p-6"><LoadingState variant="table" rows={8} /></div> : null}
          {loadState === 'error' ? <div className="p-6"><EmptyState icon={Wrench} title="Could not load maintenance records" /></div> : null}
          {(loadState === 'ready' || loadState === 'empty') ? (
            visible.length === 0 ? (
              <div className="p-6"><EmptyState icon={Wrench} title="No maintenance records match" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="erp-table w-full min-w-[1040px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                      <th className="px-3 py-2 font-semibold">Number</th>
                      <th className="px-3 py-2 font-semibold">Asset</th>
                      <th className="px-3 py-2 font-semibold">Type</th>
                      <th className="px-3 py-2 font-semibold">Scheduled</th>
                      <th className="px-3 py-2 font-semibold">Completed</th>
                      <th className="px-3 py-2 font-semibold">Vendor</th>
                      <th className="px-3 py-2 text-right font-semibold">Cost</th>
                      <th className="px-3 py-2 text-right font-semibold">Downtime (hrs)</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.id} className="border-b border-erp-border/80 hover:bg-erp-surface-alt/40">
                        <td className="px-3 py-2 font-mono">{r.maintenanceNumber}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium">{r.assetNumber}</p>
                          <p className="text-[11px] text-erp-muted">{r.assetName}</p>
                        </td>
                        <td className="px-3 py-2">{r.maintenanceType}</td>
                        <td className="px-3 py-2">{formatDate(r.scheduledDate)}</td>
                        <td className="px-3 py-2">{r.completedDate ? formatDate(r.completedDate) : '—'}</td>
                        <td className="px-3 py-2">{r.vendorName ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.cost)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.downtimeHours ?? '—'}</td>
                        <td className="px-3 py-2"><FixedAssetsGenericStatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </EnterpriseRegisterTableShell>
      </div>
    </OperationalPageShell>
  )
}
