/**
 * Moving average cost history — derived from MOVING_WEIGHTED_AVERAGE cost entries.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, TrendingUp } from 'lucide-react'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { isApiMode } from '@/config/apiConfig'
import { fetchInventoryCostEntries, type InventoryCostEntryDto } from '@/services/api/inventoryCostingApi'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { InventoryCostingShell } from './InventoryCostingShell'
import { inventoryCostingPaths } from './inventoryCostingPaths'
import { DEMO_COST_ENTRIES } from './costingDemoData'

export function InventoryAverageCostPage() {
  const api = isApiMode()
  const [rows, setRows] = useState<InventoryCostEntryDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!api) {
        setRows(
          DEMO_COST_ENTRIES.filter((r) => r.valuationMethod === 'MOVING_WEIGHTED_AVERAGE').concat([
            {
              ...DEMO_COST_ENTRIES[0],
              id: 'demo-avg-1',
              valuationMethod: 'MOVING_WEIGHTED_AVERAGE',
              entryType: 'RECEIPT',
              unitCost: '82.5000',
              totalCost: '8250.0000',
              postingDate: '2026-07-15T00:00:00.000Z',
            },
          ]),
        )
        return
      }
      const res = await fetchInventoryCostEntries({
        limit: 100,
        valuationMethod: 'MOVING_WEIGHTED_AVERAGE',
      })
      setRows(res.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load average cost history')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    const sorted = [...rows].sort((a, b) => a.postingDate.localeCompare(b.postingDate))
    if (!search.trim()) return sorted
    const q = search.toLowerCase()
    return sorted.filter((r) => `${r.itemId} ${r.warehouseId} ${r.entryType}`.toLowerCase().includes(q))
  }, [rows, search])

  return (
    <InventoryCostingShell
      title="Average Cost History"
      favoritePath={inventoryCostingPaths.average}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <div className="border-b border-erp-border bg-erp-surface/40 px-3 py-2.5">
        <div className="max-w-md">
          <SearchInput value={search} onChange={setSearch} placeholder="Filter by item or warehouse id…" />
        </div>
      </div>
      {loading ? (
        <div className="p-3">
          <LoadingState variant="table" />
        </div>
      ) : null}
      {error ? <p className="px-3 py-3 text-[13px] text-rose-700">{error}</p> : null}
      {!loading && !error && visible.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No average-cost entries"
          description="Switch default costing method to Moving Average (or post under that policy) to populate history."
        />
      ) : null}
      {!loading && visible.length > 0 ? (
        <div className="erp-table-wrap overflow-x-auto">
          <table className="erp-table w-full min-w-[720px] text-left text-[12px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Item</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit cost</th>
                <th className="text-right">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{formatDate(r.postingDate.slice(0, 10))}</td>
                  <td>{r.entryType}</td>
                  <td className="font-mono text-[12px]">{r.itemId.slice(0, 8)}…</td>
                  <td className="text-right font-mono tabular-nums">{Number(r.quantity).toLocaleString()}</td>
                  <td className="text-right font-mono tabular-nums font-semibold">{formatCurrency(Number(r.unitCost))}</td>
                  <td className="text-right font-mono tabular-nums">{formatCurrency(Number(r.totalCost))}</td>
                  <td className="text-right">
                    <Link to={inventoryCostingPaths.entry(r.id)} className="font-semibold text-erp-primary hover:underline">
                      Open
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
