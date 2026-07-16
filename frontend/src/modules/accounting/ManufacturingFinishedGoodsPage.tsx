import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  FgPostingStatusBadge,
  ManufacturingAccountingDemoBanner,
  ManufacturingAccountingEmptyState,
  ManufacturingAccountingSummaryCards,
  ManufacturingAccountingWorkspaceTabs,
} from '@/components/accounting/manufacturingAccounting'
import { getFinishedGoodsValuation } from '@/services/accounting/manufacturingAccountingService'
import type { FinishedGoodsValuationRow } from '@/types/manufacturingAccounting'
import { DEFAULT_MANUFACTURING_ACCOUNTING_FILTER } from '@/types/manufacturingAccounting'
import { useManufacturingAccountingPermissions } from '@/utils/permissions/manufacturingAccounting'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { MFG_ACCOUNTING_BREADCRUMB, selectCls, type LoadState } from './manufacturingAccountingUi'
import { cn } from '@/utils/cn'

function fgVariance(row: FinishedGoodsValuationRow): number {
  return (row.actualCostPerUnit - row.standardCostPerUnit) * row.qty
}

export function ManufacturingFinishedGoodsPage() {
  const perms = useManufacturingAccountingPermissions()
  const [rows, setRows] = useState<FinishedGoodsValuationRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [refreshToken, setRefreshToken] = useState(0)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    try {
      const list = await getFinishedGoodsValuation({
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
    inventoryValue: rows.reduce((s, r) => s + r.totalValue, 0),
    variance: rows.reduce((s, r) => s + fgVariance(r), 0),
    qty: rows.reduce((s, r) => s + r.qty, 0),
  }), [rows])

  const kpis: EnterpriseKpiItem[] = [
    { id: 'receipts', label: 'FG Receipts', value: summary.count, accent: 'blue' },
    { id: 'qty', label: 'Total Qty Produced', value: summary.qty, accent: 'slate' },
    { id: 'inv', label: 'Inventory Value', value: formatCompactCurrency(summary.inventoryValue), helper: formatCurrency(summary.inventoryValue), accent: 'green' },
    { id: 'var', label: 'Total Variance', value: formatCompactCurrency(Math.abs(summary.variance)), helper: formatCurrency(summary.variance), accent: summary.variance > 0 ? 'red' : 'green' },
  ]

  if (!perms.canViewFg) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Finished Goods" breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Finished Goods' }]} autoBreadcrumbs={false}>
        <ManufacturingAccountingEmptyState title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Finished Goods Valuation"
      description="FG receipts with standard vs actual cost and inventory valuation."
      breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Finished Goods' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/manufacturing/finished-goods"
      showDescription
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) }]} />}
    >
      <ManufacturingAccountingWorkspaceTabs active="finished_goods" />
      <div className="space-y-3 p-4">
        <ManufacturingAccountingDemoBanner />
        <ManufacturingAccountingSummaryCards items={kpis} columns={4} />

        <div className="flex flex-wrap items-end gap-2 rounded-md border border-erp-border bg-white p-3">
          <div className="min-w-[200px] flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search PO, item, GRN, warehouse…" />
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
                <th className="px-3 py-2 font-semibold">Item</th>
                <th className="px-3 py-2 font-semibold">PO</th>
                <th className="px-3 py-2 text-right font-semibold">Qty Produced</th>
                <th className="px-3 py-2 text-right font-semibold">Standard Cost</th>
                <th className="px-3 py-2 text-right font-semibold">Actual Cost</th>
                <th className="px-3 py-2 text-right font-semibold">Cost / Unit (Act)</th>
                <th className="px-3 py-2 text-right font-semibold">Inventory Value</th>
                <th className="px-3 py-2 text-right font-semibold">Variance</th>
                <th className="px-3 py-2 font-semibold">Posting Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const variance = fgVariance(row)
                return (
                  <tr key={row.id} className="border-t border-erp-border/80 hover:bg-erp-surface-alt/50">
                    <td className="px-3 py-2">
                      <span className="font-medium">{row.itemName}</span>
                      <span className="ml-1 text-erp-muted">({row.itemCode})</span>
                    </td>
                    <td className="px-3 py-2 font-medium">{row.productionOrderNumber}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.qty} {row.uom}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.standardCostPerUnit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.actualCostPerUnit * row.qty)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.actualCostPerUnit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(row.totalValue)}</td>
                    <td className={cn('px-3 py-2 text-right tabular-nums font-semibold', variance > 0 ? 'text-rose-700' : variance < 0 ? 'text-emerald-700' : '')}>
                      {formatCurrency(variance)}
                    </td>
                    <td className="px-3 py-2"><FgPostingStatusBadge status={row.postingStatus} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 && loadState !== 'loading' ? (
            <ManufacturingAccountingEmptyState title="No FG receipts match" description="Adjust filters to see finished goods valuation." />
          ) : null}
        </div>
      </div>
    </OperationalPageShell>
  )
}
