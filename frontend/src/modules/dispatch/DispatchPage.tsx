import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Truck, FileText, MapPin } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { SearchInput } from '../../components/ui/SearchInput'
import { DataTable } from '../../components/tables/DataTable'
import { dispatchOrders } from '@/data/dispatch/legacyDemo'
import type { DispatchOrder } from '../../types/erp'
import { formatDate } from '../../utils/dates/format'
export function DispatchPage() {
  const [search, setSearch] = useState('')

  const columns: ColumnDef<DispatchOrder, unknown>[] = [
    {
      accessorKey: 'dispatchNo',
      header: 'Dispatch No',
      cell: ({ row }) => (
        <span className="font-medium text-slate-800">{row.original.dispatchNo}</span>
      ),
    },
    { accessorKey: 'salesOrderNo', header: 'Sales Order' },
    { accessorKey: 'customerName', header: 'Customer' },
    { accessorKey: 'productName', header: 'Product' },
    {
      accessorKey: 'quantity',
      header: 'Qty',
      cell: ({ row }) => `${row.original.quantity} units`,
    },
    { accessorKey: 'vehicleNo', header: 'Vehicle No' },
    { accessorKey: 'driverName', header: 'Driver' },
    {
      accessorKey: 'dispatchDate',
      header: 'Dispatch Date',
      cell: ({ row }) => formatDate(row.original.dispatchDate),
    },
    { accessorKey: 'destination', header: 'Destination' },
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
          <Button variant="ghost" size="sm" title="View challan">
            <FileText className="h-3.5 w-3.5" />
          </Button>
          {row.original.status === 'ready' && (
            <>
              <Button variant="primary" size="sm" title="Assign vehicle">
                <Truck className="h-3.5 w-3.5" />
                Load
              </Button>
              <Button variant="secondary" size="sm">
                Print DC
              </Button>
            </>
          )}
          {row.original.status === 'loading' && (
            <Button variant="success" size="sm">
              Dispatch
            </Button>
          )}
          {row.original.status === 'in-transit' && (
            <Button variant="ghost" size="sm" title="Track shipment">
              <MapPin className="h-3.5 w-3.5" />
              Track
            </Button>
          )}
        </div>
      ),
    },
  ]

  const ready = dispatchOrders.filter((d) => d.status === 'ready').length
  const inTransit = dispatchOrders.filter((d) => d.status === 'in-transit').length
  const delivered = dispatchOrders.filter((d) => d.status === 'delivered').length

  return (
    <div>
      <PageHeader
        title="Dispatch & Logistics"
        description="Delivery challans, vehicle allocation, and shipment tracking"
        actions={
          <>
            <Button variant="secondary" size="sm">
              Delivery Report
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Create Dispatch
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Total Dispatches</p>
            <p className="text-2xl font-bold">{dispatchOrders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Ready to Load</p>
            <p className="text-2xl font-bold text-emerald-600">{ready}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">In Transit</p>
            <p className="text-2xl font-bold text-blue-600">{inTransit}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Delivered (MTD)</p>
            <p className="text-2xl font-bold">{delivered}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dispatch Register</CardTitle>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search dispatches..."
            className="w-64"
          />
        </CardHeader>
        <DataTable
          data={dispatchOrders}
          columns={columns}
          searchValue={search}
          globalFilterFn={(row, f) =>
            row.dispatchNo.toLowerCase().includes(f) ||
            row.customerName.toLowerCase().includes(f) ||
            row.salesOrderNo.toLowerCase().includes(f) ||
            row.destination.toLowerCase().includes(f)
          }
        />
      </Card>
    </div>
  )
}
