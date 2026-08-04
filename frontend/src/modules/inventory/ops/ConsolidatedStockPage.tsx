import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Package, RefreshCw, Search } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { listConsolidatedStock } from '@/services/inventory'
import type { ConsolidatedStockRow, StockHealthStatus } from '@/types/operationalStockViews'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { StockStatusBadge } from './opsShared'

export function ConsolidatedStockPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState<ConsolidatedStockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState(params.get('q') ?? params.get('search') ?? '')
  const [warehouseId, setWarehouseId] = useState(params.get('warehouseId') ?? '')
  const [status, setStatus] = useState<StockHealthStatus | 'all'>(
    (params.get('status') as StockHealthStatus | 'all') || 'all',
  )
  const [token, setToken] = useState(0)

  const load = useCallback(async () => {
    void token
    setLoading(true)
    setError(false)
    try {
      const data = await listConsolidatedStock({
        search: search || undefined,
        warehouseId: warehouseId || undefined,
        status: status === 'all' ? undefined : status,
      })
      setRows(data)
    } catch {
      setRows([])
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [search, warehouseId, status, token])

  useEffect(() => {
    void load()
  }, [load])

  const warehouses = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) {
      if (r.warehouseId) map.set(r.warehouseId, r.warehouseName)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows])

  // Warehouse options from full set — load all once for filter labels when filtered empty
  const [allWh, setAllWh] = useState<Array<[string, string]>>([])
  useEffect(() => {
    void listConsolidatedStock()
      .then((all) => {
        const map = new Map<string, string>()
        for (const r of all) {
          if (r.warehouseId) map.set(r.warehouseId, r.warehouseName)
        }
        setAllWh([...map.entries()].sort((a, b) => a[1].localeCompare(b[1])))
      })
      .catch(() => undefined)
  }, [])

  const whOptions = allWh.length > 0 ? allWh : warehouses

  const kpis = useMemo(() => {
    const items = new Set(rows.map((r) => r.itemId)).size
    const low = rows.filter((r) => r.status === 'low').length
    const out = rows.filter((r) => r.status === 'out').length
    const value = rows.reduce((s, r) => s + r.stockValue, 0)
    return { items, low, out, value }
  }, [rows])

  const applySearch = () => {
    const next = new URLSearchParams(params)
    if (search) next.set('q', search)
    else next.delete('q')
    next.delete('search')
    setParams(next, { replace: true })
    setToken((n) => n + 1)
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory"
      title="Consolidated Stock"
      description="One balance row per item × warehouse. Drill into item 360 for GRNs and ledger history (documents stay separate)."
      breadcrumbs={[
        { label: 'Store', to: '/inventory' },
        { label: 'Consolidated Stock' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/stock"
      kpiStrip={[
        { id: 'sku', label: 'Balance rows', value: rows.length, accent: 'blue' },
        { id: 'items', label: 'Items', value: kpis.items, accent: 'slate' },
        { id: 'low', label: 'Low stock', value: kpis.low, accent: kpis.low ? 'amber' : 'green' },
        { id: 'out', label: 'Out of stock', value: kpis.out, accent: kpis.out ? 'red' : 'green' },
        { id: 'val', label: 'Stock value', value: formatCurrency(kpis.value), accent: 'slate' },
      ]}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'refresh',
            label: 'Refresh',
            icon: RefreshCw,
            onClick: () => setToken((n) => n + 1),
          }}
          secondaryActions={[
            { id: 'wh-ops', label: 'Warehouse Ops', onClick: () => navigate('/inventory/ops/warehouses') },
            { id: 'analytics', label: 'Ops Analytics', onClick: () => navigate('/inventory/ops/analytics') },
            { id: 'ledger', label: 'Stock Ledger', onClick: () => navigate('/inventory/ledger') },
          ]}
        />
      )}
      filterBar={(
        <div className="ops-filter-bar">
          <label className="ops-filter-bar__search">
            <Search className="h-3.5 w-3.5 text-erp-muted" aria-hidden />
            <input
              className="erp-input h-8 min-w-[14rem] flex-1 text-[12px]"
              placeholder="Search item or warehouse…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applySearch()
              }}
            />
          </label>
          <label className="flex items-center gap-1.5 text-[12px] text-erp-muted">
            Warehouse
            <select
              className="erp-input h-8 min-w-[10rem] text-[12px]"
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value)
                setToken((n) => n + 1)
              }}
            >
              <option value="">All</option>
              {whOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-[12px] text-erp-muted">
            Status
            <select
              className="erp-input h-8 min-w-[8rem] text-[12px]"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StockHealthStatus | 'all')
                setToken((n) => n + 1)
              }}
            >
              <option value="all">All</option>
              <option value="healthy">Healthy</option>
              <option value="low">Low</option>
              <option value="out">Out</option>
              <option value="negative">Negative</option>
              <option value="overstock">Overstock</option>
            </select>
          </label>
          <button type="button" className="erp-btn erp-btn-secondary h-8 px-3 text-[12px]" onClick={applySearch}>
            Apply
          </button>
          <Link to={`/inventory/ops/search?q=${encodeURIComponent(search)}`} className="text-[12px] font-medium text-[#0078d4] hover:underline">
            Ops search
          </Link>
        </div>
      )}
    >
      {loading ? <LoadingState variant="table" rows={8} /> : null}
      {error ? (
        <EmptyState
          icon={Package}
          title="Could not load consolidated stock"
          description="Retry after checking API connectivity (live mode) or demo seed data."
          action={(
            <button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]" onClick={() => setToken((n) => n + 1)}>
              Retry
            </button>
          )}
        />
      ) : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState icon={Package} title="No stock balances" description="Adjust filters or post receipts / opening stock." />
      ) : null}
      {!loading && !error && rows.length > 0 ? (
        <div className="overflow-x-auto rounded border border-erp-border bg-white">
          <table className="erp-table w-full">
            <thead>
              <tr>
                <th>Item</th>
                <th>Warehouse</th>
                <th className="text-right">On Hand</th>
                <th className="text-right">Reserved</th>
                <th className="text-right">Available</th>
                <th className="text-right">Incoming</th>
                <th className="text-right">Avg Cost</th>
                <th className="text-right">Reorder</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.itemId}::${r.warehouseId}`}
                  className="cursor-pointer hover:bg-erp-bg-subtle"
                  onClick={() => navigate(`/inventory/stock/${r.itemId}?warehouse=${r.warehouseId}`)}
                >
                  <td>
                    <div className="font-mono text-[11px] text-erp-muted">{r.itemCode}</div>
                    <div className="text-[13px] font-medium text-[#0078d4]">{r.itemName}</div>
                  </td>
                  <td>
                    <span className="font-mono text-[11px]">{r.warehouseCode}</span>
                    <span className="ml-1 text-[12px] text-erp-muted">{r.warehouseName}</span>
                  </td>
                  <td className="text-right font-mono tabular-nums">{formatNumber(r.onHand)}</td>
                  <td className="text-right font-mono tabular-nums">{formatNumber(r.reserved)}</td>
                  <td className="text-right font-mono tabular-nums">{formatNumber(r.available)}</td>
                  <td className="text-right font-mono tabular-nums">{formatNumber(r.incoming)}</td>
                  <td className="text-right font-mono tabular-nums">{formatCurrency(r.avgCost)}</td>
                  <td className="text-right font-mono tabular-nums">{formatNumber(r.reorderLevel)}</td>
                  <td><StockStatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
