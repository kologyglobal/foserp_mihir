/**
 * Inventory Costing — Overview hub (API-backed; demo seed when offline).
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Calculator, ChevronRight, RefreshCw } from 'lucide-react'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { Button } from '@/design-system/components/Button'
import { isApiMode } from '@/config/apiConfig'
import {
  fetchCostingOverview,
  fetchValuationItems,
  type CostingOverviewDto,
} from '@/services/api/inventoryCostingApi'
import { formatCurrency } from '@/utils/formatters/currency'
import { InventoryCostingShell } from './InventoryCostingShell'
import { COSTING_SUBNAV, inventoryCostingPaths } from './inventoryCostingPaths'
import { DEMO_RECON, methodLabel } from './costingDemoData'
import { cn } from '@/utils/cn'

type ValuationItemRow = {
  itemId: string
  warehouseId: string
  itemCode: string
  itemName: string
  category: string | null
  uom: string | null
  warehouseCode: string
  warehouseName: string
  valuationMethod: string
  onHandQty: number
  inventoryValue: number
  currentUnitCost: number
  unitCostLabel: string
  costStatus: string
  lastCostMovement: { postingDate: string; entryType: string } | null
}

export function InventoryCostingSummaryPage() {
  const api = isApiMode()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<CostingOverviewDto | null>(null)
  const [items, setItems] = useState<ValuationItemRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!api) {
        setOverview({
          valuationMethod: DEMO_RECON.valuationMethod,
          methodSource: 'DEMO',
          methodDescription: 'Demo seed — switch to API mode for live valuation.',
          effectiveDate: new Date().toISOString().slice(0, 10),
          summary: {
            inventoryValue: 284500,
            stockQuantity: 14825,
            uncostedMovements: 0,
            unreconciledValue: 0,
            glDifference: null,
            openLayers: 2,
            openLayerValue: 120000,
            costEntryCount: 4,
            reconMismatches: DEMO_RECON.mismatched,
          },
          policy: {
            scope: 'DEMO',
            effectiveFrom: new Date().toISOString().slice(0, 10),
            lastChangedBy: null,
            lastChangedAt: null,
            lastFrom: null,
            lastTo: null,
          },
          attention: [],
          accounting: { enabled: false, note: 'Demo mode' },
          manufacturing: { note: 'Open Manufacturing for WO costing', openPath: '/manufacturing' },
        })
        setItems([])
        return
      }
      const [ov, val] = await Promise.all([
        fetchCostingOverview(),
        fetchValuationItems({ limit: 50 }),
      ])
      setOverview(ov.data)
      setItems(val.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load costing overview')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  const s = overview?.summary

  return (
    <InventoryCostingShell
      title="Inventory Costing"
      description="Review inventory value, costing history, valuation layers and reconciliation."
      favoritePath={inventoryCostingPaths.summary}
      panel={false}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {loading ? (
        <div className="rounded-md border border-erp-border bg-white p-4 shadow-sm">
          <LoadingState variant="card" />
        </div>
      ) : null}
      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-3 text-[13px] text-rose-700">{error}</p>
      ) : null}

      {!loading && !error && overview ? (
        <div className="flex flex-col gap-3">
          {/* Compact summary strip */}
          <div className="grid gap-0 overflow-hidden rounded-md border border-erp-border bg-white shadow-sm sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: 'Inventory Value', value: formatCurrency(s?.inventoryValue ?? 0) },
              { label: 'Stock Quantity', value: Number(s?.stockQuantity ?? 0).toLocaleString() },
              {
                label: 'Uncosted Movements',
                value: String(s?.uncostedMovements ?? 0),
                warn: (s?.uncostedMovements ?? 0) > 0,
              },
              {
                label: 'Unreconciled Value',
                value: formatCurrency(s?.unreconciledValue ?? 0),
                warn: (s?.unreconciledValue ?? 0) > 0,
              },
              {
                label: 'GL Difference',
                value: s?.glDifference == null ? 'N/A' : formatCurrency(s.glDifference),
              },
            ].map((card, i) => (
              <div
                key={card.label}
                className={cn('px-4 py-3', i > 0 && 'border-t border-erp-border sm:border-t-0 sm:border-l')}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{card.label}</p>
                <p className={cn('mt-1 text-lg font-semibold tabular-nums', card.warn && 'text-rose-700')}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {/* Policy panel */}
            <section className="rounded-md border border-erp-border bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <Calculator className="h-4 w-4 text-erp-primary" aria-hidden />
                <h2 className="text-sm font-semibold">Current valuation method</h2>
                <DynamicsStatusChip label={methodLabel(String(overview.valuationMethod))} tone="info" />
              </div>
              <p className="text-[13px] text-erp-text">{overview.methodDescription}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                <div>
                  <dt className="text-erp-muted">Scope</dt>
                  <dd className="font-medium">{overview.policy.scope.replace(/_/g, ' ')}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Effective</dt>
                  <dd className="font-medium">{overview.policy.effectiveFrom}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Last change</dt>
                  <dd className="font-medium">
                    {overview.policy.lastChangedAt
                      ? `${overview.policy.lastFrom ?? '—'} → ${overview.policy.lastTo ?? '—'}`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Source</dt>
                  <dd className="font-medium">{overview.methodSource.replace(/_/g, ' ')}</dd>
                </div>
              </dl>
              <div className="mt-3">
                <Link to={inventoryCostingPaths.methodChange}>
                  <Button size="sm" variant="secondary">
                    Review Method Change
                  </Button>
                </Link>
              </div>
            </section>

            {/* Health */}
            <section className="rounded-md border border-erp-border bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold">Costing health</h2>
              {overview.attention.length === 0 ? (
                <p className="text-[13px] text-emerald-800">No attention items for the current scope.</p>
              ) : (
                <>
                  <p className="mb-2 text-[13px] font-medium text-amber-900">
                    {overview.attention.length} item(s) require attention
                  </p>
                  <ul className="space-y-1.5 text-[12px] text-amber-950">
                    {overview.attention.map((a) => (
                      <li key={a.code} className="flex items-start gap-1.5">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        {a.message}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to={inventoryCostingPaths.reconciliation}>
                  <Button size="sm" variant="secondary">
                    Review Issues
                  </Button>
                </Link>
                <Link to={inventoryCostingPaths.entries}>
                  <Button size="sm" variant="secondary">
                    Cost Entries
                  </Button>
                </Link>
              </div>
              <p className="mt-3 text-[11px] text-erp-muted">{overview.accounting.note}</p>
              <p className="mt-1 text-[11px] text-erp-muted">
                {overview.manufacturing.note}{' '}
                <Link to="/manufacturing" className="font-semibold text-erp-primary hover:underline">
                  Open Manufacturing →
                </Link>
              </p>
            </section>
          </div>

          {/* Valuation by item */}
          <section className="overflow-hidden rounded-md border border-erp-border bg-white shadow-sm">
            <div className="border-b border-erp-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
              Valuation by item
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-6 text-[13px] text-erp-muted">
                {api ? 'No stock balances with value in this tenant yet.' : 'Demo mode — valuation table available in API mode.'}
              </p>
            ) : (
              <div className="erp-table-wrap overflow-x-auto">
                <table className="erp-table w-full min-w-[960px] text-left text-[12px]">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Method</th>
                      <th className="text-right">On-hand</th>
                      <th>UOM</th>
                      <th className="text-right">Unit cost</th>
                      <th className="text-right">Value</th>
                      <th>Warehouse</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r) => (
                      <tr key={`${r.itemId}:${r.warehouseId}`}>
                        <td className="font-medium">
                          {r.itemCode} — {r.itemName}
                        </td>
                        <td>{r.category ?? '—'}</td>
                        <td>{methodLabel(r.valuationMethod)}</td>
                        <td className="text-right tabular-nums">{r.onHandQty.toLocaleString()}</td>
                        <td>{r.uom ?? '—'}</td>
                        <td className="text-right tabular-nums">
                          {r.unitCostLabel === 'Layered' || r.unitCostLabel.startsWith('Specific')
                            ? r.unitCostLabel
                            : formatCurrency(r.currentUnitCost)}
                        </td>
                        <td className="text-right font-semibold tabular-nums">
                          {formatCurrency(r.inventoryValue)}
                        </td>
                        <td>
                          {r.warehouseCode} · {r.warehouseName}
                        </td>
                        <td>
                          <DynamicsStatusChip
                            label={r.costStatus}
                            tone={
                              r.costStatus === 'Costed'
                                ? 'success'
                                : r.costStatus === 'Uncosted' || r.costStatus === 'Balance only'
                                  ? 'warning'
                                  : 'neutral'
                            }
                          />
                        </td>
                        <td className="text-right">
                          <Link
                            to={inventoryCostingPaths.forItem(r.itemId)}
                            className="font-semibold text-erp-primary hover:underline"
                          >
                            Entries
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-md border border-erp-border bg-white shadow-sm">
            <div className="border-b border-erp-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
              Costing workspace
            </div>
            <ul className="divide-y divide-erp-border/70">
              {COSTING_SUBNAV.filter((t) => t.path !== inventoryCostingPaths.summary).map((t) => (
                <li key={t.path}>
                  <Link
                    to={t.path}
                    className="flex items-center justify-between px-4 py-2.5 text-[13px] hover:bg-erp-surface/50"
                  >
                    <span className="font-medium">{t.label}</span>
                    <ChevronRight className="h-4 w-4 text-erp-primary" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </InventoryCostingShell>
  )
}
