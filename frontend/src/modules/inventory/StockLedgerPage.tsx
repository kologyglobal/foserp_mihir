import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Download,
  Plus,
  Printer,
  RefreshCw,
  Share2,
  SlidersHorizontal,
} from 'lucide-react'
import { DataGrid } from '@/components/tables/DataTable'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { SmartFilterBar, type FilterChip } from '@/components/design-system/SmartFilterBar'
import { CommandBar, CommandBarButton, CommandBarGroup } from '@/components/ui/CommandBar'
import { Button } from '@/components/ui/Button'
import { TypeBadge } from '@/components/ui/StatusBadge'
import { Select } from '@/components/forms/Inputs'
import { SearchInput } from '@/components/ui/SearchInput'
import { useInventoryStore } from '@/store/inventoryStore'
import { useMasterStore } from '@/store/masterStore'
import { useQualityStore } from '@/store/qualityStore'
import { useUIStore } from '@/store/uiStore'
import { exportLedgerCsv } from '@/utils/inventory'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import type { StockMovement, StockMovementType } from '@/types/inventory'

const TXN_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'opening', label: 'Opening' },
  { value: 'inward', label: 'Inward' },
  { value: 'issue', label: 'Issue' },
  { value: 'adjustment', label: 'Adjustment' },
]

