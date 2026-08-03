/**
 * Moving average — current state from InventoryStockBalance (backend).
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, TrendingUp } from 'lucide-react'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { isApiMode } from '@/config/apiConfig'
import { fetchMovingAverageState, fetchMovingAverageHistory } from '@/services/api/inventoryCostingApi'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { InventoryCostingShell } from './InventoryCostingShell'
import { inventoryCostingPaths } from './inventoryCostingPaths'

type MaRow = {
  itemId: string
  warehouseId: string
  itemCode: string
  itemName: string
  warehouseCode: string
  warehouseName: string
  quantity: string
  inventoryValue: string
  currentAverageCost: string
  lastReceipt: { postingDate: string; unitCost: string } | null
  lastIssue: { postingDate: string; unitCost: string } | null
  lastRecalculated: string
}

export function InventoryAverageCostPage() {
  const api = isApiMode()
  const [rows, setRows] = useState<MaRow[]>([])
  const [historyItemId, setHistoryItemId] = useState<string | null>(null)
  const [history, setHistory] = useState<
    Array<{
      costEntryId: string
      postingDate: string
      entryType: string
      sourceDocument: string | null
      qtyBefore: string
      valueBefore: string
      averageBefore: string
      movementQty: string
      movementValue: string
      qtyAfter: string
      valueAfter: string
      averageAfter: string
    }>
  >([])
  const [historyNote, setHistoryNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!api) {
        setRows([])
        return
      }
      const res = await fetchMovingAverageState({ limit: 100 })
      setRows(res.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load moving average state')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  const openHistory = async (itemId: string, warehouseId?: string) => {
    setHistoryItemId(itemId)
    if (!api) return
    try {
      const res = await fetchMovingAverageHistory({ itemId, warehouseId, limit: 50 })
      setHistory(res.data?.items ?? [])
      setHistoryNote(res.data?.note ?? null)
    } catch {
      setHistory([])
      setHistoryNote(null)
    }
  }

  return (
    <InventoryCostingShell
      title="Moving Average"
      favoritePath={inventoryCostingPaths.average}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <div className="border-b border-erp-border px-3 py-2 text-[12px] text-erp-muted">
        Current average comes from inventory balances stamped by the costing engine. History before/after values are
        derived by replaying posted MA cost entries — React does not invent averages.
      </div>
      {loading ? (
        <div className="p-3">
          <LoadingState variant="table" />
        </div>
      ) : null}
      {error ? <p className="px-3 py-3 text-[13px] text-rose-700">{error}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No moving-average balances"
          description={api ? 'No stock balances for this tenant.' : 'Requires API mode.'}
        />
      ) : null}
      {!loading && rows.length > 0 ? (
        <div className="erp-table-wrap overflow-x-auto">
          <table className="erp-table w-full min-w-[960px] text-left text-[12px]">
            <thead>
              <tr>
                <th>Item</th>
                <th>Warehouse</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Value</th>
                <th className="text-right">Current avg</th>
                <th>Last receipt</th>
                <th>Last issue</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.itemId}:${r.warehouseId}`}>
                  <td className="font-medium">
                    {r.itemCode} — {r.itemName}
                  </td>
                  <td>
                    {r.warehouseCode} · {r.warehouseName}
                  </td>
                  <td className="text-right tabular-nums">{Number(r.quantity).toLocaleString()}</td>
                  <td className="text-right tabular-nums">{formatCurrency(Number(r.inventoryValue))}</td>
                  <td className="text-right font-semibold tabular-nums">
                    {formatCurrency(Number(r.currentAverageCost))}
                  </td>
                  <td>
                    {r.lastReceipt
                      ? `${formatDate(r.lastReceipt.postingDate)} · ${formatCurrency(Number(r.lastReceipt.unitCost))}`
                      : '—'}
                  </td>
                  <td>
                    {r.lastIssue
                      ? `${formatDate(r.lastIssue.postingDate)} · ${formatCurrency(Number(r.lastIssue.unitCost))}`
                      : '—'}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="font-semibold text-erp-primary hover:underline"
                      onClick={() => void openHistory(r.itemId, r.warehouseId)}
                    >
                      History
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {historyItemId ? (
        <div className="border-t border-erp-border px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">MA before / after history</h3>
            <Link
              to={inventoryCostingPaths.forItem(historyItemId)}
              className="text-[12px] font-semibold text-erp-primary hover:underline"
            >
              All entries →
            </Link>
          </div>
          {historyNote ? <p className="mb-2 text-[11px] text-erp-muted">{historyNote}</p> : null}
          {history.length === 0 ? (
            <p className="text-[12px] text-erp-muted">No MOVING_WEIGHTED_AVERAGE entries for this item.</p>
          ) : (
            <table className="erp-table w-full min-w-[1100px] text-left text-[12px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Type</th>
                  <th className="text-right">Qty before</th>
                  <th className="text-right">Value before</th>
                  <th className="text-right">Avg before</th>
                  <th className="text-right">Mvmt qty</th>
                  <th className="text-right">Mvmt value</th>
                  <th className="text-right">Qty after</th>
                  <th className="text-right">Value after</th>
                  <th className="text-right">Avg after</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.costEntryId}>
                    <td>{formatDate(h.postingDate.slice(0, 10))}</td>
                    <td className="text-erp-muted">{h.sourceDocument ?? '—'}</td>
                    <td>{h.entryType}</td>
                    <td className="text-right tabular-nums">{Number(h.qtyBefore).toLocaleString()}</td>
                    <td className="text-right tabular-nums">{formatCurrency(Number(h.valueBefore))}</td>
                    <td className="text-right tabular-nums">{formatCurrency(Number(h.averageBefore))}</td>
                    <td className="text-right tabular-nums">{Number(h.movementQty).toLocaleString()}</td>
                    <td className="text-right tabular-nums">{formatCurrency(Number(h.movementValue))}</td>
                    <td className="text-right tabular-nums">{Number(h.qtyAfter).toLocaleString()}</td>
                    <td className="text-right tabular-nums">{formatCurrency(Number(h.valueAfter))}</td>
                    <td className="text-right font-semibold tabular-nums">
                      {formatCurrency(Number(h.averageAfter))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </InventoryCostingShell>
  )
}
