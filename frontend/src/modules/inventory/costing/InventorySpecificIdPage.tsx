/**
 * Specific identification — open identity layers + unidentified attention.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RefreshCw, Fingerprint } from 'lucide-react'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/forms/Inputs'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { fetchSpecificIdentification, type InventoryCostLayerDto } from '@/services/api/inventoryCostingApi'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { InventoryCostingShell } from './InventoryCostingShell'
import { inventoryCostingPaths } from './inventoryCostingPaths'

export function InventorySpecificIdPage() {
  const [params] = useSearchParams()
  const [unidentifiedOnly, setUnidentifiedOnly] = useState(params.get('unidentified') === '1')
  const [rows, setRows] = useState<InventoryCostLayerDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchSpecificIdentification({
        limit: 100,
        unidentifiedOnly: unidentifiedOnly || undefined,
      })
      setRows(res.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load specific identification layers')
    } finally {
      setLoading(false)
    }
  }, [unidentifiedOnly])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <InventoryCostingShell
      title="Specific Identification"
      favoritePath={inventoryCostingPaths.specific}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-erp-border bg-erp-surface/40 px-3 py-2.5">
        <div className="min-w-[180px]">
          <Select
            value={unidentifiedOnly ? '1' : '0'}
            onChange={(e) => setUnidentifiedOnly(e.target.value === '1')}
          >
            <option value="0">All open layers</option>
            <option value="1">Unidentified only</option>
          </Select>
        </div>
        <p className="text-[12px] text-erp-muted">
          Exact serial/lot/pool cost — never averaged. Unidentified open layers are highlighted.
        </p>
      </div>
      {loading ? (
        <div className="p-3">
          <LoadingState variant="table" />
        </div>
      ) : null}
      {error ? <p className="px-3 py-3 text-[13px] text-rose-700">{error}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState icon={Fingerprint} title="No specific layers" description="No open layers match this filter." />
      ) : null}
      {!loading && rows.length > 0 ? (
        <div className="erp-table-wrap overflow-x-auto">
          <table className="erp-table w-full min-w-[960px] text-left text-[12px]">
            <thead>
              <tr>
                <th>Item</th>
                <th>Identity</th>
                <th>Warehouse</th>
                <th className="text-right">Remaining qty</th>
                <th className="text-right">Unit cost</th>
                <th className="text-right">Value</th>
                <th>Receipt</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const unidentified = r.unidentified ?? (!r.serialId && !r.lotId)
                return (
                  <tr key={r.id} className={unidentified ? 'bg-amber-50/60' : undefined}>
                    <td className="font-medium">
                      {r.itemCode ? `${r.itemCode} — ${r.itemName}` : r.itemId.slice(0, 8)}
                    </td>
                    <td className="font-mono text-[11px]">
                      {r.serialId ? `Serial ${r.serialId.slice(0, 10)}…` : ''}
                      {r.lotId ? `Lot ${r.lotId.slice(0, 10)}…` : ''}
                      {unidentified ? 'Unidentified pool' : ''}
                    </td>
                    <td>{r.warehouseCode ?? r.warehouseId.slice(0, 8)}</td>
                    <td className="text-right tabular-nums">{Number(r.remainingQuantity).toLocaleString()}</td>
                    <td className="text-right tabular-nums">{formatCurrency(Number(r.unitCost))}</td>
                    <td className="text-right font-semibold tabular-nums">
                      {formatCurrency(Number(r.remainingValue))}
                    </td>
                    <td>{formatDate(r.receiptDate.slice(0, 10))}</td>
                    <td>
                      <DynamicsStatusChip
                        label={unidentified ? 'Attention' : r.status}
                        tone={unidentified ? 'warning' : 'success'}
                      />
                    </td>
                    <td className="text-right">
                      <Link
                        to={inventoryCostingPaths.layer(r.id)}
                        className="font-semibold text-erp-primary hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </InventoryCostingShell>
  )
}
