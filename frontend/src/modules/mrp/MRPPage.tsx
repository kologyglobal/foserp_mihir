import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Play, RefreshCw, ShoppingCart } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { SearchInput } from '../../components/ui/SearchInput'
import { DataTable } from '../../components/tables/DataTable'
import { mrpPlans } from '@/data/mrp/legacyDemo'
import type { MRPPlan } from '../../types/erp'
import { formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
export function MRPPage() {
  const [search, setSearch] = useState('')

  const columns: ColumnDef<MRPPlan, unknown>[] = [
    {
      accessorKey: 'planNo',
      header: 'Plan No',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.planNo}</span>
      ),
    },
    {
      accessorKey: 'itemCode',
      header: 'Item Code',
      cell: ({ row }) => (
        <span className="font-medium text-slate-800">{row.original.itemCode}</span>
      ),
    },
    { accessorKey: 'description', header: 'Description' },
    {
      accessorKey: 'grossRequirement',
      header: 'Gross Req',
      cell: ({ row }) => formatNumber(row.original.grossRequirement),
    },
    {
      accessorKey: 'scheduledReceipts',
      header: 'Sched. Receipts',
      cell: ({ row }) => formatNumber(row.original.scheduledReceipts),
    },
    {
      accessorKey: 'projectedOnHand',
      header: 'Proj. On Hand',
      cell: ({ row }) => formatNumber(row.original.projectedOnHand),
    },
    {
      accessorKey: 'netRequirement',
      header: 'Net Req',
      cell: ({ row }) => (
        <span
          className={
            row.original.netRequirement > 0
              ? 'font-semibold text-red-600'
              : 'text-emerald-600'
          }
        >
          {formatNumber(row.original.netRequirement)}
        </span>
      ),
    },
    {
      accessorKey: 'plannedOrderQty',
      header: 'Planned Order',
      cell: ({ row }) =>
        row.original.plannedOrderQty > 0
          ? formatNumber(row.original.plannedOrderQty)
          : '—',
    },
    {
      accessorKey: 'plannedOrderDate',
      header: 'Order Date',
      cell: ({ row }) =>
        row.original.plannedOrderDate !== '—'
          ? formatDate(row.original.plannedOrderDate)
          : '—',
    },
    { accessorKey: 'supplier', header: 'Supplier' },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          {row.original.plannedOrderQty > 0 && (
            <>
              <Button variant="primary" size="sm" title="Create purchase order">
                <ShoppingCart className="h-3.5 w-3.5" />
                PO
              </Button>
              <Button variant="secondary" size="sm" title="Reschedule">
                Reschedule
              </Button>
            </>
          )}
          {row.original.netRequirement === 0 && (
            <span className="text-xs text-emerald-600">Stock OK</span>
          )}
        </div>
      ),
    },
  ]

  const needsAction = mrpPlans.filter((p) => p.netRequirement > 0)
  const totalPlannedQty = mrpPlans.reduce((s, p) => s + p.plannedOrderQty, 0)

  return (
    <div>
      <PageHeader
        title="Material Requirements Planning"
        description="MRP run for Week 25 — Pune plant"
        actions={
          <>
            <Button variant="secondary" size="sm">
              <RefreshCw className="h-4 w-4" />
              Regenerate MRP
            </Button>
            <Button size="sm">
              <Play className="h-4 w-4" />
              Run MRP
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">MRP Items</p>
            <p className="text-2xl font-bold">{mrpPlans.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Net Requirements</p>
            <p className="text-2xl font-bold text-red-600">{needsAction.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Planned Orders</p>
            <p className="text-2xl font-bold">
              {mrpPlans.filter((p) => p.plannedOrderQty > 0).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Total Planned Qty</p>
            <p className="text-2xl font-bold">{formatNumber(totalPlannedQty)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>MRP Planning Table — Week 25/2026</CardTitle>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search MRP items..."
            className="w-64"
          />
        </CardHeader>
        <DataTable
          data={mrpPlans}
          columns={columns}
          searchValue={search}
          globalFilterFn={(row, f) =>
            row.itemCode.toLowerCase().includes(f) ||
            row.description.toLowerCase().includes(f) ||
            row.supplier.toLowerCase().includes(f)
          }
        />
      </Card>
    </div>
  )
}
