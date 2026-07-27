/**
 * Inventory vs layer valuation reconciliation (prep for Inventory vs GL).
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, GitCompare } from 'lucide-react'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/forms/Inputs'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { isApiMode } from '@/config/apiConfig'
import {
  fetchValuationReconciliation,
  type ValuationReconciliationDto,
} from '@/services/api/inventoryCostingApi'
import { formatCurrency } from '@/utils/formatters/currency'
import { InventoryCostingShell } from './InventoryCostingShell'
import { inventoryCostingPaths } from './inventoryCostingPaths'
import { DEMO_RECON, methodLabel } from './costingDemoData'

export function InventoryValuationReconPage() {
  const api = isApiMode()
  const [data, setData] = useState<ValuationReconciliationDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mismatchesOnly, setMismatchesOnly] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!api) {
        setData(DEMO_RECON)
        return
      }
      const res = await fetchValuationReconciliation({ mismatchesOnly })
      setData(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reconciliation')
    } finally {
      setLoading(false)
    }
  }, [api, mismatchesOnly])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <InventoryCostingShell
      title="Valuation Reconciliation"
      favoritePath={inventoryCostingPaths.reconciliation}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            {
              id: 'accounting',
              label: 'Inventory Accounting',
              onClick: () => {
                window.location.assign('/inventory/accounting')
              },
            },
          ]}
        />
      }
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-erp-border bg-erp-surface/40 px-3 py-2.5 text-[13px]">
        {data ? (
          <>
            <span>
              Method: <strong>{methodLabel(String(data.valuationMethod))}</strong>
            </span>
            <span>
              Rows: <strong className="tabular-nums">{data.total}</strong>
            </span>
            <span className={data.mismatched > 0 ? 'text-rose-700' : 'text-emerald-700'}>
              Mismatches: <strong className="tabular-nums">{data.mismatched}</strong>
            </span>
          </>
        ) : null}
        <div className="ml-auto min-w-[160px]">
          <Select
            value={mismatchesOnly ? 'yes' : 'no'}
            onChange={(e) => setMismatchesOnly(e.target.value === 'yes')}
          >
            <option value="no">All balances</option>
            <option value="yes">Mismatches only</option>
          </Select>
        </div>
      </div>

      <div className="border-b border-erp-border px-3 py-2 text-[12px] text-erp-muted">
        Inventory vs GL: use this screen for stock-value truth, then{' '}
        <Link to="/inventory/accounting" className="font-semibold text-erp-primary hover:underline">
          Inventory Accounting
        </Link>{' '}
        for voucher events when INVENTORY_ACCOUNTING is enabled. Full inventory↔GL trial balance recon remains deferred.
      </div>

      {loading ? (
        <div className="p-3">
          <LoadingState variant="table" />
        </div>
      ) : null}
      {error ? <p className="px-3 py-3 text-[13px] text-rose-700">{error}</p> : null}
      {!loading && data && data.items.length === 0 ? (
        <EmptyState icon={GitCompare} title="No reconciliation rows" description="No stock balances to compare, or filter excluded all rows." />
      ) : null}

      {!loading && data && data.items.length > 0 ? (
        <div className="erp-table-wrap overflow-x-auto">
          <table className="erp-table w-full min-w-[960px] text-left text-[12px]">
            <thead>
              <tr>
                <th>Item</th>
                <th>Warehouse</th>
                <th>Status</th>
                <th className="text-right">On hand</th>
                <th className="text-right">Layer qty</th>
                <th className="text-right">Stock value</th>
                <th className="text-right">Layer value</th>
                <th className="text-right">Δ value</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={`${r.itemId}-${r.warehouseId}`} className={r.status === 'MISMATCHED' ? 'bg-rose-50/40' : undefined}>
                  <td>{r.item ? `${r.item.code} · ${r.item.name}` : r.itemId.slice(0, 8)}</td>
                  <td>{r.warehouse ? r.warehouse.code : r.warehouseId.slice(0, 8)}</td>
                  <td>
                    <DynamicsStatusChip
                      label={r.status}
                      tone={r.status === 'MATCHED' ? 'success' : 'critical'}
                    />
                  </td>
                  <td className="text-right font-mono tabular-nums">{Number(r.onHandQty).toLocaleString()}</td>
                  <td className="text-right font-mono tabular-nums">{Number(r.layerRemainingQty).toLocaleString()}</td>
                  <td className="text-right font-mono tabular-nums">{formatCurrency(Number(r.stockValue))}</td>
                  <td className="text-right font-mono tabular-nums">{formatCurrency(Number(r.layerRemainingValue))}</td>
                  <td className="text-right font-mono tabular-nums font-semibold">
                    {formatCurrency(Number(r.valueDifference))}
                  </td>
                  <td className="text-right">
                    <Link
                      to={`${inventoryCostingPaths.layers}?itemId=${encodeURIComponent(r.itemId)}`}
                      className="font-semibold text-erp-primary hover:underline"
                    >
                      Layers
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </InventoryCostingShell>
  )
}
