import { useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import {
  AlertTriangle,
  Boxes,
  Download,
  Printer,
  RefreshCw,
  TrendingUp,
  Warehouse,
} from 'lucide-react'
import { DataTable } from '@/components/tables/DataTable'
import {
  DynamicsModuleDashboard,
  DynamicsDashboardPanel,
  DynamicsDashboardGrid,
  DynamicsCommandButton,
} from '@/components/dynamics'
import { Button } from '@/components/ui/Button'
import { FilterBar } from '@/components/ui/FilterBar'
import { Badge } from '@/components/ui/Badge'
import { TableLink } from '@/components/ui/AppLink'
import { Select } from '@/components/forms/Inputs'
import { LowStockAlert, stockStatus } from '@/components/inventory/LowStockAlert'
import { useInventoryStore } from '@/store/inventoryStore'
import { useMasterStore } from '@/store/masterStore'
import { exportStockCsv } from '@/utils/inventory'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import type { StockPositionEnriched } from '@/types/inventory'

export function InventoryDashboardPage() {
  const warehouses = useMasterStore((s) => s.warehouses)
  const categories = useMasterStore((s) => s.categories)
  const getStockPositions = useInventoryStore((s) => s.getStockPositions)
  const getLowStockItems = useInventoryStore((s) => s.getLowStockItems)
  const stockMovements = useInventoryStore((s) => s.stockMovements)
  const reservations = useInventoryStore((s) => s.reservations)

  const [warehouseId, setWarehouseId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [search, setSearch] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const positions = useMemo(() => {
    void refreshKey
    let list = getStockPositions(warehouseId || undefined, search)
    if (categoryId) {
      const cat = categories.find((c) => c.id === categoryId)
      if (cat) list = list.filter((p) => p.categoryName === cat.categoryName)
    }
    return list
  }, [getStockPositions, warehouseId, categoryId, search, stockMovements, warehouses, reservations, categories, refreshKey])

  const lowStock = useMemo(() => getLowStockItems(), [getLowStockItems, stockMovements, reservations, refreshKey])
  const totalValue = positions.reduce((s, p) => s + p.stockValue, 0)
  const totalReserved = positions.reduce((s, p) => s + p.reservedQty, 0)
  const uniqueItems = new Set(positions.map((p) => p.itemId)).size

  const warehouseSummary = useMemo(() => {
    const map = new Map<string, { code: string; name: string; lines: number; value: number; low: number }>()
    for (const p of positions) {
      const existing = map.get(p.warehouseId) ?? { code: p.warehouseCode, name: p.warehouseName, lines: 0, value: 0, low: 0 }
      existing.lines += 1
      existing.value += p.stockValue
      if (p.isLowStock) existing.low += 1
      map.set(p.warehouseId, existing)
    }
    return [...map.values()].sort((a, b) => b.value - a.value)
  }, [positions])

  const columns: ColumnDef<StockPositionEnriched, unknown>[] = [
    {
      accessorKey: 'itemCode',
      header: 'Item Code',
      cell: ({ row }) => (
        <TableLink to={`/inventory/stock/${row.original.itemId}?warehouse=${row.original.warehouseId}`}>
          {row.original.itemCode}
        </TableLink>
      ),
    },
    { accessorKey: 'itemName', header: 'Item Name' },
    { accessorKey: 'categoryName', header: 'Category' },
    { accessorKey: 'warehouseCode', header: 'Warehouse' },
    { accessorKey: 'uomCode', header: 'UOM' },
    {
      accessorKey: 'onHand',
      header: 'On Hand',
      meta: { align: 'right' },
      cell: ({ row }) => (
        <span className={row.original.isLowStock ? 'font-semibold text-erp-danger' : ''}>
          {formatNumber(row.original.onHand)}
        </span>
      ),
    },
    {
      accessorKey: 'reservedQty',
      header: 'Reserved',
      meta: { align: 'right' },
      cell: ({ row }) => formatNumber(row.original.reservedQty),
    },
    {
      accessorKey: 'freeQty',
      header: 'Free',
      meta: { align: 'right' },
      cell: ({ row }) => formatNumber(row.original.freeQty),
    },
    {
      accessorKey: 'stockValue',
      header: 'Stock Value',
      meta: { align: 'right' },
      cell: ({ row }) => formatCurrency(row.original.stockValue),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const st = stockStatus(row.original)
        return <Badge color={st.color} dot>{st.label}</Badge>
      },
    },
  ]

  function handleExport() {
    const csv = exportStockCsv(positions)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'inventory-stock-position.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DynamicsModuleDashboard
      title="Inventory Analytics"
      subtitle="Stock position across warehouses, powered by movement ledger and reservations."
      badge="Inventory"
      favoritePath="/inventory"
      healthScore={lowStock.length > 5 ? 65 : lowStock.length > 0 ? 80 : 94}
      heroMetrics={[
        { id: 'items', label: 'Stock Items', value: uniqueItems, icon: Boxes, accent: 'blue', helper: `${positions.length} warehouse lines`, href: '/inventory/ledger' },
        { id: 'value', label: 'Total Stock Value', value: formatCurrency(totalValue), icon: TrendingUp, accent: 'green', helper: 'Movement ledger valuation', href: '/inventory/ledger' },
        { id: 'wh', label: 'Active Warehouses', value: warehouses.filter((w) => w.isActive).length, icon: Warehouse, accent: 'indigo', helper: 'Pune plant locations', href: '/masters/warehouses' },
        { id: 'low', label: 'Low Stock Items', value: lowStock.length, icon: AlertTriangle, accent: 'red', helper: 'Below reorder level', href: '/inventory/ledger' },
      ]}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={() => setRefreshKey((k) => k + 1)}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </>
      }
      quickActions={
        <>
          <DynamicsCommandButton primary icon={<Download className="h-4 w-4" />} onClick={handleExport}>Export</DynamicsCommandButton>
          <DynamicsCommandButton icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print</DynamicsCommandButton>
          <DynamicsCommandButton icon={<RefreshCw className="h-4 w-4" />} onClick={() => setRefreshKey((k) => k + 1)}>Refresh</DynamicsCommandButton>
        </>
      }
      kpiStrip={[
        { label: 'Reserved Stock', value: formatNumber(totalReserved), tone: 'warning', href: '/inventory/reservations' },
        { label: 'Warehouse Lines', value: positions.length, tone: 'primary' },
        { label: 'Low Stock Alerts', value: lowStock.length, tone: lowStock.length ? 'critical' : 'success' },
      ]}
    >
      <DynamicsDashboardGrid>
        <DynamicsDashboardPanel
          title="Low Stock Alerts"
          actions={<span className="dyn-entity-list-meta">{lowStock.length > 0 ? `${lowStock.length} items need attention` : 'All items above reorder'}</span>}
          noPadding
        >
          <LowStockAlert items={lowStock.slice(0, 8)} />
        </DynamicsDashboardPanel>

        <DynamicsDashboardPanel title="Warehouse Stock Summary" actions={<span className="dyn-entity-list-meta">Value and lines by warehouse</span>}>
          <ul className="dyn-entity-list">
            {warehouseSummary.length === 0 ? (
              <li className="dyn-empty-hint">No stock data available.</li>
            ) : (
              warehouseSummary.map((wh) => (
                <li key={wh.code} className="dyn-entity-list-item">
                  <div>
                    <p className="font-mono text-[13px] font-semibold">{wh.code}</p>
                    <p className="text-xs text-erp-muted">{wh.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{formatCurrency(wh.value)}</p>
                    <p className="text-xs text-erp-muted">
                      {wh.lines} lines
                      {wh.low > 0 && <span className="ml-1 text-erp-danger">· {wh.low} low</span>}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </DynamicsDashboardPanel>
      </DynamicsDashboardGrid>

      <DynamicsDashboardPanel title="Stock Position" actions={<span className="dyn-entity-list-meta">Real-time on-hand, reserved, and free stock</span>} noPadding>
        <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search item code or name...">
          <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="h-8 w-48 text-[13px]">
            <option value="">All Warehouses</option>
            {warehouses.filter((w) => w.isActive).map((w) => (
              <option key={w.id} value={w.id}>{w.warehouseCode}</option>
            ))}
          </Select>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-8 w-44 text-[13px]">
            <option value="">All Categories</option>
            {categories.filter((c) => c.isActive).map((c) => (
              <option key={c.id} value={c.id}>{c.categoryName}</option>
            ))}
          </Select>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </FilterBar>
        <DataTable
          data={positions}
          columns={columns}
          pageSize={20}
          footer={`${stockMovements.length} ledger entries · On Hand = Σ movements · Free = On Hand − Reserved`}
        />
      </DynamicsDashboardPanel>
    </DynamicsModuleDashboard>
  )
}
