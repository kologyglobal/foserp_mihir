/**
 * FIFO Layer Explorer — open/consumed layers + detail with consumption history.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { RefreshCw, Layers } from 'lucide-react'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/forms/Inputs'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { isApiMode } from '@/config/apiConfig'
import {
  fetchInventoryCostLayer,
  fetchInventoryCostLayers,
  type InventoryCostLayerDto,
} from '@/services/api/inventoryCostingApi'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { InventoryCostingShell } from './InventoryCostingShell'
import { inventoryCostingPaths } from './inventoryCostingPaths'
import { DEMO_COST_LAYERS } from './costingDemoData'

function shortId(id: string | null | undefined): string {
  if (!id) return '—'
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}

export function InventoryFifoLayersPage() {
  const api = isApiMode()
  const [params] = useSearchParams()
  const [rows, setRows] = useState<InventoryCostLayerDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('OPEN')
  const itemId = params.get('itemId') ?? undefined
  const serialId = params.get('serialId') ?? undefined
  const lotId = params.get('lotId') ?? undefined

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!api) {
        let demo = DEMO_COST_LAYERS
        if (status) demo = demo.filter((r) => r.status === status)
        if (itemId) demo = demo.filter((r) => r.itemId === itemId)
        if (serialId) demo = demo.filter((r) => r.serialId === serialId)
        if (lotId) demo = demo.filter((r) => r.lotId === lotId)
        setRows(demo)
        return
      }
      const res = await fetchInventoryCostLayers({
        limit: 100,
        status: status || undefined,
        openOnly: status === 'OPEN' ? true : undefined,
        itemId,
        serialId,
        lotId,
      })
      setRows(res.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cost layers')
    } finally {
      setLoading(false)
    }
  }, [api, status, itemId, serialId, lotId])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((r) =>
      `${r.id} ${r.itemId} ${r.warehouseId} ${r.serialId} ${r.lotId}`.toLowerCase().includes(q),
    )
  }, [rows, search])

  return (
    <InventoryCostingShell
      title="FIFO Layers"
      favoritePath={inventoryCostingPaths.layers}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <div className="border-b border-erp-border bg-erp-surface/40 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[200px] flex-1">
            <SearchInput value={search} onChange={setSearch} placeholder="Search layer, item, serial…" />
          </div>
          <div className="min-w-[140px]">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="DEPLETED">Depleted</option>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-3">
          <LoadingState variant="table" />
        </div>
      ) : null}
      {error ? <p className="px-3 py-3 text-[13px] text-rose-700">{error}</p> : null}
      {!loading && !error && visible.length === 0 ? (
        <EmptyState icon={Layers} title="No cost layers" description="FIFO receipts create open layers. Run opening-stock migration if switching to FIFO." />
      ) : null}

      {!loading && !error && visible.length > 0 ? (
        <div className="erp-table-wrap overflow-x-auto">
          <table className="erp-table w-full min-w-[880px] text-left text-[12px]">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Status</th>
                <th className="text-right">Remaining qty</th>
                <th className="text-right">Unit cost</th>
                <th className="text-right">Remaining value</th>
                <th>Identity</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{formatDate(r.receiptDate.slice(0, 10))}</td>
                  <td>
                    <DynamicsStatusChip
                      label={r.status}
                      tone={r.status === 'OPEN' ? 'success' : 'neutral'}
                    />
                  </td>
                  <td className="text-right font-mono tabular-nums">
                    {Number(r.remainingQuantity).toLocaleString()} / {Number(r.originalQuantity).toLocaleString()}
                  </td>
                  <td className="text-right font-mono tabular-nums">{formatCurrency(Number(r.unitCost))}</td>
                  <td className="text-right font-mono tabular-nums font-semibold">
                    {formatCurrency(Number(r.remainingValue))}
                  </td>
                  <td className="text-[12px] text-erp-muted">
                    {r.serialId ? `S:${shortId(r.serialId)}` : r.lotId ? `L:${shortId(r.lotId)}` : '—'}
                  </td>
                  <td className="text-right">
                    <Link to={inventoryCostingPaths.layer(r.id)} className="font-semibold text-erp-primary hover:underline">
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

export function InventoryFifoLayerDetailPage() {
  const { id } = useParams()
  const api = isApiMode()
  const [row, setRow] = useState<InventoryCostLayerDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        if (!api) {
          if (!cancelled) setRow(DEMO_COST_LAYERS.find((l) => l.id === id) ?? null)
          return
        }
        const res = await fetchInventoryCostLayer(id)
        if (!cancelled) setRow(res.data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load layer')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [api, id])

  return (
    <InventoryCostingShell
      title="FIFO Layer"
      favoritePath={inventoryCostingPaths.layers}
    >
      <div className="p-4">
      {loading ? <LoadingState variant="card" /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {!loading && !row ? <EmptyState icon={Layers} title="Layer not found" /> : null}
      {row ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-erp-border p-3 text-[13px]">
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-erp-muted">Status</dt>
                  <dd>{row.status}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Receipt date</dt>
                  <dd>{formatDate(row.receiptDate.slice(0, 10))}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Unit cost</dt>
                  <dd className="font-mono">{formatCurrency(Number(row.unitCost))}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Remaining value</dt>
                  <dd className="font-mono font-semibold">{formatCurrency(Number(row.remainingValue))}</dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Remaining qty</dt>
                  <dd className="font-mono">
                    {row.remainingQuantity} / {row.originalQuantity}
                  </dd>
                </div>
                <div>
                  <dt className="text-erp-muted">Source movement</dt>
                  <dd className="font-mono text-[12px]">{shortId(row.sourceMovementId)}</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-md border border-erp-border p-3 text-[13px]">
              <p className="mb-2 text-[12px] font-semibold uppercase text-erp-muted">Links</p>
              <ul className="space-y-2">
                <li>
                  <Link
                    to={inventoryCostingPaths.forMovement(row.sourceMovementId)}
                    className="font-semibold text-erp-primary hover:underline"
                  >
                    Cost entries for receipt →
                  </Link>
                </li>
                <li>
                  <Link to={inventoryCostingPaths.layers} className="font-semibold text-erp-primary hover:underline">
                    All layers →
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          {row.consumptions && row.consumptions.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-erp-border">
              <table className="min-w-full text-left text-[13px]">
                <thead className="border-b bg-erp-surface/60 text-[11px] uppercase text-erp-muted">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Unit</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2">Issue entry</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {row.consumptions.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2">{formatDate(c.createdAt.slice(0, 10))}</td>
                      <td className="px-3 py-2 text-right font-mono">{c.quantityConsumed}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(Number(c.unitCost))}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(Number(c.totalCost))}</td>
                      <td className="px-3 py-2">
                        <Link
                          to={inventoryCostingPaths.entry(c.issueCostEntryId)}
                          className="text-erp-primary hover:underline"
                        >
                          {shortId(c.issueCostEntryId)}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[13px] text-erp-muted">No consumptions yet — layer is fully intact.</p>
          )}
        </div>
      ) : null}
      </div>
    </InventoryCostingShell>
  )
}
