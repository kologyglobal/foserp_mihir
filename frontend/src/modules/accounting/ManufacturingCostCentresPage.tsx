import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  ManufacturingAccountingDemoBanner,
  ManufacturingAccountingEmptyState,
  ManufacturingAccountingSummaryCards,
  ManufacturingAccountingWorkspaceTabs,
} from '@/components/accounting/manufacturingAccounting'
import { getCostCentres } from '@/services/accounting/manufacturingAccountingService'
import type { CostCentreRow } from '@/types/manufacturingAccounting'
import { DEFAULT_MANUFACTURING_ACCOUNTING_FILTER } from '@/types/manufacturingAccounting'
import { useManufacturingAccountingPermissions } from '@/utils/permissions/manufacturingAccounting'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { MFG_ACCOUNTING_BREADCRUMB, selectCls, type LoadState } from './manufacturingAccountingUi'
import { cn } from '@/utils/cn'

export function ManufacturingCostCentresPage() {
  const perms = useManufacturingAccountingPermissions()
  const [rows, setRows] = useState<CostCentreRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [refreshToken, setRefreshToken] = useState(0)
  const [search, setSearch] = useState('')
  const [plant, setPlant] = useState('')

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    try {
      const list = await getCostCentres({
        ...DEFAULT_MANUFACTURING_ACCOUNTING_FILTER,
        search,
        plant,
      })
      if (signal?.cancelled) return
      setRows(list)
      setLoadState(list.length === 0 ? 'empty' : 'ready')
    } catch {
      if (signal?.cancelled) return
      setLoadState('error')
    }
  }, [search, plant])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => { signal.cancelled = true }
  }, [load, refreshToken])

  const plantOptions = useMemo(() => [...new Set(rows.map((r) => r.plant))].sort(), [rows])

  const summary = useMemo(() => ({
    count: rows.length,
    totalCost: rows.reduce((s, r) => s + r.totalCost, 0),
    budget: rows.reduce((s, r) => s + r.budgetAmount, 0),
    variance: rows.reduce((s, r) => s + r.varianceAmount, 0),
    activeOrders: rows.reduce((s, r) => s + r.activeOrders, 0),
  }), [rows])

  const kpis: EnterpriseKpiItem[] = [
    { id: 'cc', label: 'Cost Centres', value: summary.count, accent: 'blue' },
    { id: 'cost', label: 'Total Cost', value: formatCompactCurrency(summary.totalCost), accent: 'slate' },
    { id: 'budget', label: 'Budget', value: formatCompactCurrency(summary.budget), accent: 'blue' },
    { id: 'var', label: 'Budget Variance', value: formatCompactCurrency(Math.abs(summary.variance)), helper: formatCurrency(summary.variance), accent: summary.variance > 0 ? 'red' : 'green' },
    { id: 'orders', label: 'Active Orders', value: summary.activeOrders, accent: 'amber' },
  ]

  if (!perms.canViewCostCentres) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Cost Centres" breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Cost Centres' }]} autoBreadcrumbs={false}>
        <ManufacturingAccountingEmptyState title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Cost Centres"
      description="Manufacturing cost centres with budget vs actual cost and variance."
      breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Cost Centres' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/manufacturing/cost-centres"
      showDescription
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) }]} />}
    >
      <ManufacturingAccountingWorkspaceTabs active="cost_centres" />
      <div className="space-y-3 p-4">
        <ManufacturingAccountingDemoBanner />
        <ManufacturingAccountingSummaryCards items={kpis} columns={5} />

        <div className="flex flex-wrap items-end gap-2 rounded-md border border-erp-border bg-white p-3">
          <div className="min-w-[200px] flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search code, name, department, manager…" />
          </div>
          <label className="text-[11px] text-erp-muted">
            Plant
            <select className={selectCls} value={plant} onChange={(e) => setPlant(e.target.value)}>
              <option value="">All</option>
              {plantOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        </div>

        {loadState === 'loading' ? <LoadingState variant="table" rows={10} /> : null}
        {loadState === 'error' ? <ManufacturingAccountingEmptyState title="Load failed" /> : null}

        <div className="overflow-x-auto rounded-md border border-erp-border bg-white">
          <table className="min-w-full text-left text-[12px]">
            <thead className="sticky top-0 z-[1] bg-erp-surface text-[11px] uppercase tracking-wide text-erp-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Code</th>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Department</th>
                <th className="px-3 py-2 font-semibold">Plant</th>
                <th className="px-3 py-2 font-semibold">Manager</th>
                <th className="px-3 py-2 text-right font-semibold">WIP Value</th>
                <th className="px-3 py-2 text-right font-semibold">FG Value</th>
                <th className="px-3 py-2 text-right font-semibold">Total Cost</th>
                <th className="px-3 py-2 text-right font-semibold">Budget</th>
                <th className="px-3 py-2 text-right font-semibold">Variance</th>
                <th className="px-3 py-2 text-right font-semibold">Active Orders</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-erp-border/80 hover:bg-erp-surface-alt/50">
                  <td className="px-3 py-2 font-medium">{row.code}</td>
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2 text-erp-muted">{row.department}</td>
                  <td className="px-3 py-2">{row.plant}</td>
                  <td className="px-3 py-2">{row.manager}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.wipValue)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.fgValue)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(row.totalCost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.budgetAmount)}</td>
                  <td className={cn('px-3 py-2 text-right tabular-nums font-semibold', row.varianceAmount > 0 ? 'text-rose-700' : row.varianceAmount < 0 ? 'text-emerald-700' : '')}>
                    {formatCurrency(row.varianceAmount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.activeOrders}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && loadState !== 'loading' ? (
            <ManufacturingAccountingEmptyState title="No cost centres match" />
          ) : null}
        </div>
      </div>
    </OperationalPageShell>
  )
}
