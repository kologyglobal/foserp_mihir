/**
 * Cost Entries register + detail (query deep-links: movementId, workOrderId, itemId).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { RefreshCw, FileSpreadsheet } from 'lucide-react'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/forms/Inputs'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { isApiMode } from '@/config/apiConfig'
import {
  fetchInventoryCostEntries,
  fetchInventoryCostEntry,
  type InventoryCostEntryDto,
} from '@/services/api/inventoryCostingApi'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { InventoryCostingShell } from './InventoryCostingShell'
import { inventoryCostingPaths } from './inventoryCostingPaths'
import { DEMO_COST_ENTRIES, methodLabel } from './costingDemoData'

function shortId(id: string | null | undefined): string {
  if (!id) return '—'
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}

export function InventoryCostEntriesPage() {
  const api = isApiMode()
  const [params] = useSearchParams()
  const [rows, setRows] = useState<InventoryCostEntryDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState(() => params.get('search') ?? '')
  const [entryType, setEntryType] = useState('')
  const [method, setMethod] = useState('')

  const movementId = params.get('movementId') ?? undefined
  const workOrderId = params.get('workOrderId') ?? undefined
  const itemId = params.get('itemId') ?? undefined

  useEffect(() => {
    const q = params.get('search')
    if (q) setSearch(q)
  }, [params])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!api) {
        let demo = DEMO_COST_ENTRIES
        if (movementId) demo = demo.filter((r) => r.inventoryMovementId === movementId)
        if (workOrderId) demo = demo.filter((r) => r.workOrderId === workOrderId)
        if (itemId) demo = demo.filter((r) => r.itemId === itemId)
        if (entryType) demo = demo.filter((r) => r.entryType === entryType)
        if (method) demo = demo.filter((r) => r.valuationMethod === method)
        setRows(demo)
        return
      }
      const res = await fetchInventoryCostEntries({
        limit: 100,
        entryType: entryType || undefined,
        valuationMethod: method || undefined,
        inventoryMovementId: movementId,
        workOrderId,
        itemId,
      })
      setRows(res.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cost entries')
    } finally {
      setLoading(false)
    }
  }, [api, entryType, method, movementId, workOrderId, itemId])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((r) =>
      `${r.id} ${r.itemId} ${r.sourceType} ${r.sourceId} ${r.entryType} ${r.valuationMethod}`
        .toLowerCase()
        .includes(q),
    )
  }, [rows, search])

  return (
    <InventoryCostingShell
      title="Cost Entries"
      favoritePath={inventoryCostingPaths.entries}
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
            <SearchInput value={search} onChange={setSearch} placeholder="Search entry, item, source…" />
          </div>
          <div className="min-w-[140px]">
            <Select value={entryType} onChange={(e) => setEntryType(e.target.value)}>
              <option value="">All types</option>
              <option value="RECEIPT">Receipt</option>
              <option value="ISSUE">Issue</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="OPENING">Opening</option>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="">All methods</option>
              <option value="FIFO">FIFO</option>
              <option value="MOVING_WEIGHTED_AVERAGE">Moving average</option>
              <option value="STANDARD_COST">Standard cost</option>
              <option value="SPECIFIC_IDENTIFICATION">Specific ID</option>
            </Select>
          </div>
        </div>
        {(movementId || workOrderId || itemId) && (
          <p className="mt-2 text-[12px] text-erp-muted">
            Scoped
            {movementId ? ` · movement ${shortId(movementId)}` : ''}
            {workOrderId ? ` · work order ${shortId(workOrderId)}` : ''}
            {itemId ? ` · item ${shortId(itemId)}` : ''}
            {' · '}
            <Link to={inventoryCostingPaths.entries} className="font-semibold text-erp-primary hover:underline">
              Clear
            </Link>
          </p>
        )}
      </div>

      {loading ? (
        <div className="p-3">
          <LoadingState variant="table" />
        </div>
      ) : null}
      {error ? <p className="px-3 py-3 text-[13px] text-rose-700">{error}</p> : null}

      {!loading && !error && visible.length === 0 ? (
        <EmptyState icon={FileSpreadsheet} title="No cost entries" description="Post a GRN, WO issue, or dispatch to generate valuation entries." />
      ) : null}

      {!loading && !error && visible.length > 0 ? (
        <div className="erp-table-wrap overflow-x-auto">
          <table className="erp-table w-full min-w-[880px] text-left text-[12px]">
            <thead>
              <tr>
                <th>Entry</th>
                <th>Date</th>
                <th>Item</th>
                <th>Warehouse</th>
                <th>Type</th>
                <th>Method</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit cost</th>
                <th className="text-right">Total</th>
                <th>Source</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-[11px]">{r.entryNo ?? `CE-${r.id.slice(0, 8).toUpperCase()}`}</td>
                  <td className="whitespace-nowrap">{formatDate(r.postingDate.slice(0, 10))}</td>
                  <td className="font-medium">
                    {r.itemCode || r.item?.code
                      ? `${r.itemCode ?? r.item?.code} — ${r.itemName ?? r.item?.name ?? ''}`
                      : shortId(r.itemId)}
                  </td>
                  <td>{r.warehouseCode ?? r.warehouse?.code ?? shortId(r.warehouseId)}</td>
                  <td>
                    <DynamicsStatusChip label={r.entryType} tone={r.entryType === 'ISSUE' ? 'warning' : 'info'} />
                  </td>
                  <td>{methodLabel(String(r.valuationMethod))}</td>
                  <td className="text-right font-mono tabular-nums">{Number(r.quantity).toLocaleString()}</td>
                  <td className="text-right font-mono tabular-nums">{formatCurrency(Number(r.unitCost))}</td>
                  <td className="text-right font-mono tabular-nums font-semibold">
                    {formatCurrency(Number(r.totalCost))}
                  </td>
                  <td className="text-erp-muted">
                    {r.sourceType}
                    {r.workOrderId ? ` · WO ${shortId(r.workOrderId)}` : ''}
                  </td>
                  <td className="text-right">
                    <Link
                      to={inventoryCostingPaths.entry(r.id)}
                      className="font-semibold text-erp-primary hover:underline"
                    >
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

export function InventoryCostEntryDetailPage() {
  const { id } = useParams()
  const api = isApiMode()
  const [row, setRow] = useState<InventoryCostEntryDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        if (!api) {
          const demo = DEMO_COST_ENTRIES.find((e) => e.id === id) ?? null
          if (!cancelled) setRow(demo)
          return
        }
        const res = await fetchInventoryCostEntry(id)
        if (!cancelled) setRow(res.data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load entry')
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
      title="Cost Entry"
      favoritePath={inventoryCostingPaths.entries}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            {
              id: 'back',
              label: 'Back to entries',
              onClick: () => {
                window.history.back()
              },
            },
          ]}
        />
      }
    >
      <div className="p-4">
      {loading ? <LoadingState variant="card" /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {!loading && !row ? <EmptyState icon={FileSpreadsheet} title="Entry not found" /> : null}
      {row ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-erp-border p-3">
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Entry</h3>
            <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="text-erp-muted">Entry No.</dt>
                <dd className="font-mono">{row.entryNo ?? `CE-${row.id.slice(0, 8).toUpperCase()}`}</dd>
              </div>
              <div>
                <dt className="text-erp-muted">Status</dt>
                <dd>
                  <DynamicsStatusChip label={row.status} tone={row.isReversal ? 'warning' : 'success'} />
                </dd>
              </div>
              <div>
                <dt className="text-erp-muted">Type</dt>
                <dd>{row.entryType}</dd>
              </div>
              <div>
                <dt className="text-erp-muted">Method</dt>
                <dd>{methodLabel(String(row.valuationMethod))}</dd>
              </div>
              <div>
                <dt className="text-erp-muted">Item</dt>
                <dd className="font-medium">
                  {row.itemCode || row.item?.code
                    ? `${row.itemCode ?? row.item?.code} — ${row.itemName ?? row.item?.name ?? ''}`
                    : shortId(row.itemId)}
                </dd>
              </div>
              <div>
                <dt className="text-erp-muted">Warehouse</dt>
                <dd>{row.warehouseCode ?? row.warehouse?.code ?? shortId(row.warehouseId)}</dd>
              </div>
              <div>
                <dt className="text-erp-muted">Qty</dt>
                <dd className="font-mono">{row.quantity}</dd>
              </div>
              <div>
                <dt className="text-erp-muted">Unit cost</dt>
                <dd className="font-mono">{formatCurrency(Number(row.unitCost))}</dd>
              </div>
              <div>
                <dt className="text-erp-muted">Total</dt>
                <dd className="font-mono font-semibold">{formatCurrency(Number(row.totalCost))}</dd>
              </div>
              <div>
                <dt className="text-erp-muted">Posted</dt>
                <dd>{formatDate(row.postingDate.slice(0, 10))}</dd>
              </div>
              {(row.lotId || row.serialId) && (
                <div className="sm:col-span-2">
                  <dt className="text-erp-muted">Lot / Serial</dt>
                  <dd className="font-mono text-[12px]">
                    {row.lotId ? `Lot ${shortId(row.lotId)}` : ''}
                    {row.lotId && row.serialId ? ' · ' : ''}
                    {row.serialId ? `Serial ${shortId(row.serialId)}` : ''}
                  </dd>
                </div>
              )}
            </dl>
          </div>
          <div className="rounded-md border border-erp-border p-3">
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Source & links</h3>
            {row.movement ? (
              <p className="mb-2 text-[13px]">
                Movement <strong>{row.movement.movementNumber}</strong> · {row.movement.referenceType.replace(/_/g, ' ')}
                {row.movement.referenceNo ? ` · ${row.movement.referenceNo}` : ''}
              </p>
            ) : (
              <p className="mb-2 text-[13px] text-erp-muted">
                {row.sourceType}
                {row.sourceId ? ` · ${shortId(row.sourceId)}` : ''}
              </p>
            )}
            <ul className="space-y-2 text-[13px]">
              <li>
                <Link
                  to={`/inventory/ledger?itemId=${row.itemId}&warehouseId=${row.warehouseId}`}
                  className="font-semibold text-erp-primary hover:underline"
                >
                  Stock ledger →
                </Link>
              </li>
              {row.workOrderId ? (
                <li>
                  <Link
                    to={`/manufacturing/work-orders/${row.workOrderId}`}
                    className="font-semibold text-erp-primary hover:underline"
                  >
                    Work order →
                  </Link>
                </li>
              ) : null}
              {row.costLayerId ? (
                <li>
                  <Link
                    to={inventoryCostingPaths.layer(row.costLayerId)}
                    className="font-semibold text-erp-primary hover:underline"
                  >
                    Cost layer →
                  </Link>
                </li>
              ) : null}
              <li>
                <Link to={inventoryCostingPaths.entries} className="font-semibold text-erp-primary hover:underline">
                  All cost entries →
                </Link>
              </li>
            </ul>
            {row.accounting ? (
              <p className="mt-3 text-[11px] text-erp-muted">{row.accounting.note}</p>
            ) : null}
          </div>

          {row.consumptions && row.consumptions.length > 0 ? (
            <div className="rounded-md border border-erp-border p-3 lg:col-span-2">
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">
                FIFO / Specific layer consumption
              </h3>
              <table className="erp-table w-full text-left text-[12px]">
                <thead>
                  <tr>
                    <th>Layer</th>
                    <th>Receipt</th>
                    <th className="text-right">Qty consumed</th>
                    <th className="text-right">Unit cost</th>
                    <th className="text-right">Value</th>
                    <th>Identity</th>
                  </tr>
                </thead>
                <tbody>
                  {row.consumptions.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link
                          to={inventoryCostingPaths.layer(c.layerId)}
                          className="font-semibold text-erp-primary hover:underline"
                        >
                          {c.layer?.layerNo ?? shortId(c.layerId)}
                        </Link>
                      </td>
                      <td>{c.layer?.receiptDate ? formatDate(c.layer.receiptDate) : '—'}</td>
                      <td className="text-right tabular-nums">{c.quantityConsumed}</td>
                      <td className="text-right tabular-nums">{formatCurrency(Number(c.unitCost))}</td>
                      <td className="text-right tabular-nums">{formatCurrency(Number(c.totalCost))}</td>
                      <td className="font-mono text-[11px]">
                        {c.layer?.serialId ? `S ${shortId(c.layer.serialId)}` : ''}
                        {c.layer?.lotId ? `L ${shortId(c.layer.lotId)}` : ''}
                        {!c.layer?.serialId && !c.layer?.lotId ? '—' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {row.standardCost || (row.variances && row.variances.length > 0) ? (
            <div className="rounded-md border border-erp-border p-3 lg:col-span-2">
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">
                Standard cost evidence
              </h3>
              {row.standardCost ? (
                <p className="text-[13px]">
                  Active standard v{row.standardCost.version}: {formatCurrency(Number(row.standardCost.unitCost))}{' '}
                  (from {formatDate(row.standardCost.effectiveFrom)})
                </p>
              ) : null}
              {row.variances && row.variances.length > 0 ? (
                <ul className="mt-2 space-y-1 text-[12px]">
                  {row.variances.map((v) => (
                    <li key={v.id}>
                      {v.varianceType.replace(/_/g, ' ')}: {formatCurrency(Number(v.varianceAmount))}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      </div>
    </InventoryCostingShell>
  )
}
