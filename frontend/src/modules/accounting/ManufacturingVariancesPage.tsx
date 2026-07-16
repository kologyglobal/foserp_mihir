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
  VarianceTypeBadge,
} from '@/components/accounting/manufacturingAccounting'
import { getProductionVariances } from '@/services/accounting/manufacturingAccountingService'
import type { ProductionVarianceRow, VarianceType } from '@/types/manufacturingAccounting'
import { DEFAULT_MANUFACTURING_ACCOUNTING_FILTER, VARIANCE_TYPES } from '@/types/manufacturingAccounting'
import { useManufacturingAccountingPermissions } from '@/utils/permissions/manufacturingAccounting'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { MFG_ACCOUNTING_BREADCRUMB, selectCls, type LoadState } from './manufacturingAccountingUi'
import { cn } from '@/utils/cn'

export function ManufacturingVariancesPage() {
  const perms = useManufacturingAccountingPermissions()
  const [rows, setRows] = useState<ProductionVarianceRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [refreshToken, setRefreshToken] = useState(0)
  const [search, setSearch] = useState('')
  const [varianceType, setVarianceType] = useState<VarianceType | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    try {
      const list = await getProductionVariances({
        ...DEFAULT_MANUFACTURING_ACCOUNTING_FILTER,
        search,
        varianceType,
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
  }, [search, varianceType, dateFrom, dateTo])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => { signal.cancelled = true }
  }, [load, refreshToken])

  const summary = useMemo(() => {
    const adverse = rows.filter((r) => !r.isFavourable).reduce((s, r) => s + Math.abs(r.varianceAmount), 0)
    const favourable = rows.filter((r) => r.isFavourable).reduce((s, r) => s + Math.abs(r.varianceAmount), 0)
    const posted = rows.filter((r) => r.posted).length
    return { count: rows.length, adverse, favourable, posted }
  }, [rows])

  const kpis: EnterpriseKpiItem[] = [
    { id: 'lines', label: 'Variance Lines', value: summary.count, accent: 'blue' },
    { id: 'adv', label: 'Adverse Total', value: formatCompactCurrency(summary.adverse), helper: formatCurrency(summary.adverse), accent: 'red' },
    { id: 'fav', label: 'Favourable Total', value: formatCompactCurrency(summary.favourable), accent: 'green' },
    { id: 'posted', label: 'Posted', value: summary.posted, accent: 'slate' },
  ]

  if (!perms.canViewVariances) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Production Variances" breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Variances' }]} autoBreadcrumbs={false}>
        <ManufacturingAccountingEmptyState title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Production Variances"
      description="Standard vs actual variances by type — material, labour, machine, overhead and more."
      breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Variances' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/manufacturing/variances"
      showDescription
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) }]} />}
    >
      <ManufacturingAccountingWorkspaceTabs active="variances" />
      <div className="space-y-3 p-4">
        <ManufacturingAccountingDemoBanner />
        <ManufacturingAccountingSummaryCards items={kpis} columns={4} />

        <div className="flex flex-wrap items-end gap-2 rounded-md border border-erp-border bg-white p-3">
          <div className="min-w-[200px] flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search PO, item, narration…" />
          </div>
          <label className="text-[11px] text-erp-muted">
            Variance Type
            <select className={selectCls} value={varianceType} onChange={(e) => setVarianceType(e.target.value as VarianceType | '')}>
              <option value="">All</option>
              {VARIANCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
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
                <th className="px-3 py-2 font-semibold">Item</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 text-right font-semibold">Standard</th>
                <th className="px-3 py-2 text-right font-semibold">Actual</th>
                <th className="px-3 py-2 text-right font-semibold">Variance</th>
                <th className="px-3 py-2 font-semibold">Fav / Adv</th>
                <th className="px-3 py-2 font-semibold">Posted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-erp-border/80 hover:bg-erp-surface-alt/50">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.varianceDate)}</td>
                  <td className="px-3 py-2 font-medium">{row.productionOrderNumber}</td>
                  <td className="px-3 py-2">{row.finishedItemName}</td>
                  <td className="px-3 py-2"><VarianceTypeBadge type={row.varianceType} /></td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.standardAmount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.actualAmount)}</td>
                  <td className={cn('px-3 py-2 text-right tabular-nums font-semibold', row.isFavourable ? 'text-emerald-700' : 'text-rose-700')}>
                    {formatCurrency(row.varianceAmount)}
                  </td>
                  <td className="px-3 py-2 text-erp-muted">{row.isFavourable ? 'Favourable' : 'Adverse'}</td>
                  <td className="px-3 py-2">{row.posted ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && loadState !== 'loading' ? (
            <ManufacturingAccountingEmptyState title="No variances match" description="Adjust filters to see production variances." />
          ) : null}
        </div>
      </div>
    </OperationalPageShell>
  )
}
