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
import { getMaterialConsumption } from '@/services/accounting/manufacturingAccountingService'
import type { MaterialConsumptionLine } from '@/types/manufacturingAccounting'
import { DEFAULT_MANUFACTURING_ACCOUNTING_FILTER } from '@/types/manufacturingAccounting'
import { useManufacturingAccountingPermissions } from '@/utils/permissions/manufacturingAccounting'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { MFG_ACCOUNTING_BREADCRUMB, selectCls, type LoadState } from './manufacturingAccountingUi'
import { cn } from '@/utils/cn'

export function ManufacturingMaterialConsumptionPage() {
  const perms = useManufacturingAccountingPermissions()
  const [rows, setRows] = useState<MaterialConsumptionLine[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [refreshToken, setRefreshToken] = useState(0)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    try {
      const list = await getMaterialConsumption({
        ...DEFAULT_MANUFACTURING_ACCOUNTING_FILTER,
        search,
        dateFrom,
        dateTo,
      })
      if (signal?.cancelled) return
      setRows(list)
      setLoadState(list.length === 0 ? 'empty' : 'ready')
    } catch {
      if (signal?.cancelled) return
      setLoadState('error')
    }
  }, [search, dateFrom, dateTo])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => { signal.cancelled = true }
  }, [load, refreshToken])

  const summary = useMemo(() => ({
    count: rows.length,
    actualValue: rows.reduce((s, r) => s + r.actualValue, 0),
    variance: rows.reduce((s, r) => s + r.varianceValue, 0),
    standardValue: rows.reduce((s, r) => s + r.standardValue, 0),
  }), [rows])

  const kpis: EnterpriseKpiItem[] = [
    { id: 'lines', label: 'Consumption Lines', value: summary.count, accent: 'blue' },
    { id: 'actual', label: 'Total Actual Value', value: formatCompactCurrency(summary.actualValue), helper: formatCurrency(summary.actualValue), accent: 'slate' },
    { id: 'std', label: 'Total Standard Value', value: formatCompactCurrency(summary.standardValue), accent: 'blue' },
    { id: 'var', label: 'Total Variance', value: formatCompactCurrency(Math.abs(summary.variance)), helper: formatCurrency(summary.variance), accent: summary.variance > 0 ? 'red' : 'green' },
  ]

  if (!perms.canViewConsumption) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Material Consumption" breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Material Consumption' }]} autoBreadcrumbs={false}>
        <ManufacturingAccountingEmptyState title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Material Consumption"
      description="Material issued to production orders — standard vs actual quantity, rate and value."
      breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Material Consumption' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/manufacturing/material-consumption"
      showDescription
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) }]} />}
    >
      <ManufacturingAccountingWorkspaceTabs active="material_consumption" />
      <div className="space-y-3 p-4">
        <ManufacturingAccountingDemoBanner />
        <ManufacturingAccountingSummaryCards items={kpis} columns={4} />

        <div className="flex flex-wrap items-end gap-2 rounded-md border border-erp-border bg-white p-3">
          <div className="min-w-[200px] flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search PO, item, material, cost centre…" />
          </div>
          <label className="text-[11px] text-erp-muted">
            From
            <input type="date" className={selectCls} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="text-[11px] text-erp-muted">
            To
            <input type="date" className={selectCls} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
        </div>

        {loadState === 'loading' ? <LoadingState variant="table" rows={10} /> : null}
        {loadState === 'error' ? <ManufacturingAccountingEmptyState title="Load failed" /> : null}

        <div className="overflow-x-auto rounded-md border border-erp-border bg-white">
          <table className="min-w-full text-left text-[12px]">
            <thead className="sticky top-0 z-[1] bg-erp-surface text-[11px] uppercase tracking-wide text-erp-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">PO</th>
                <th className="px-3 py-2 font-semibold">Finished Item</th>
                <th className="px-3 py-2 font-semibold">Material</th>
                <th className="px-3 py-2 text-right font-semibold">Std Qty</th>
                <th className="px-3 py-2 text-right font-semibold">Act Qty</th>
                <th className="px-3 py-2 text-right font-semibold">Std Value</th>
                <th className="px-3 py-2 text-right font-semibold">Act Value</th>
                <th className="px-3 py-2 text-right font-semibold">Variance</th>
                <th className="px-3 py-2 font-semibold">Cost Centre</th>
                <th className="px-3 py-2 font-semibold">Issue Doc</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-erp-border/80 hover:bg-erp-surface-alt/50">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.consumptionDate)}</td>
                  <td className="px-3 py-2 font-medium">{row.productionOrderNumber}</td>
                  <td className="px-3 py-2">{row.itemName}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{row.materialName}</span>
                    <span className="ml-1 text-erp-muted">({row.materialCode})</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.standardQty} {row.uom}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.actualQty} {row.uom}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.standardValue)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.actualValue)}</td>
                  <td className={cn('px-3 py-2 text-right tabular-nums font-semibold', row.varianceValue > 0 ? 'text-rose-700' : row.varianceValue < 0 ? 'text-emerald-700' : '')}>
                    {formatCurrency(row.varianceValue)}
                  </td>
                  <td className="px-3 py-2 text-erp-muted">{row.costCentre}</td>
                  <td className="px-3 py-2 text-erp-muted">{row.issueDocument}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && loadState !== 'loading' ? (
            <ManufacturingAccountingEmptyState title="No consumption lines match" description="Adjust search or date filters." />
          ) : null}
        </div>
      </div>
    </OperationalPageShell>
  )
}