export function StockLedgerPage() {
  const navigate = useNavigate()
  const getMovements = useInventoryStore((s) => s.getMovements)
  const stockMovements = useInventoryStore((s) => s.stockMovements)
  const warehouses = useMasterStore((s) => s.warehouses)
  const items = useMasterStore((s) => s.items)
  const openDetailPanel = useUIStore((s) => s.openDetailPanel)

  const [warehouseId, setWarehouseId] = useState('')
  const [search, setSearch] = useState('')
  const [txnType, setTxnType] = useState('')
  const [dateRangeDays, setDateRangeDays] = useState('30')
  const [savedView, setSavedView] = useState('My View')
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const whMap = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses])

  const filteredItemId = useMemo(() => {
    if (!search) return undefined
    const s = search.toLowerCase()
    const match = items.find((i) => i.itemCode.toLowerCase().includes(s) || i.itemName.toLowerCase().includes(s))
    return match?.id
  }, [search, items])

  const entries = useMemo(() => {
    let list = getMovements({
      warehouseId: warehouseId || undefined,
      movementType: (txnType || undefined) as StockMovementType | undefined,
      itemId: filteredItemId,
    })
    if (search && !filteredItemId) {
      const s = search.toLowerCase()
      list = list.filter((e) => {
        const item = itemMap.get(e.itemId)
        return item?.itemCode.toLowerCase().includes(s) || item?.itemName.toLowerCase().includes(s) || e.movementNo.toLowerCase().includes(s) || e.referenceNo.toLowerCase().includes(s)
      })
    }
    if (dateRangeDays) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - Number(dateRangeDays))
      const cutoffStr = cutoff.toISOString().slice(0, 10)
      list = list.filter((e) => e.movementDate >= cutoffStr)
    }
    return list
  }, [getMovements, warehouseId, txnType, filteredItemId, search, itemMap, stockMovements, dateRangeDays, refreshKey])

  const today = new Date().toISOString().slice(0, 10)
  const inventoryValue = useMemo(
    () => entries.reduce((s, e) => s + Math.abs(e.value), 0),
    [entries],
  )
  const todayCount = entries.filter((e) => e.movementDate === today).length
  const negativeAdjustments = entries.filter((e) => e.movementType === 'adjustment' && e.qty < 0).length
  const pendingQc = useMemo(() => {
    const qc = useQualityStore.getState().getMetrics()
    return qc.pendingInspections
  }, [stockMovements])

  const filterChips = useMemo((): FilterChip[] => {
    const chips: FilterChip[] = []
    if (warehouseId) {
      const wh = whMap.get(warehouseId)
      chips.push({ id: 'warehouse', label: wh?.warehouseCode ?? 'Warehouse' })
    }
    if (txnType) {
      chips.push({ id: 'type', label: TXN_TYPES.find((t) => t.value === txnType)?.label ?? txnType })
    }
    if (dateRangeDays) chips.push({ id: 'date', label: `Last ${dateRangeDays} Days` })
    if (search) chips.push({ id: 'search', label: `Item: ${search}` })
    return chips
  }, [warehouseId, txnType, dateRangeDays, search, whMap])

  function removeChip(id: string) {
    if (id === 'warehouse') setWarehouseId('')
    if (id === 'type') setTxnType('')
    if (id === 'date') setDateRangeDays('')
    if (id === 'search') setSearch('')
  }

  function clearFilters() {
    setWarehouseId('')
    setTxnType('')
    setDateRangeDays('30')
    setSearch('')
  }

  function openQuickView(row: StockMovement) {
    setSelectedRowId(row.id)
    const item = itemMap.get(row.itemId)
    const wh = whMap.get(row.warehouseId)
    openDetailPanel({
      title: row.movementNo,
      subtitle: `${formatStatusLabel(row.movementType)} · ${item?.itemCode ?? '—'}`,
      fields: [
        { label: 'Date', value: formatDate(row.movementDate) },
        { label: 'Type', value: formatStatusLabel(row.movementType) },
        { label: 'Item', value: `${item?.itemCode ?? '—'} — ${item?.itemName ?? ''}` },
        { label: 'Warehouse', value: wh?.warehouseCode ?? '—' },
        { label: 'Qty', value: `${row.qty >= 0 ? '+' : ''}${formatNumber(row.qty)}` },
        { label: 'Value', value: formatCurrency(row.value) },
        { label: 'On Hand After', value: formatNumber(row.balanceAfter) },
        { label: 'Reference', value: row.referenceNo || '—' },
        { label: 'Created By', value: row.createdBy },
      ],
      timeline: [
        { id: 'created', label: 'Created', time: formatDate(row.createdAt.slice(0, 10)), actor: row.createdBy, status: 'done' },
        { id: 'posted', label: 'Posted to Ledger', time: formatDate(row.movementDate), status: 'current' },
      ],
      links: [
        { label: `Item stock — ${item?.itemCode ?? ''}`, href: `/inventory/stock/${row.itemId}` },
        ...(row.workOrderId ? [{ label: 'Related Work Order', href: `/work-orders/${row.workOrderId}` }] : []),
      ],
      comments: row.remarks || undefined,
    })
  }

  function handleExport() {
    const csv = exportLedgerCsv(
      entries,
      (id) => itemMap.get(id)?.itemCode ?? id,
      (id) => whMap.get(id)?.warehouseCode ?? id,
    )
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'stock-movements.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const columns: ColumnDef<StockMovement, unknown>[] = [
    { accessorKey: 'movementNo', header: 'Movement No', cell: ({ row }) => <span className="font-mono text-xs font-semibold text-erp-primary">{row.original.movementNo}</span> },
    { accessorKey: 'movementDate', header: 'Date', cell: ({ row }) => formatDate(row.original.movementDate) },
    { accessorKey: 'movementType', header: 'Type', cell: ({ row }) => <TypeBadge value={row.original.movementType} color="blue" /> },
    {
      id: 'item',
      header: 'Item',
      cell: ({ row }) => {
        const item = itemMap.get(row.original.itemId)
        return (
          <Link to={`/inventory/stock/${row.original.itemId}`} className="text-erp-primary hover:underline">
            <span className="font-mono text-xs">{item?.itemCode}</span>
            <span className="ml-1 text-sm text-erp-text">{item?.itemName}</span>
          </Link>
        )
      },
    },
    { id: 'warehouse', header: 'Warehouse', cell: ({ row }) => whMap.get(row.original.warehouseId)?.warehouseCode ?? '—' },
    {
      accessorKey: 'qty',
      header: 'Qty',
      cell: ({ row }) => (
        <span className={row.original.qty >= 0 ? 'font-medium text-emerald-600' : 'font-medium text-red-600'}>
          {row.original.qty >= 0 ? '+' : ''}{formatNumber(row.original.qty)}
        </span>
      ),
      meta: { align: 'right' },
    },
    { accessorKey: 'rate', header: 'Rate', cell: ({ row }) => formatCurrency(row.original.rate), meta: { align: 'right' } },
    { accessorKey: 'value', header: 'Value', cell: ({ row }) => formatCurrency(row.original.value), meta: { align: 'right' } },
    { accessorKey: 'balanceAfter', header: 'On Hand After', cell: ({ row }) => formatNumber(row.original.balanceAfter), meta: { align: 'right' } },
    { accessorKey: 'referenceNo', header: 'Reference' },
  ]

  return (
    <OperationalPageShell
      title="Stock Ledger"
      description="Movement ledger — single source of truth for on-hand stock"
      favoritePath="/inventory/ledger"
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton icon={Plus} label="New Transaction" primary onClick={() => navigate('/inventory/inward')} />
            <CommandBarButton icon={Download} label="Export" onClick={handleExport} />
            <CommandBarButton icon={Printer} label="Print" onClick={() => window.print()} />
            <CommandBarButton icon={RefreshCw} label="Refresh" onClick={() => setRefreshKey((k) => k + 1)} />
          </CommandBarGroup>
          <CommandBarGroup label="Views">
            <CommandBarButton icon={SlidersHorizontal} label="Save View" onClick={() => setSavedView('My View')} />
            <CommandBarButton icon={Share2} label="Share View" onClick={() => undefined} />
          </CommandBarGroup>
        </CommandBar>
      }
      insights={[
        { label: 'Total Movements', value: entries.length, accent: 'blue' },
        { label: 'Inventory Value', value: formatCurrency(inventoryValue), accent: 'green' },
        { label: "Today's Movements", value: todayCount, accent: 'slate' },
        { label: 'Negative Adjustments', value: negativeAdjustments, accent: negativeAdjustments > 0 ? 'amber' : 'slate' },
        { label: 'Pending QC Stock', value: pendingQc, accent: pendingQc > 0 ? 'red' : 'green' },
      ]}
      filterBar={
        <SmartFilterBar
          chips={filterChips}
          onRemoveChip={removeChip}
          onClearAll={clearFilters}
          savedView={savedView}
          onSavedViewChange={setSavedView}
          resultCount={entries.length}
        >
          <SearchInput value={search} onChange={setSearch} placeholder="Search item or movement…" className="w-full sm:w-64" />
          <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="h-9 w-44 text-[13px]">
            <option value="">All Warehouses</option>
            {warehouses.filter((w) => w.isActive).map((w) => (
              <option key={w.id} value={w.id}>{w.warehouseCode}</option>
            ))}
          </Select>
          <Select value={txnType} onChange={(e) => setTxnType(e.target.value)} className="h-9 w-36 text-[13px]">
            {TXN_TYPES.map((t) => <option key={t.value || 'all'} value={t.value}>{t.label}</option>)}
          </Select>
          <Select value={dateRangeDays} onChange={(e) => setDateRangeDays(e.target.value)} className="h-9 w-40 text-[13px]">
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="">All Dates</option>
          </Select>
        </SmartFilterBar>
      }
    >
      <DataGrid
        data={entries}
        columns={columns}
        stickyFirstColumn
        zebra
        showToolbar={false}
        selectedRowId={selectedRowId}
        onRowSelect={(row) => setSelectedRowId(row.id)}
        onRowQuickView={openQuickView}
        emptyMessage="No stock movements match your filters."
        emptyAction={
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/inventory/inward"><Button size="sm"><ArrowDownToLine className="h-4 w-4" /> Material Inward</Button></Link>
            <Link to="/inventory/issue"><Button size="sm" variant="secondary"><ArrowUpFromLine className="h-4 w-4" /> Material Issue</Button></Link>
          </div>
        }
        exportFileName="stock-ledger"
      />
    </OperationalPageShell>
  )
}

function formatStatusLabel(type: StockMovementType) {
  return type.charAt(0).toUpperCase() + type.slice(1)
}
