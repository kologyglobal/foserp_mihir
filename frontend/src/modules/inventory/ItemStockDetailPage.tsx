import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Download, Printer } from 'lucide-react'
import { DataTable } from '@/components/tables/DataTable'
import { DetailLayout, DetailSection, DetailGrid, DetailField } from '@/components/masters/MasterLayouts'
import { TypeBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LowStockAlert } from '@/components/inventory/LowStockAlert'
import { useInventoryStore } from '@/store/inventoryStore'
import { useMasterStore } from '@/store/masterStore'
import { exportLedgerCsv } from '@/utils/inventory'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import type { StockMovement, StockPositionEnriched } from '@/types/inventory'

export function ItemStockDetailPage() {
  const { itemId } = useParams()
  const [searchParams] = useSearchParams()
  const warehouseFilter = searchParams.get('warehouse') ?? ''

  const item = useMasterStore((s) => (itemId ? s.getItem(itemId) : undefined))
  const getCategoryName = useMasterStore((s) => s.getCategoryName)
  const uoms = useMasterStore((s) => s.uoms)
  const warehouses = useMasterStore((s) => s.warehouses)
  const getStockPositions = useInventoryStore((s) => s.getStockPositions)
  const getItemMovements = useInventoryStore((s) => s.getItemMovements)
  const reservations = useInventoryStore((s) => s.reservations)
  const stockMovements = useInventoryStore((s) => s.stockMovements)

  const uomCode = (uomId: string) => uoms.find((u) => u.id === uomId)?.uomCode ?? '—'

  const positions = useMemo(() => {
    if (!item) return []
    return getStockPositions(undefined, item.itemCode).filter((p) => p.itemId === item.id)
  }, [getStockPositions, item, stockMovements, reservations])

  const whPositions = useMemo(
    () => (warehouseFilter ? positions.filter((p) => p.warehouseId === warehouseFilter) : positions),
    [positions, warehouseFilter],
  )

  const ledger = useMemo(
    () => (itemId ? getItemMovements(itemId, warehouseFilter || undefined) : []),
    [getItemMovements, itemId, warehouseFilter, stockMovements],
  )

  const itemReservations = useMemo(
    () =>
      itemId
        ? reservations.filter(
            (r) => r.itemId === itemId && (!warehouseFilter || r.warehouseId === warehouseFilter),
          )
        : [],
    [reservations, itemId, warehouseFilter],
  )

  if (!itemId || !item) {
    return <div className="py-12 text-center text-slate-500">Item not found in Item Master</div>
  }

  const stockItem = item

  const totalValue = whPositions.reduce((s, p) => s + p.stockValue, 0)
  const totalOnHand = whPositions.reduce((s, p) => s + p.onHand, 0)
  const isLow = whPositions.some((p) => p.isLowStock)

  const whColumns: ColumnDef<StockPositionEnriched, unknown>[] = [
    { accessorKey: 'warehouseCode', header: 'Warehouse' },
    { accessorKey: 'openingQty', header: 'Opening', cell: ({ row }) => formatNumber(row.original.openingQty) },
    { accessorKey: 'inwardQty', header: 'Inward', cell: ({ row }) => formatNumber(row.original.inwardQty) },
    { accessorKey: 'issuedQty', header: 'Issued', cell: ({ row }) => formatNumber(row.original.issuedQty) },
    { accessorKey: 'onHand', header: 'On Hand', cell: ({ row }) => formatNumber(row.original.onHand) },
    { accessorKey: 'reservedQty', header: 'Reserved', cell: ({ row }) => formatNumber(row.original.reservedQty) },
    { accessorKey: 'freeQty', header: 'Free', cell: ({ row }) => formatNumber(row.original.freeQty) },
    { accessorKey: 'stockValue', header: 'Value', cell: ({ row }) => formatCurrency(row.original.stockValue) },
  ]

  const ledgerColumns: ColumnDef<StockMovement, unknown>[] = [
    { accessorKey: 'movementNo', header: 'Movement No', cell: ({ row }) => <span className="font-mono text-xs">{row.original.movementNo}</span> },
    { accessorKey: 'movementDate', header: 'Date', cell: ({ row }) => formatDate(row.original.movementDate) },
    { accessorKey: 'movementType', header: 'Type', cell: ({ row }) => <TypeBadge value={row.original.movementType} /> },
    {
      id: 'wh',
      header: 'Warehouse',
      cell: ({ row }) => warehouses.find((w) => w.id === row.original.warehouseId)?.warehouseCode,
    },
    {
      accessorKey: 'qty',
      header: 'Qty',
      cell: ({ row }) => (
        <span className={row.original.qty >= 0 ? 'text-emerald-600' : 'text-red-600'}>
          {row.original.qty >= 0 ? '+' : ''}{formatNumber(row.original.qty)}
        </span>
      ),
    },
    { accessorKey: 'balanceAfter', header: 'Balance', cell: ({ row }) => formatNumber(row.original.balanceAfter) },
    { accessorKey: 'referenceNo', header: 'Reference' },
    { accessorKey: 'remarks', header: 'Remarks' },
  ]

  function handleExport() {
    const csv = exportLedgerCsv(
      ledger,
      () => stockItem.itemCode,
      (id) => warehouses.find((w) => w.id === id)?.warehouseCode ?? id,
    )
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stock-${stockItem.itemCode}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DetailLayout
      backTo="/inventory"
      backLabel="Back to Inventory"
      title={`${stockItem.itemCode} — ${stockItem.itemName}`}
      subtitle="Item-wise stock view with ledger history"
      editTo={`/masters/items/${itemId}/edit`}
      editLabel="Edit Item"
      badges={
        <>
          <TypeBadge value={stockItem.itemType} />
          {isLow && <Badge color="red">Low Stock</Badge>}
        </>
      }
    >
      <div className="mb-4 flex gap-2">
        <Button size="sm" variant="secondary" onClick={handleExport}><Download className="h-4 w-4" /> Export Ledger</Button>
        <Button size="sm" variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
      </div>

      {isLow && whPositions.filter((p) => p.isLowStock).length > 0 && (
        <div className="mb-6">
          <LowStockAlert items={whPositions.filter((p) => p.isLowStock)} compact />
        </div>
      )}

      <DetailSection title="Item Details">
        <DetailGrid>
          <DetailField label="Category" value={getCategoryName(stockItem.categoryId)} />
          <DetailField label="UOM" value={uomCode(stockItem.baseUomId)} />
          <DetailField label="Standard Rate" value={formatCurrency(stockItem.standardRate)} />
          <DetailField label="Reorder Level" value={formatNumber(stockItem.reorderLevel)} />
          <DetailField label="Total On Hand" value={formatNumber(totalOnHand)} />
          <DetailField label="Total Stock Value" value={formatCurrency(totalValue)} />
        </DetailGrid>
      </DetailSection>

      <div className="my-6">
        <DetailSection title="Stock by Warehouse">
          {whPositions.length === 0 ? (
            <p className="text-sm text-slate-500">No stock recorded for this item.</p>
          ) : (
            <DataTable data={whPositions} columns={whColumns} />
          )}
        </DetailSection>
      </div>

      {itemReservations.length > 0 && (
        <div className="my-6">
          <DetailSection title="Reservations">
            <table className="erp-table">
              <thead>
                <tr><th>Warehouse</th><th>Qty</th><th>Reference</th><th>Remarks</th></tr>
              </thead>
              <tbody>
                {itemReservations.map((r) => (
                  <tr key={r.id}>
                    <td>{warehouses.find((w) => w.id === r.warehouseId)?.warehouseName}</td>
                    <td>{formatNumber(r.qty)}</td>
                    <td className="font-mono text-xs">{r.referenceNo}</td>
                    <td className="text-xs">{r.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DetailSection>
        </div>
      )}

      <div className="my-6">
        <DetailSection title="Transaction History">
          <DataTable data={ledger} columns={ledgerColumns} />
        </DetailSection>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link to="/inventory/inward" className="text-erp-accent hover:underline">Post Inward →</Link>
        <Link to="/inventory/issue" className="text-erp-accent hover:underline">Post Issue →</Link>
        <Link to={`/masters/items/${itemId}`} className="text-erp-accent hover:underline">View Item Master →</Link>
      </div>
    </DetailLayout>
  )
}
