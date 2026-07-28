/**
 * Specific identification — serial/lot scoped cost layers.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RefreshCw, Fingerprint } from 'lucide-react'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/forms/Inputs'
import { Button } from '@/design-system/components/Button'
import { isApiMode } from '@/config/apiConfig'
import { fetchInventoryCostLayers, type InventoryCostLayerDto } from '@/services/api/inventoryCostingApi'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { InventoryCostingShell } from './InventoryCostingShell'
import { inventoryCostingPaths } from './inventoryCostingPaths'
import { DEMO_COST_LAYERS } from './costingDemoData'

export function InventorySpecificIdPage() {
  const api = isApiMode()
  const [params, setParams] = useSearchParams()
  const [serialId, setSerialId] = useState(params.get('serialId') ?? '')
  const [lotId, setLotId] = useState(params.get('lotId') ?? '')
  const [rows, setRows] = useState<InventoryCostLayerDto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const runSearch = useCallback(async (serial?: string, lot?: string) => {
    const s = (serial ?? serialId).trim()
    const l = (lot ?? lotId).trim()
    if (!s && !l) {
      setError('Enter a serial id or lot id')
      return
    }
    setLoading(true)
    setError(null)
    setSearched(true)
    const next = new URLSearchParams()
    if (s) next.set('serialId', s)
    if (l) next.set('lotId', l)
    setParams(next, { replace: true })
    try {
      if (!api) {
        setRows(
          DEMO_COST_LAYERS.filter(
            (r) => (s && r.serialId === s) || (l && r.lotId === l) || (!s && !l && r.serialId),
          ),
        )
        return
      }
      const res = await fetchInventoryCostLayers({
        limit: 100,
        serialId: s || undefined,
        lotId: l || undefined,
      })
      setRows(res.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load identity layers')
    } finally {
      setLoading(false)
    }
  }, [api, serialId, lotId, setParams])

  useEffect(() => {
    const s = params.get('serialId')
    const l = params.get('lotId')
    if (s || l) void runSearch(s ?? '', l ?? '')
    // initial deep-link only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <InventoryCostingShell
      title="Specific Identification"
      favoritePath={inventoryCostingPaths.specific}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            {
              id: 'refresh',
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => void runSearch(),
            },
          ]}
        />
      }
    >
      <div className="flex flex-wrap items-end gap-2 border-b border-erp-border bg-erp-surface/40 px-3 py-2.5">
        <label className="block min-w-[220px] flex-1 text-[12px]">
          <span className="text-erp-muted">Serial id</span>
          <Input className="mt-1" value={serialId} onChange={(e) => setSerialId(e.target.value)} placeholder="UUID" />
        </label>
        <label className="block min-w-[220px] flex-1 text-[12px]">
          <span className="text-erp-muted">Lot id</span>
          <Input className="mt-1" value={lotId} onChange={(e) => setLotId(e.target.value)} placeholder="UUID" />
        </label>
        <Button size="sm" onClick={() => void runSearch()}>
          Find cost
        </Button>
      </div>

      {loading ? (
        <div className="p-3">
          <LoadingState variant="table" />
        </div>
      ) : null}
      {error ? <p className="px-3 py-3 text-[13px] text-rose-700">{error}</p> : null}
      {!loading && searched && rows.length === 0 ? (
        <EmptyState icon={Fingerprint} title="No identity layers" description="No open or historical layers for that serial/lot." />
      ) : null}
      {!loading && !searched ? (
        <p className="px-4 py-8 text-center text-[13px] text-erp-muted">
          Enter a serial or lot UUID to explore its receipt cost layer.
        </p>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="erp-table-wrap overflow-x-auto">
          <table className="erp-table w-full min-w-[640px] text-left text-[12px]">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Status</th>
                <th className="text-right">Remaining</th>
                <th className="text-right">Unit cost</th>
                <th className="text-right">Value</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.receiptDate.slice(0, 10))}</td>
                  <td>{r.status}</td>
                  <td className="text-right font-mono tabular-nums">{r.remainingQuantity}</td>
                  <td className="text-right font-mono tabular-nums font-semibold">{formatCurrency(Number(r.unitCost))}</td>
                  <td className="text-right font-mono tabular-nums">{formatCurrency(Number(r.remainingValue))}</td>
                  <td className="text-right">
                    <Link to={inventoryCostingPaths.layer(r.id)} className="font-semibold text-erp-primary hover:underline">
                      Layer
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
