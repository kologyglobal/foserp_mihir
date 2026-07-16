import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layers, RefreshCw } from 'lucide-react'
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
import { getOverheadAllocations } from '@/services/accounting/manufacturingAccountingService'
import type { OverheadAllocationRow } from '@/types/manufacturingAccounting'
import { DEFAULT_MANUFACTURING_ACCOUNTING_FILTER } from '@/types/manufacturingAccounting'
import { useManufacturingAccountingPermissions } from '@/utils/permissions/manufacturingAccounting'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { notify } from '@/store/toastStore'
import { MFG_ACCOUNTING_BREADCRUMB, selectCls, type LoadState } from './manufacturingAccountingUi'

export function ManufacturingOverheadPage() {
  const perms = useManufacturingAccountingPermissions()
  const [rows, setRows] = useState<OverheadAllocationRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [refreshToken, setRefreshToken] = useState(0)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    try {
      const list = await getOverheadAllocations({
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
    allocated: rows.reduce((s, r) => s + r.allocatedAmount, 0),
    pool: rows.reduce((s, r) => s + r.totalOverhead, 0),
    posted: rows.filter((r) => r.status === 'Posted').length,
  }), [rows])

  const kpis: EnterpriseKpiItem[] = [
    { id: 'lines', label: 'Allocation Lines', value: summary.count, accent: 'blue' },
    { id: 'pool', label: 'Overhead Pool', value: formatCompactCurrency(summary.pool), accent: 'slate' },
    { id: 'alloc', label: 'Allocated Amount', value: formatCompactCurrency(summary.allocated), helper: formatCurrency(summary.allocated), accent: 'amber' },
    { id: 'posted', label: 'Posted', value: summary.posted, accent: 'green' },
  ]

  const handleAllocate = () => {
    notify.success('Overhead allocated to production orders (demo).')
  }

  if (!perms.canAllocateOverhead && !perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Overhead Allocation" breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Overhead Allocation' }]} autoBreadcrumbs={false}>
        <ManufacturingAccountingEmptyState title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Overhead Allocation"
      description="Factory overhead pools allocated to production orders by basis and cost centre."
      breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Overhead Allocation' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/manufacturing/overhead"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={perms.canAllocateOverhead ? { id: 'allocate', label: 'Allocate (demo)', icon: Layers, variant: 'primary', onClick: handleAllocate } : undefined}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) }]}
        />
      )}
    >
      <ManufacturingAccountingWorkspaceTabs active="overhead" />
      <div className="space-y-3 p-4">
        <ManufacturingAccountingDemoBanner />
        <ManufacturingAccountingSummaryCards items={kpis} columns={4} />

        <div className="flex flex-wrap items-end gap-2 rounded-md border border-erp-border bg-white p-3">
          <div className="min-w-[200px] flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search pool, period, PO, cost centre…" />
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
                <th className="px-3 py-2 font-semibold">Period</th>
                <th className="px-3 py-2 font-semibold">Overhead Pool</th>
                <th className="px-3 py-2 font-semibold">Basis</th>
                <th className="px-3 py-2 text-right font-semibold">Basis Qty</th>
                <th className="px-3 py-2 text-right font-semibold">Rate / Unit</th>
                <th className="px-3 py-2 text-right font-semibold">Pool Total</th>
                <th className="px-3 py-2 font-semibold">PO</th>
                <th className="px-3 py-2 text-right font-semibold">Allocated</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-erp-border/80 hover:bg-erp-surface-alt/50">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.allocationDate)}</td>
                  <td className="px-3 py-2">{row.period}</td>
                  <td className="px-3 py-2 font-medium">{row.overheadPool}</td>
                  <td className="px-3 py-2 text-erp-muted">{row.allocationBasis}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.basisQuantity}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.ratePerUnit)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.totalOverhead)}</td>
                  <td className="px-3 py-2">{row.productionOrderNumber ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(row.allocatedAmount)}</td>
                  <td className="px-3 py-2"><ManufacturingGenericStatusBadge status={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && loadState !== 'loading' ? (
            <ManufacturingAccountingEmptyState title="No overhead allocations match" />
          ) : null}
        </div>
      </div>
    </OperationalPageShell>
  )
}
