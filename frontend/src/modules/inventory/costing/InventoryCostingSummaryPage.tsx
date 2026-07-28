/**
 * Inventory Costing — Valuation Summary hub.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, ChevronRight, RefreshCw } from 'lucide-react'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { isApiMode } from '@/config/apiConfig'
import { getInventorySetupApi } from '@/services/api/inventorySetupApi'
import {
  fetchInventoryCostEntries,
  fetchInventoryCostLayers,
  fetchValuationReconciliation,
} from '@/services/api/inventoryCostingApi'
import { formatCurrency } from '@/utils/formatters/currency'
import { InventoryCostingShell } from './InventoryCostingShell'
import { COSTING_SUBNAV, inventoryCostingPaths } from './inventoryCostingPaths'
import { DEMO_COST_ENTRIES, DEMO_COST_LAYERS, DEMO_RECON, methodLabel } from './costingDemoData'
import { cn } from '@/utils/cn'

export function InventoryCostingSummaryPage() {
  const api = isApiMode()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [method, setMethod] = useState('FIFO')
  const [entryCount, setEntryCount] = useState(0)
  const [openLayers, setOpenLayers] = useState(0)
  const [mismatched, setMismatched] = useState(0)
  const [layerValue, setLayerValue] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!api) {
        setMethod(DEMO_RECON.valuationMethod)
        setEntryCount(DEMO_COST_ENTRIES.length)
        setOpenLayers(DEMO_COST_LAYERS.filter((l) => l.status === 'OPEN').length)
        setMismatched(DEMO_RECON.mismatched)
        setLayerValue(DEMO_COST_LAYERS.reduce((s, l) => s + Number(l.remainingValue), 0))
        return
      }
      const [setup, entries, layers, recon] = await Promise.all([
        getInventorySetupApi().catch(() => null),
        fetchInventoryCostEntries({ limit: 1 }),
        fetchInventoryCostLayers({ openOnly: true, limit: 100 }),
        fetchValuationReconciliation({ mismatchesOnly: true }),
      ])
      const m = setup?.data?.general?.defaultCostingMethod
      setMethod(
        m === 'fifo'
          ? 'FIFO'
          : m === 'average'
            ? 'MOVING_WEIGHTED_AVERAGE'
            : m === 'standard'
              ? 'STANDARD_COST'
              : m === 'specific'
                ? 'SPECIFIC_IDENTIFICATION'
                : String(m ?? 'FIFO').toUpperCase(),
      )
      setEntryCount(entries.meta?.total ?? entries.data?.length ?? 0)
      const open = layers.data ?? []
      setOpenLayers(open.length)
      setLayerValue(open.reduce((s, l) => s + Number(l.remainingValue || 0), 0))
      setMismatched(recon.data?.mismatched ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load valuation summary')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <InventoryCostingShell
      title="Valuation Summary"
      favoritePath={inventoryCostingPaths.summary}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-erp-border bg-erp-surface/40 px-3 py-2.5 text-[13px]">
        <Calculator className="h-4 w-4 text-erp-primary" aria-hidden />
        <span className="font-semibold text-erp-text">Active method</span>
        <DynamicsStatusChip label={methodLabel(method)} tone="info" />
        {!api ? <span className="text-erp-muted">· Demo seed</span> : null}
        {api ? (
          <span className="text-erp-muted">
            · Live inventory valuation posture
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="p-4">
          <LoadingState variant="card" />
        </div>
      ) : null}
      {error ? <p className="px-3 py-3 text-[13px] text-rose-700">{error}</p> : null}

      {!loading && !error ? (
        <>
          <div className="grid gap-0 border-b border-erp-border sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Cost entries', value: String(entryCount), to: inventoryCostingPaths.entries },
              { label: 'Open FIFO layers', value: String(openLayers), to: inventoryCostingPaths.layers },
              { label: 'Open layer value', value: formatCurrency(layerValue), to: inventoryCostingPaths.layers },
              {
                label: 'Recon mismatches',
                value: String(mismatched),
                to: inventoryCostingPaths.reconciliation,
                warn: mismatched > 0,
              },
            ].map((card, i) => (
              <Link
                key={card.label}
                to={card.to}
                className={cn(
                  'px-4 py-3 hover:bg-erp-surface/50',
                  i > 0 && 'border-t border-erp-border sm:border-t-0 sm:border-l',
                )}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{card.label}</p>
                <p className={cn('mt-1 text-xl font-semibold tabular-nums', card.warn && 'text-rose-700')}>
                  {card.value}
                </p>
              </Link>
            ))}
          </div>

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

          <div className="border-t border-amber-200 bg-amber-50/80 px-4 py-3 text-[12px] text-amber-950">
            <p className="font-semibold">Flow coverage</p>
            <p className="mt-1 text-amber-900/90">
              GRN receipts → cost entries / layers · WO material issue → issue cost · WO FG receipt → inventory
              valuation · Dispatch stock-out → cost relief (COGS GL deferred).
            </p>
          </div>
        </>
      ) : null}
    </InventoryCostingShell>
  )
}
