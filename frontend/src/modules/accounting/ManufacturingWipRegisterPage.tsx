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
  ProductionOrderStatusBadge,
  WipStatusBadge,
} from '@/components/accounting/manufacturingAccounting'
import { getWorkInProgress } from '@/services/accounting/manufacturingAccountingService'
import type { ProductionOrderStatus, WIPStatus, WorkInProgressRow } from '@/types/manufacturingAccounting'
import { DEFAULT_MANUFACTURING_ACCOUNTING_FILTER, PRODUCTION_ORDER_STATUSES } from '@/types/manufacturingAccounting'
import { useManufacturingAccountingPermissions } from '@/utils/permissions/manufacturingAccounting'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { MFG_ACCOUNTING_BREADCRUMB, selectCls, type LoadState } from './manufacturingAccountingUi'

const WIP_STATUSES: WIPStatus[] = ['Open', 'Partially Absorbed', 'Ready for FG', 'Closed', 'Written Off']

export function ManufacturingWipRegisterPage() {
  const perms = useManufacturingAccountingPermissions()
  const [rows, setRows] = useState<WorkInProgressRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [refreshToken, setRefreshToken] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ProductionOrderStatus | ''>('')
  const [wipStatus, setWipStatus] = useState<WIPStatus | ''>('')

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    try {
      const list = await getWorkInProgress({
        ...DEFAULT_MANUFACTURING_ACCOUNTING_FILTER,
        search,
        status,
        wipStatus,
      })
      if (signal?.cancelled) return
      setRows(list)
      setLoadState(list.length === 0 ? 'empty' : 'ready')
    } catch {
      if (signal?.cancelled) return
      setLoadState('error')
    }
  }, [search, status, wipStatus])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => { signal.cancelled = true }
  }, [load, refreshToken])

  const summary = useMemo(() => ({
    count: rows.length,
    wipValue: rows.reduce((s, r) => s + r.wipValue, 0),
    material: rows.reduce((s, r) => s + r.materialIssued, 0),
    labour: rows.reduce((s, r) => s + r.labourCost, 0),
    machine: rows.reduce((s, r) => s + r.machineCost, 0),
    overhead: rows.reduce((s, r) => s + r.overheadCost, 0),
  }), [rows])

  const kpis: EnterpriseKpiItem[] = [
    { id: 'orders', label: 'Open WIP Orders', value: summary.count, accent: 'blue' },
    { id: 'wip', label: 'Total WIP Value', value: formatCompactCurrency(summary.wipValue), helper: formatCurrency(summary.wipValue), accent: 'amber' },
    { id: 'mat', label: 'Material Issued', value: formatCompactCurrency(summary.material), accent: 'slate' },
    { id: 'lab', label: 'Labour Booked', value: formatCompactCurrency(summary.labour), accent: 'blue' },
    { id: 'mch', label: 'Machine Cost', value: formatCompactCurrency(summary.machine), accent: 'amber' },
    { id: 'oh', label: 'Overhead', value: formatCompactCurrency(summary.overhead), accent: 'slate' },
  ]

  if (!perms.canViewWip) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Work in Progress" breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Work in Progress' }]} autoBreadcrumbs={false}>
        <ManufacturingAccountingEmptyState title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Work in Progress Register"
      description="Production orders with absorbed material, labour, machine and overhead costs."
      breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Work in Progress' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/manufacturing/wip"
      showDescription
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) }]} />}
    >
      <ManufacturingAccountingWorkspaceTabs active="wip" />
      <div className="space-y-3 p-4">
        <ManufacturingAccountingDemoBanner />
        <ManufacturingAccountingSummaryCards items={kpis} columns={6} />

        <div className="flex flex-wrap items-end gap-2 rounded-md border border-erp-border bg-white p-3">
          <div className="min-w-[200px] flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search PO, item, cost centre…" />
          </div>
          <label className="text-[11px] text-erp-muted">
            Production Status
            <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as ProductionOrderStatus | '')}>
              <option value="">All</option>
              {PRODUCTION_ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-erp-muted">
            WIP Status
            <select className={selectCls} value={wipStatus} onChange={(e) => setWipStatus(e.target.value as WIPStatus | '')}>
              <option value="">All</option>
              {WIP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>

        {loadState === 'loading' ? <LoadingState variant="table" rows={10} /> : null}
        {loadState === 'error' ? <ManufacturingAccountingEmptyState title="Load failed" /> : null}

        <div className="overflow-x-auto rounded-md border border-erp-border bg-white">
          <table className="min-w-full text-left text-[12px]">
            <thead className="sticky top-0 z-[1] bg-erp-surface text-[11px] uppercase tracking-wide text-erp-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">PO</th>
                <th className="px-3 py-2 font-semibold">Finished Item</th>
                <th className="px-3 py-2 text-right font-semibold">Planned Qty</th>
                <th className="px-3 py-2 text-right font-semibold">Completed Qty</th>
                <th className="px-3 py-2 text-right font-semibold">Material Issued</th>
                <th className="px-3 py-2 text-right font-semibold">Labour Booked</th>
                <th className="px-3 py-2 text-right font-semibold">Machine Cost</th>
                <th className="px-3 py-2 text-right font-semibold">Overhead</th>
                <th className="px-3 py-2 text-right font-semibold">WIP Value</th>
                <th className="px-3 py-2 font-semibold">Production Status</th>
                <th className="px-3 py-2 font-semibold">WIP Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-erp-border/80 hover:bg-erp-surface-alt/50">
                  <td className="px-3 py-2 font-medium">{row.productionOrderNumber}</td>
                  <td className="px-3 py-2">{row.finishedItemName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.plannedQty}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.completedQty}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.materialIssued)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.labourCost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.machineCost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.overheadCost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(row.wipValue)}</td>
                  <td className="px-3 py-2"><ProductionOrderStatusBadge status={row.status} /></td>
                  <td className="px-3 py-2"><WipStatusBadge status={row.wipStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && loadState !== 'loading' ? (
            <ManufacturingAccountingEmptyState title="No WIP orders match" description="Adjust filters to see work in progress." />
          ) : null}
        </div>
      </div>
    </OperationalPageShell>
  )
}
