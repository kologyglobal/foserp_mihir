import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Package, RefreshCw, Save, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { SaveViewDialog } from '@/components/design-system/SaveViewDialog'
import { SmartFilterBar } from '@/components/design-system/SmartFilterBar'
import { getStockAvailability, INVENTORY_SAVED_VIEW_PRESETS } from '@/services/inventory'
import type { StockAvailability } from '@/types/inventoryDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { StockDetailsDrawer } from '@/components/inventory/StockDetailsDrawer'
import { useSavedViews } from '@/hooks/useSavedViews'
import { useMasterStore } from '@/store/masterStore'

export function StockAvailabilityPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const [params] = useSearchParams()
  const warehouses = useMasterStore((s) => s.warehouses.filter((w) => w.isActive))
  const [rows, setRows] = useState<StockAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(params.get('search') ?? '')
  const [warehouseId, setWarehouseId] = useState(params.get('warehouseId') ?? '')
  const [lowStock, setLowStock] = useState(params.get('lowStock') === '1')
  const [outOfStock, setOutOfStock] = useState(params.get('outOfStock') === '1')
  const [drawerItemId, setDrawerItemId] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const systemPresets = useMemo(() => {
    const presets: Record<string, Record<string, string>> = { 'My View': {} }
    for (const p of INVENTORY_SAVED_VIEW_PRESETS.filter((v) => v.workspace === '/inventory/stock')) {
      presets[p.name] = p.filters
    }
    return presets
  }, [])

  const savedViews = useSavedViews({
    pageId: '/inventory/stock',
    filters: { search, warehouseId, lowStock: lowStock ? '1' : '', outOfStock: outOfStock ? '1' : '' },
    systemPresets,
    onApply: (f) => {
      setSearch(f.search ?? '')
      setWarehouseId(f.warehouseId ?? '')
      setLowStock(f.lowStock === '1')
      setOutOfStock(f.outOfStock === '1')
    },
  })

  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    void refreshToken
    setLoading(true)
    setLoadError(false)
    try {
      setRows(await getStockAvailability({
        search,
        warehouseId: warehouseId || undefined,
        lowStock: lowStock || undefined,
        outOfStock: outOfStock || undefined,
      }))
    } catch {
      setRows([])
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [search, warehouseId, lowStock, outOfStock, refreshToken])

  useEffect(() => { void load() }, [load])

  const columns = useMemo<ColumnDef<StockAvailability>[]>(() => [
    {
      accessorKey: 'itemCode',
      header: 'Item Code',
      cell: ({ row }) => (
        <button type="button" className="font-mono text-xs text-erp-primary" onClick={() => setDrawerItemId(row.original.itemId)}>
          {row.original.itemCode}
        </button>
      ),
    },
    {
      accessorKey: 'itemName',
      header: 'Item Name',
      cell: ({ row }) => (
        <button type="button" className="text-left" onClick={() => setDrawerItemId(row.original.itemId)}>
          {row.original.itemName}
        </button>
      ),
    },
    { accessorKey: 'warehouseName', header: 'Warehouse' },
    { accessorKey: 'onHand', header: 'On Hand', cell: ({ row }) => <span className="font-mono">{row.original.onHand}</span> },
    { accessorKey: 'qualityHold', header: 'Quality Hold', cell: ({ row }) => <span className="font-mono">{row.original.qualityHold}</span> },
    { accessorKey: 'blocked', header: 'Blocked', cell: ({ row }) => <span className="font-mono">{row.original.blocked}</span> },
    { accessorKey: 'reserved', header: 'Reserved', cell: ({ row }) => <span className="font-mono">{row.original.reserved}</span> },
    { accessorKey: 'available', header: 'Available', cell: ({ row }) => <span className="font-mono">{row.original.available}</span> },
    { accessorKey: 'expectedReceipt', header: 'Expected Receipt', cell: ({ row }) => <span className="font-mono">{row.original.expectedReceipt}</span> },
    { accessorKey: 'plannedIssue', header: 'Planned Issue', cell: ({ row }) => <span className="font-mono">{row.original.plannedIssue}</span> },
    {
      accessorKey: 'stockValue',
      header: 'Stock Value',
      cell: ({ row }) => (perms.canViewCost ? formatCurrency(row.original.stockValue) : '—'),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusDot label={row.original.status.replace('_', ' ')} tone={statusToneFromLabel(row.original.status)} />
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="text-[12px] font-semibold text-erp-primary hover:underline"
            onClick={() => setDrawerItemId(row.original.itemId)}
          >
            View Stock Details
          </button>
          <TableLink to={`/inventory/stock/${row.original.itemId}`}>Full</TableLink>
          <TableLink to="/inventory/movements/receipts">Receive</TableLink>
          <TableLink to="/inventory/movements/issues">Issue</TableLink>
          {perms.canViewItemLedger ? (
            <TableLink to={`/inventory/items/${row.original.itemId}/ledger`}>Ledger</TableLink>
          ) : null}
        </div>
      ),
    },
  ], [perms.canViewCost, perms.canViewItemLedger])

  if (!perms.canViewStock) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Inventory & Warehouse"
        title="Stock Availability"
        breadcrumbs={[{ label: 'Inventory & Warehouse', to: '/inventory' }, { label: 'Stock Availability' }]}
        autoBreadcrumbs={false}
      >
        <EmptyState
          icon={ShieldOff}
          title="Access denied"
          description="You do not have permission to view stock availability (inventory.stock.view)."
        />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title="Stock Availability"
      description="On-hand, available, reserved and quality-hold positions by warehouse."
      breadcrumbs={[{ label: 'Inventory & Warehouse', to: '/inventory' }, { label: 'Stock Availability' }]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/stock"
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[
        { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) },
        { id: 'save-view', label: 'Save View', icon: Save, onClick: savedViews.openSaveDialog },
      ]}
      />}
    >
      <SmartFilterBar
        savedView={savedViews.activeView}
        onSavedViewChange={savedViews.selectView}
        savedViews={savedViews.viewNames}
        onSaveView={savedViews.openSaveDialog}
        resultCount={rows.length}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search item…" className="max-w-xs" />
        <select className="erp-input h-9 text-[13px]" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">All warehouses</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.warehouseName}</option>)}
        </select>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} /> Low stock</label>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={outOfStock} onChange={(e) => setOutOfStock(e.target.checked)} /> Out of stock</label>
      </div>
      {loading ? <LoadingState variant="table" /> : null}
      {!loading && loadError ? (
        <EmptyState
          icon={Package}
          title="Could not load stock"
          description="Something went wrong while loading stock availability. Try again."
          action={(
            <button
              type="button"
              className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
              onClick={() => setRefreshToken((n) => n + 1)}
            >
              Retry
            </button>
          )}
        />
      ) : null}
      {!loading && !loadError && rows.length === 0 ? <EmptyState icon={Package} title="No stock rows" /> : null}
      {!loading && !loadError && rows.length > 0 ? <DataTable columns={columns} data={rows} /> : null}
      <StockDetailsDrawer itemId={drawerItemId} onClose={() => setDrawerItemId(null)} onOpenFull={(itemId) => navigate(`/inventory/stock/${itemId}`)} />
      <p className="mt-4 text-xs text-erp-muted">Demo mode — click item row to open stock details drawer.</p>
      <SaveViewDialog
        open={savedViews.saveDialogOpen}
        defaultName={savedViews.activeView === 'My View' ? '' : savedViews.activeView}
        onClose={savedViews.closeSaveDialog}
        onSave={savedViews.saveCurrentView}
      />
    </OperationalPageShell>
  )
}
