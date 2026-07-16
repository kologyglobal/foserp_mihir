import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calculator, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  ManufacturingAccountingDemoBanner,
  ManufacturingAccountingEmptyState,
  ManufacturingAccountingWorkspaceTabs,
  ProductionOrderStatusBadge,
} from '@/components/accounting/manufacturingAccounting'
import { getProductionCostingWorkbench } from '@/services/accounting/manufacturingAccountingService'
import type { CostingMethod, ProductionCostingWorkbench } from '@/types/manufacturingAccounting'
import { COSTING_METHODS, DEFAULT_MANUFACTURING_ACCOUNTING_FILTER } from '@/types/manufacturingAccounting'
import { useManufacturingAccountingPermissions } from '@/utils/permissions/manufacturingAccounting'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { MFG_ACCOUNTING_BREADCRUMB, selectCls, type LoadState } from './manufacturingAccountingUi'
import { cn } from '@/utils/cn'

const COST_BREAKUP_LABELS: Array<{ key: keyof ProductionCostingWorkbench['costBreakup']; label: string }> = [
  { key: 'rawMaterial', label: 'Raw Material' },
  { key: 'components', label: 'Components' },
  { key: 'directLabour', label: 'Direct Labour' },
  { key: 'machineCost', label: 'Machine Cost' },
  { key: 'subcontracting', label: 'Subcontracting' },
  { key: 'factoryOverhead', label: 'Factory Overhead' },
  { key: 'qualityCost', label: 'Quality Cost' },
  { key: 'scrapRecovery', label: 'Scrap Recovery' },
  { key: 'otherCost', label: 'Other Cost' },
]

