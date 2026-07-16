import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  ManufacturingAccountingDemoBanner,
  ManufacturingAccountingEmptyState,
  ManufacturingAccountingWorkspaceTabs,
  ManufacturingGenericStatusBadge,
} from '@/components/accounting/manufacturingAccounting'
import { getProductCostSheets } from '@/services/accounting/manufacturingAccountingService'
import type { ProductCostSheet } from '@/types/manufacturingAccounting'
import { DEFAULT_MANUFACTURING_ACCOUNTING_FILTER } from '@/types/manufacturingAccounting'
import { useManufacturingAccountingPermissions } from '@/utils/permissions/manufacturingAccounting'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { MFG_ACCOUNTING_BREADCRUMB, type LoadState } from './manufacturingAccountingUi'
import { cn } from '@/utils/cn'

export function ManufacturingProductCostSheetPage() {
  const perms = useManufacturingAccountingPermissions()
  const [rows, setRows] = useState<ProductCostSheet[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [refreshToken, setRefreshToken] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bomExpanded, setBomExpanded] = useState(true)
  const [routingExpanded, setRoutingExpanded] = useState(true)

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    try {
      const list = await getProductCostSheets({
        ...DEFAULT_MANUFACTURING_ACCOUNTING_FILTER,
        search,
      })
      if (signal?.cancelled) return
      setRows(list)
      setLoadState(list.length === 0 ? 'empty' : 'ready')
    } catch {
      if (signal?.cancelled) return
      setLoadState('error')
    }
  }, [search])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => { signal.cancelled = true }
  }, [load, refreshToken])

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null

  useEffect(() => {
    if (selected && !selectedId) setSelectedId(selected.id)
  }, [selected, selectedId])

  const costSummary = useMemo(() => {
    if (!selected) return null
    return [
      { label: 'BOM Material Cost', value: selected.bomMaterialCost },
      { label: 'Routing Labour', value: selected.routingLabourCost },
      { label: 'Routing Machine', value: selected.routingMachineCost },
      { label: 'Subcontracting', value: selected.subcontractCost },
      { label: 'Variable Overhead', value: selected.variableOverhead },
      { label: 'Fixed Overhead', value: selected.fixedOverhead },
      { label: 'Packing', value: selected.packingCost },
      { label: 'Total Standard Cost', value: selected.totalStandardCost, bold: true },
      { label: 'Suggested Selling Price', value: selected.suggestedSellingPrice, bold: true },
    ]
  }, [selected])

  const handleEdit = () => {
    notify.info('Cost sheet editing is not available in demo mode.')
  }

  if (!perms.canViewCostSheet) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Product Cost Sheet" breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Product Cost Sheet' }]} autoBreadcrumbs={false}>
        <ManufacturingAccountingEmptyState title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Product Cost Sheet"
      description="Bill of materials and routing based standard cost sheets with selling price."
      breadcrumbs={[...MFG_ACCOUNTING_BREADCRUMB, { label: 'Product Cost Sheet' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/manufacturing/cost-sheet"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={perms.canManageCostSheet ? { id: 'edit', label: 'Edit (demo)', icon: Pencil, variant: 'primary', onClick: handleEdit } : undefined}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) }]}
        />
      )}
    >
      <ManufacturingAccountingWorkspaceTabs active="cost_sheet" />
      <div className="space-y-3 p-4">
        <ManufacturingAccountingDemoBanner />

        <div className="rounded-md border border-erp-border bg-white p-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search item code, name, revision…" />
        </div>

        {loadState === 'loading' ? <LoadingState variant="dashboard" rows={6} /> : null}
        {loadState === 'error' ? <ManufacturingAccountingEmptyState title="Load failed" /> : null}

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-1">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedId(row.id)}
                className={cn(
                  'w-full rounded-md border p-3 text-left transition',
                  selected?.id === row.id ? 'border-erp-primary bg-erp-primary/5' : 'border-erp-border bg-white hover:border-erp-primary/40',
                )}
              >
                <p className="text-[13px] font-semibold">{row.itemName}</p>
                <p className="mt-0.5 text-[11px] text-erp-muted">{row.itemCode} · Rev {row.revision}</p>
                <div className="mt-2 flex items-center gap-2">
                  <ManufacturingGenericStatusBadge status={row.status} />
                  <span className="text-[11px] text-erp-muted">{row.costingMethod}</span>
                </div>
                <p className="mt-1 text-[12px] font-semibold tabular-nums">{formatCurrency(row.totalStandardCost)}</p>
              </button>
            ))}
            {rows.length === 0 && loadState !== 'loading' ? (
              <ManufacturingAccountingEmptyState title="No cost sheets match" />
            ) : null}
          </div>

          <section className="rounded-md border border-erp-border bg-white p-4 lg:col-span-2">
            {selected && costSummary ? (
              <>
                <header className="mb-4 border-b border-erp-border pb-3">
                  <h3 className="text-[14px] font-semibold">{selected.itemName}</h3>
                  <p className="mt-1 text-[12px] text-erp-muted">
                    {selected.itemCode} · Revision {selected.revision} · Effective {formatDate(selected.effectiveFrom)}
                  </p>
                  <p className="mt-1 text-[11px] text-erp-muted">
                    Updated {formatDate(selected.lastUpdated)} by {selected.updatedBy} · Margin {selected.marginPercent}%
                  </p>
                </header>

                <div className="mb-4">
                  <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Cost Summary</h4>
                  <table className="w-full text-[12px]">
                    <tbody>
                      {costSummary.map((line) => (
                        <tr key={line.label} className={cn('border-t border-erp-border/70', line.bold && 'font-semibold')}>
                          <td className="py-1.5 text-erp-muted">{line.label}</td>
                          <td className="py-1.5 text-right tabular-nums">{formatCurrency(line.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mb-4">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 border-b border-erp-border py-2 text-left text-[12px] font-semibold"
                    onClick={() => setBomExpanded((v) => !v)}
                  >
                    {bomExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    BOM Lines ({selected.bomLines.length})
                  </button>
                  {bomExpanded ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-[11px]">
                        <thead className="bg-erp-surface text-[10px] uppercase text-erp-muted">
                          <tr>
                            <th className="px-2 py-1 text-left">Material</th>
                            <th className="px-2 py-1 text-right">Qty</th>
                            <th className="px-2 py-1 text-right">Rate</th>
                            <th className="px-2 py-1 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.bomLines.map((line) => (
                            <tr key={line.id} className="border-t border-erp-border/70">
                              <td className="px-2 py-1">{line.materialName} ({line.materialCode})</td>
                              <td className="px-2 py-1 text-right tabular-nums">{line.qty} {line.uom}</td>
                              <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(line.rate)}</td>
                              <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(line.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>

                <div>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 border-b border-erp-border py-2 text-left text-[12px] font-semibold"
                    onClick={() => setRoutingExpanded((v) => !v)}
                  >
                    {routingExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Routing Lines ({selected.routingLines.length})
                  </button>
                  {routingExpanded ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-[11px]">
                        <thead className="bg-erp-surface text-[10px] uppercase text-erp-muted">
                          <tr>
                            <th className="px-2 py-1 text-left">Operation</th>
                            <th className="px-2 py-1 text-left">Work Centre</th>
                            <th className="px-2 py-1 text-right">Labour Hrs</th>
                            <th className="px-2 py-1 text-right">Machine Hrs</th>
                            <th className="px-2 py-1 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.routingLines.map((line) => (
                            <tr key={line.id} className="border-t border-erp-border/70">
                              <td className="px-2 py-1">{line.operation}</td>
                              <td className="px-2 py-1">{line.workCentre}</td>
                              <td className="px-2 py-1 text-right tabular-nums">{line.labourHours} @ {formatCurrency(line.labourRate)}</td>
                              <td className="px-2 py-1 text-right tabular-nums">{line.machineHours} @ {formatCurrency(line.machineRate)}</td>
                              <td className="px-2 py-1 text-right tabular-nums">{formatCurrency(line.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-[13px] text-erp-muted">Select a cost sheet from the list.</p>
            )}
          </section>
        </div>
      </div>
    </OperationalPageShell>
  )
}
