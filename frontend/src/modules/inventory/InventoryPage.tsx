import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, PackagePlus, ArrowUpDown, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge, formatStatus, statusColor } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { SearchInput } from '@/components/ui/SearchInput'
import { DataTable } from '@/components/tables/DataTable'
import { inventoryItems, materialShortages } from '@/data/inventory/legacyDemo'
import type { InventoryItem, MaterialShortage } from '@/types/erp'
import { formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
export function InventoryPage() {
  const [search, setSearch] = useState('')
  const [shortageSearch, setShortageSearch] = useState('')

  const stockColumns: ColumnDef<InventoryItem, unknown>[] = [
    {
      accessorKey: 'itemCode',
      header: 'Item Code',
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium">{row.original.itemCode}</span>
      ),
    },
    { accessorKey: 'description', header: 'Description' },
    { accessorKey: 'category', header: 'Category' },
    {
      accessorKey: 'onHand',
      header: 'On Hand',
      cell: ({ row }) => (
        <span
          className={
            row.original.onHand <= row.original.reorderLevel
              ? 'font-semibold text-red-600'
              : ''
          }
        >
          {formatNumber(row.original.onHand)} {row.original.uom}
        </span>
      ),
    },
    {
      accessorKey: 'reserved',
      header: 'Reserved',
      cell: ({ row }) => `${formatNumber(row.original.reserved)} ${row.original.uom}`,
    },
    {
      id: 'available',
      header: 'Available',
      cell: ({ row }) => {
        const avail = row.original.onHand - row.original.reserved
        return (
          <span className={avail < 0 ? 'font-semibold text-red-600' : ''}>
            {formatNumber(avail)} {row.original.uom}
          </span>
        )
      },
    },
    { accessorKey: 'location', header: 'Location' },
    {
      accessorKey: 'lastReceipt',
      header: 'Last Receipt',
      cell: ({ row }) => formatDate(row.original.lastReceipt),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const avail = row.original.onHand - row.original.reserved
        return (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" title="Goods receipt">
              <PackagePlus className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" title="Issue to production">
              <ArrowUpDown className="h-3.5 w-3.5" />
            </Button>
            {avail < 0 && (
              <Button variant="danger" size="sm">
                Raise PR
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  const shortageColumns: ColumnDef<MaterialShortage, unknown>[] = [
    {
      accessorKey: 'itemCode',
      header: 'Item Code',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.itemCode}</span>
      ),
    },
    { accessorKey: 'description', header: 'Description' },
    {
      accessorKey: 'requiredQty',
      header: 'Required',
      cell: ({ row }) => formatNumber(row.original.requiredQty),
    },
    {
      accessorKey: 'availableQty',
      header: 'Available',
      cell: ({ row }) => formatNumber(row.original.availableQty),
    },
    {
      accessorKey: 'shortageQty',
      header: 'Shortage',
      cell: ({ row }) => (
        <span className="font-semibold text-red-600">
          {formatNumber(row.original.shortageQty)}
        </span>
      ),
    },
    { accessorKey: 'workOrderNo', header: 'Work Order' },
    {
      accessorKey: 'requiredDate',
      header: 'Required By',
      cell: ({ row }) => formatDate(row.original.requiredDate),
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => (
        <Badge color={statusColor(row.original.priority)}>
          {formatStatus(row.original.priority)}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: () => (
        <div className="flex gap-1">
          <Button variant="primary" size="sm">
            Create PO
          </Button>
          <Button variant="secondary" size="sm">
            Substitute
          </Button>
        </div>
      ),
    },
  ]

  const lowStock = inventoryItems.filter(
    (i) => i.onHand - i.reserved <= i.reorderLevel,
  )

  return (
    <div>
      <PageHeader
        title="Inventory Management"
        description="Raw materials, bought-out parts, and stock control"
        actions={
          <>
            <Button variant="secondary" size="sm">
              Stock Report
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Goods Receipt
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Total SKUs</p>
            <p className="text-2xl font-bold">{inventoryItems.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Low Stock Items</p>
            <p className="text-2xl font-bold text-amber-600">{lowStock.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Active Shortages</p>
            <p className="text-2xl font-bold text-red-600">
              {materialShortages.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Critical Shortages</p>
            <p className="text-2xl font-bold text-red-600">
              {materialShortages.filter((s) => s.priority === 'critical').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Material Shortage Alert
          </CardTitle>
          <SearchInput
            value={shortageSearch}
            onChange={setShortageSearch}
            placeholder="Search shortages..."
            className="w-64"
          />
        </CardHeader>
        <DataTable
          data={materialShortages}
          columns={shortageColumns}
          searchValue={shortageSearch}
          globalFilterFn={(row, f) =>
            row.itemCode.toLowerCase().includes(f) ||
            row.description.toLowerCase().includes(f) ||
            row.workOrderNo.toLowerCase().includes(f)
          }
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock Register</CardTitle>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search inventory..."
            className="w-64"
          />
        </CardHeader>
        <DataTable
          data={inventoryItems}
          columns={stockColumns}
          searchValue={search}
          globalFilterFn={(row, f) =>
            row.itemCode.toLowerCase().includes(f) ||
            row.description.toLowerCase().includes(f) ||
            row.category.toLowerCase().includes(f)
          }
        />
      </Card>
    </div>
  )
}
