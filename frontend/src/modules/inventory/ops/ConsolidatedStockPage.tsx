import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Package, RefreshCw, Search } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpDataGrid } from '@/components/erp/ErpDataGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { listConsolidatedStock } from '@/services/inventory'
import type { ConsolidatedStockRow, StockHealthStatus } from '@/types/operationalStockViews'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { cn } from '@/utils/cn'
import { StockStatusBadge } from './opsShared'

function NumericCell({ value, mono }: { value: string; mono?: boolean }) {
  return (
    <span className={cn('ent-td-numeric tabular-nums', mono && 'font-mono text-[13px]')}>
      {value}
    </span>
  )
}

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
      if (!warehouseId) {
        const map = new Map<string, string>()
        for (const r of data) {
          if (r.warehouseId) map.set(r.warehouseId, r.warehouseName)
        }
        const next = [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
        if (next.length > 0) setAllWh(next)
      }
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

  const [allWh, setAllWh] = useState<Array<[string, string]>>([])
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

  const openItem = useCallback(
    (row: ConsolidatedStockRow) => {
      navigate(`/inventory/stock/${row.itemId}?warehouse=${row.warehouseId}`)
    },
    [navigate],
  )

  const columns: ColumnDef<ConsolidatedStockRow, unknown>[] = useMemo(
    () => [
      {
        accessorKey: 'itemCode',
        header: 'Item',
        meta: { columnLabel: 'Item' },
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="min-w-[11rem] max-w-[16rem]">
              <button
                type="button"
                className="ent-record-cell__id block max-w-full truncate text-left font-mono text-erp-primary hover:underline"
                onClick={(e) => {
                  e.stopPropagation()
                  openItem(r)
                }}
              >
                {r.itemCode}
              </button>
              <div className="ent-record-cell__meta mt-0.5 truncate" title={r.itemName}>
                {r.itemName}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'warehouseCode',
        header: 'Warehouse',
        meta: { columnLabel: 'Warehouse' },
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="min-w-[9rem] max-w-[14rem]">
              <div className="ent-record-cell__primary truncate font-mono text-[13px]">
                {r.warehouseCode}
              </div>
              <div className="ent-record-cell__meta mt-0.5 truncate" title={r.warehouseName}>
                {r.warehouseName}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'onHand',
        header: 'On Hand',
        meta: { align: 'right', columnLabel: 'On Hand' },
        cell: ({ row }) => <NumericCell value={formatNumber(row.original.onHand)} mono />,
      },
      {
        accessorKey: 'reserved',
        header: 'Reserved',
        meta: { align: 'right', columnLabel: 'Reserved' },
        cell: ({ row }) => <NumericCell value={formatNumber(row.original.reserved)} mono />,
      },
      {
        accessorKey: 'available',
        header: 'Available',
        meta: { align: 'right', columnLabel: 'Available' },
        cell: ({ row }) => (
          <span className="ent-td-numeric font-medium tabular-nums font-mono text-[13px]">
            {formatNumber(row.original.available)}
          </span>
        ),
      },
      {
        accessorKey: 'incoming',
        header: 'Incoming',
        meta: { align: 'right', columnLabel: 'Incoming' },
        cell: ({ row }) => <NumericCell value={formatNumber(row.original.incoming)} mono />,
      },
      {
        accessorKey: 'avgCost',
        header: 'Avg Cost',
        meta: { align: 'right', columnLabel: 'Avg Cost' },
        cell: ({ row }) => <NumericCell value={formatCurrency(row.original.avgCost)} mono />,
      },
      {
        accessorKey: 'reorderLevel',
        header: 'Reorder',
        meta: { align: 'right', columnLabel: 'Reorder' },
        cell: ({ row }) => <NumericCell value={formatNumber(row.original.reorderLevel)} mono />,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: { align: 'center', columnLabel: 'Status' },
        cell: ({ row }) => (
          <div className="flex justify-center">
            <StockStatusBadge status={row.original.status} />
          </div>
        ),
      },
    ],
    [openItem],
  )

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Store"
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
        <EnterpriseRegisterTableShell className="min-w-0">
          <ErpDataGrid
            className="inventory-consolidated-stock-table"
            data={rows}
            columns={columns}
            getRowId={(r) => `${r.itemId}::${r.warehouseId}`}
            stickyFirstColumn
            enableColumnSorting
            showCompactSearch={false}
            showToolbarView={false}
            showToolbarExport={false}
            emptyMessage="No stock balances"
            onRowSelect={openItem}
            recordLabel="balance"
            exportFileName="consolidated-stock"
          />
        </EnterpriseRegisterTableShell>
      ) : null}
    </OperationalPageShell>
  )
}
