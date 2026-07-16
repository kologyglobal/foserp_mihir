import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, FileText, CheckCircle, Factory } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { SearchInput } from '../../components/ui/SearchInput'
import { DataTable } from '../../components/tables/DataTable'
import { salesOrders } from '@/data/sales/legacyDemo'
import { products } from '@/data/masters/legacyProducts'
import type { SalesOrder } from '../../types/erp'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
export function SalesPage() {
  const [search, setSearch] = useState('')

  const columns: ColumnDef<SalesOrder, unknown>[] = [
    {
      accessorKey: 'orderNo',
      header: 'Order No',
      cell: ({ row }) => (
        <span className="font-medium text-slate-800">{row.original.orderNo}</span>
      ),
    },
    { accessorKey: 'customerName', header: 'Customer' },
    { accessorKey: 'productName', header: 'Product' },
    {
      accessorKey: 'quantity',
      header: 'Qty',
      cell: ({ row }) => `${row.original.quantity} units`,
    },
    {
      accessorKey: 'unitPrice',
      header: 'Unit Price',
      cell: ({ row }) => formatCurrency(row.original.unitPrice),
    },
    {
      id: 'total',
      header: 'Order Value',
      cell: ({ row }) =>
        formatCurrency(row.original.unitPrice * row.original.quantity),
    },
    {
      accessorKey: 'deliveryDate',
      header: 'Delivery',
      cell: ({ row }) => formatDate(row.original.deliveryDate),
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
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge color={statusColor(row.original.status)}>
          {formatStatus(row.original.status)}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" title="View order">
            <FileText className="h-3.5 w-3.5" />
          </Button>
          {row.original.status === 'confirmed' && (
            <Button variant="ghost" size="sm" title="Release to production">
              <Factory className="h-3.5 w-3.5" />
            </Button>
          )}
          {row.original.status === 'draft' && (
            <Button variant="ghost" size="sm" title="Confirm order">
              <CheckCircle className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  const filterFn = (row: SalesOrder, filter: string) =>
    row.orderNo.toLowerCase().includes(filter) ||
    row.customerName.toLowerCase().includes(filter) ||
    row.productName.toLowerCase().includes(filter)

  const totalValue = salesOrders.reduce(
    (sum, o) => sum + o.unitPrice * o.quantity,
    0,
  )

  return (
    <div>
      <PageHeader
        title="Sales Orders"
        description="Manage customer orders for trailer products"
        actions={
          <>
            <Button variant="secondary" size="sm">
              Export
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New Order
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Total Orders</p>
            <p className="text-2xl font-bold text-slate-900">{salesOrders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Pipeline Value</p>
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency(totalValue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">In Production</p>
            <p className="text-2xl font-bold text-slate-900">
              {salesOrders.filter((o) => o.status === 'in-production').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Ready to Dispatch</p>
            <p className="text-2xl font-bold text-emerald-600">
              {salesOrders.filter((o) => o.status === 'ready-dispatch').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Product Catalog</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Product</th>
                <th>Category</th>
                <th>Capacity</th>
                <th>Axle Config</th>
                <th>Base Price</th>
                <th>Lead Time</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.code}>
                  <td className="font-mono text-xs">{p.code}</td>
                  <td className="font-medium">{p.name}</td>
                  <td>{p.category}</td>
                  <td>{p.capacity}</td>
                  <td>{p.axleConfig}</td>
                  <td>{formatCurrency(p.basePrice)}</td>
                  <td>{p.leadTimeDays} days</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales Order Register</CardTitle>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search orders..."
            className="w-64"
          />
        </CardHeader>
        <DataTable
          data={salesOrders}
          columns={columns}
          searchValue={search}
          globalFilterFn={filterFn}
        />
      </Card>
    </div>
  )
}