export function ManufacturingProductionCostingPage() {
  const perms = useManufacturingAccountingPermissions()
  const [rows, setRows] = useState<ProductionCostingWorkbench[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [refreshToken, setRefreshToken] = useState(0)
  const [search, setSearch] = useState('')
  const [productionOrderId, setProductionOrderId] = useState('')
  const [itemCode, setItemCode] = useState('')
  const [plant, setPlant] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [costingMethod, setCostingMethod] = useState<CostingMethod | ''>('')
  const [costCentre, setCostCentre] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    try {
      const list = await getProductionCostingWorkbench({
        ...DEFAULT_MANUFACTURING_ACCOUNTING_FILTER,
        search,
        productionOrderId,
        itemCode,
        dateFrom,
        dateTo,
        costingMethod,
        costCentre: costCentre || plant,
      })
      if (signal?.cancelled) return
      setRows(list)
      setLoadState(list.length === 0 ? 'empty' : 'ready')
    } catch {
      if (signal?.cancelled) return
      setLoadState('error')
    }
  }, [search, productionOrderId, itemCode, plant, dateFrom, dateTo, costingMethod, costCentre])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => { signal.cancelled = true }
  }, [load, refreshToken])

  const poOptions = useMemo(() => [...new Map(rows.map((r) => [r.productionOrderId, r.productionOrderNumber])).entries()], [rows])
  const itemOptions = useMemo(() => [...new Set(rows.map((r) => r.finishedItemCode))].sort(), [rows])
  const plantOptions = useMemo(() => [...new Set(rows.map((r) => r.costCentre))].sort(), [rows])
  const costCentreOptions = useMemo(() => [...new Set(rows.map((r) => r.costCentre))].sort(), [rows])

  const selected = rows.find((r) => r.productionOrderId === selectedId) ?? rows[0] ?? null

  useEffect(() => {
    if (selected && !selectedId) setSelectedId(selected.productionOrderId)
  }, [selected, selectedId])

  const handleRecost = () => {
    notify.success('Production order recosted (demo).')
  }

  if (!perms.canRunCosting && !perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Production Costing" breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Production Costing' }]} autoBreadcrumbs={false}>
        <ManufacturingAccountingEmptyState title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Production Costing Workbench"
      description="Run and review production order cost breakup — standard vs actual per unit."
      breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Production Costing' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/manufacturing/production-costing"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={perms.canRunCosting ? { id: 'recost', label: 'Recost (demo)', icon: Calculator, variant: 'primary', onClick: handleRecost } : undefined}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) }]}
        />
      )}
    >
      <ManufacturingAccountingWorkspaceTabs active="production_costing" />
      <div className="space-y-3 p-4">
        <ManufacturingAccountingDemoBanner />

        <div className="flex flex-wrap items-end gap-2 rounded-md border border-erp-border bg-white p-3">
          <div className="min-w-[180px] flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search PO, item…" />
          </div>
          <label className="text-[11px] text-erp-muted">
            Production Order
            <select className={selectCls} value={productionOrderId} onChange={(e) => setProductionOrderId(e.target.value)}>
              <option value="">All</option>
              {poOptions.map(([id, num]) => <option key={id} value={id}>{num}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-erp-muted">
            Item
            <select className={selectCls} value={itemCode} onChange={(e) => setItemCode(e.target.value)}>
              <option value="">All</option>
              {itemOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-erp-muted">
            Plant
            <select className={selectCls} value={plant} onChange={(e) => setPlant(e.target.value)}>
              <option value="">All</option>
              {plantOptions.map((p) => <option key={p} value={p}>{p}</option>)}
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
          <label className="text-[11px] text-erp-muted">
            Costing Method
            <select className={selectCls} value={costingMethod} onChange={(e) => setCostingMethod(e.target.value as CostingMethod | '')}>
              <option value="">All</option>
              {COSTING_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-erp-muted">
            Cost Centre
            <select className={selectCls} value={costCentre} onChange={(e) => setCostCentre(e.target.value)}>
              <option value="">All</option>
              {costCentreOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>

        {loadState === 'loading' ? <LoadingState variant="dashboard" rows={6} /> : null}
        {loadState === 'error' ? <ManufacturingAccountingEmptyState title="Load failed" /> : null}

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-1">
            {rows.map((row) => (
              <button
                key={row.productionOrderId}
                type="button"
                onClick={() => setSelectedId(row.productionOrderId)}
                className={cn(
                  'w-full rounded-md border p-3 text-left transition',
                  selected?.productionOrderId === row.productionOrderId
                    ? 'border-erp-primary bg-erp-primary/5'
                    : 'border-erp-border bg-white hover:border-erp-primary/40',
                )}
              >
                <p className="text-[13px] font-semibold">{row.productionOrderNumber}</p>
                <p className="mt-0.5 text-[11px] text-erp-muted">{row.finishedItemName}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ProductionOrderStatusBadge status={row.status} />
                  <span className="text-[11px] text-erp-muted">{row.costingMethod}</span>
                </div>
                <p className="mt-1 text-[12px] font-semibold tabular-nums">{formatCurrency(row.costBreakup.totalProductionCost)}</p>
              </button>
            ))}
            {rows.length === 0 && loadState !== 'loading' ? (
              <ManufacturingAccountingEmptyState title="No production orders match" />
            ) : null}
          </div>

          <section className="rounded-md border border-erp-border bg-white p-4 lg:col-span-2">
            {selected ? (
              <>
                <header className="mb-4 border-b border-erp-border pb-3">
                  <h3 className="text-[14px] font-semibold">{selected.productionOrderNumber} — {selected.finishedItemName}</h3>
                  <p className="mt-1 text-[12px] text-erp-muted">
                    {selected.finishedItemCode} · {selected.costCentre} · Qty {selected.completedQty}/{selected.plannedQty}
                  </p>
                  <p className="mt-1 text-[11px] text-erp-muted">
                    Period {formatDate(selected.periodFrom)} – {formatDate(selected.periodTo)} · Last costed {formatDate(selected.lastCostedAt)} by {selected.costedBy}
                  </p>
                </header>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Cost Breakup</h4>
                    <table className="w-full text-[12px]">
                      <tbody>
                        {COST_BREAKUP_LABELS.map(({ key, label }) => (
                          <tr key={key} className="border-t border-erp-border/70">
                            <td className="py-1.5 text-erp-muted">{label}</td>
                            <td className="py-1.5 text-right tabular-nums">{formatCurrency(selected.costBreakup[key])}</td>
                          </tr>
                        ))}
                        <tr className="border-t border-erp-border font-semibold">
                          <td className="py-2">Total</td>
                          <td className="py-2 text-right tabular-nums">{formatCurrency(selected.costBreakup.totalProductionCost)}</td>
                        </tr>
                        <tr className="border-t border-erp-border font-semibold">
                          <td className="py-2">Cost per Unit</td>
                          <td className="py-2 text-right tabular-nums">{formatCurrency(selected.costBreakup.costPerUnit)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Std vs Actual</h4>
                    <table className="w-full text-[12px]">
                      <tbody>
                        <tr className="border-t border-erp-border/70">
                          <td className="py-1.5 text-erp-muted">Standard Cost / Unit</td>
                          <td className="py-1.5 text-right tabular-nums">{formatCurrency(selected.standardCostPerUnit)}</td>
                        </tr>
                        <tr className="border-t border-erp-border/70">
                          <td className="py-1.5 text-erp-muted">Actual Cost / Unit</td>
                          <td className="py-1.5 text-right tabular-nums">{formatCurrency(selected.actualCostPerUnit)}</td>
                        </tr>
                        <tr className="border-t border-erp-border font-semibold">
                          <td className="py-2">Variance Amount</td>
                          <td className={cn('py-2 text-right tabular-nums', selected.varianceAmount > 0 ? 'text-rose-700' : 'text-emerald-700')}>
                            {formatCurrency(selected.varianceAmount)}
                          </td>
                        </tr>
                        <tr className="border-t border-erp-border/70">
                          <td className="py-1.5 text-erp-muted">Variance %</td>
                          <td className="py-1.5 text-right tabular-nums">{selected.variancePercent.toFixed(2)}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-[13px] text-erp-muted">Select a production order from the list.</p>
            )}
          </section>
        </div>
      </div>
    </OperationalPageShell>
  )
}
