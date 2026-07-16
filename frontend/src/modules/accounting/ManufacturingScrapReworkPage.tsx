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
  ManufacturingGenericStatusBadge,
} from '@/components/accounting/manufacturingAccounting'
import { getScrapReworkCosts } from '@/services/accounting/manufacturingAccountingService'
import type { ScrapReworkCostRow } from '@/types/manufacturingAccounting'
import { DEFAULT_MANUFACTURING_ACCOUNTING_FILTER } from '@/types/manufacturingAccounting'
import { useManufacturingAccountingPermissions } from '@/utils/permissions/manufacturingAccounting'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { MFG_ACCOUNTING_BREADCRUMB, selectCls, type LoadState } from './manufacturingAccountingUi'

export function ManufacturingScrapReworkPage() {
  const perms = useManufacturingAccountingPermissions()
  const [rows, setRows] = useState<ScrapReworkCostRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [refreshToken, setRefreshToken] = useState(0)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    try {
      const list = await getScrapReworkCosts({
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
    scrap: rows.filter((r) => r.type === 'Scrap').length,
    rework: rows.filter((r) => r.type === 'Rework').length,
    cost: rows.reduce((s, r) => s + r.costAmount, 0),
    recovery: rows.reduce((s, r) => s + r.recoveryAmount, 0),
    net: rows.reduce((s, r) => s + r.netCost, 0),
  }), [rows])

  const kpis: EnterpriseKpiItem[] = [
    { id: 'records', label: 'Records', value: summary.count, accent: 'blue' },
    { id: 'scrap', label: 'Scrap', value: summary.scrap, accent: 'red' },
    { id: 'rework', label: 'Rework', value: summary.rework, accent: 'amber' },
    { id: 'net', label: 'Net Cost', value: formatCompactCurrency(summary.net), helper: formatCurrency(summary.net), accent: 'red' },
  ]

  if (!perms.canViewScrap) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Scrap & Rework" breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Scrap & Rework' }]} autoBreadcrumbs={false}>
        <ManufacturingAccountingEmptyState title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Scrap & Rework Costs"
      description="Scrap and rework cost register with recovery and net impact by production order."
      breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Scrap & Rework' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/manufacturing/scrap-rework"
      showDescription
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) }]} />}
    >
      <ManufacturingAccountingWorkspaceTabs active="scrap_rework" />
      <div className="space-y-3 p-4">
        <ManufacturingAccountingDemoBanner />
        <ManufacturingAccountingSummaryCards items={kpis} columns={4} />

        <div className="flex flex-wrap items-end gap-2 rounded-md border border-erp-border bg-white p-3">
          <div className="min-w-[200px] flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search PO, item, reason…" />
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
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">PO</th>
                <th className="px-3 py-2 font-semibold">Item</th>
                <th className="px-3 py-2 text-right font-semibold">Qty</th>
                <th className="px-3 py-2 text-right font-semibold">Cost</th>
                <th className="px-3 py-2 text-right font-semibold">Recovery</th>
                <th className="px-3 py-2 text-right font-semibold">Net Cost</th>
                <th className="px-3 py-2 font-semibold">Reason</th>
                <th className="px-3 py-2 font-semibold">Disposition</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-erp-border/80 hover:bg-erp-surface-alt/50">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.recordDate)}</td>
                  <td className="px-3 py-2"><ManufacturingGenericStatusBadge status={row.type} /></td>
                  <td className="px-3 py-2 font-medium">{row.productionOrderNumber}</td>
                  <td className="px-3 py-2">{row.itemName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.qty} {row.uom}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.costAmount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.recoveryAmount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(row.netCost)}</td>
                  <td className="px-3 py-2 text-erp-muted">{row.reason}</td>
                  <td className="px-3 py-2 text-erp-muted">{row.disposition}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && loadState !== 'loading' ? (
            <ManufacturingAccountingEmptyState title="No scrap or rework records match" />
          ) : null}
        </div>
      </div>
    </OperationalPageShell>
  )
}
