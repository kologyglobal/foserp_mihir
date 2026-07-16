import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Play, Pause, CheckCircle } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { SearchInput } from '../../components/ui/SearchInput'
import { DataTable } from '../../components/tables/DataTable'
import { workOrders, productionStages } from '@/data/production/legacyDemo'
import type { WorkOrder, ProductionStage } from '../../types/erp'
import { formatDate } from '../../utils/dates/format'
export function ProductionPage() {
  const [search, setSearch] = useState('')
  const [stageSearch, setStageSearch] = useState('')

  const woColumns: ColumnDef<WorkOrder, unknown>[] = [
    {
      accessorKey: 'woNo',
      header: 'Work Order',
      cell: ({ row }) => (
        <span className="font-medium text-slate-800">{row.original.woNo}</span>
      ),
    },
    { accessorKey: 'salesOrderNo', header: 'Sales Order' },
    { accessorKey: 'productName', header: 'Product' },
    {
      accessorKey: 'quantity',
      header: 'Qty',
      cell: ({ row }) => `${row.original.quantity} units`,
    },
    { accessorKey: 'bay', header: 'Bay' },
    { accessorKey: 'currentStage', header: 'Current Stage' },
    {
      accessorKey: 'progress',
      header: 'Progress',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-erp-accent"
              style={{ width: `${row.original.progress}%` }}
            />
          </div>
          <span className="text-xs font-medium">{row.original.progress}%</span>
        </div>
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
    { accessorKey: 'supervisor', header: 'Supervisor' },
    {
      accessorKey: 'plannedEnd',
      header: 'Planned End',
      cell: ({ row }) => formatDate(row.original.plannedEnd),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          {row.original.status === 'planned' && (
            <Button variant="primary" size="sm" title="Release work order">
              <Play className="h-3.5 w-3.5" />
              Release
            </Button>
          )}
          {row.original.status === 'in-progress' && (
            <>
              <Button variant="secondary" size="sm" title="Hold production">
                <Pause className="h-3.5 w-3.5" />
              </Button>
              <Button variant="success" size="sm" title="Complete stage">
                <CheckCircle className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {row.original.status === 'on-hold' && (
            <Button variant="primary" size="sm">
              Resume
            </Button>
          )}
          {row.original.status === 'qc-pending' && (
            <Button variant="success" size="sm">
              Send to QC
            </Button>
          )}
        </div>
      ),
    },
  ]

  const stageColumns: ColumnDef<ProductionStage, unknown>[] = [
    { accessorKey: 'woNo', header: 'Work Order' },
    { accessorKey: 'stage', header: 'Stage' },
    { accessorKey: 'operator', header: 'Operator' },
    { accessorKey: 'startTime', header: 'Start' },
    {
      accessorKey: 'endTime',
      header: 'End',
      cell: ({ row }) => row.original.endTime ?? '—',
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
          {row.original.status === 'active' && (
            <Button variant="success" size="sm">
              Complete Stage
            </Button>
          )}
          {row.original.status === 'pending' && (
            <Button variant="primary" size="sm">
              Start
            </Button>
          )}
        </div>
      ),
    },
  ]

  const wipCount = workOrders.filter(
    (w) => w.status === 'in-progress' || w.status === 'released',
  ).length

  return (
    <div>
      <PageHeader
        title="Production Control"
        description="Work orders and shop floor tracking"
        actions={
          <>
            <Button variant="secondary" size="sm">
              Shop Floor View
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Create Work Order
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Active Work Orders</p>
            <p className="text-2xl font-bold">{workOrders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">WIP</p>
            <p className="text-2xl font-bold text-blue-600">{wipCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">On Hold</p>
            <p className="text-2xl font-bold text-red-600">
              {workOrders.filter((w) => w.status === 'on-hold').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">QC Pending</p>
            <p className="text-2xl font-bold text-amber-600">
              {workOrders.filter((w) => w.status === 'qc-pending').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Work Order Register</CardTitle>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search work orders..."
            className="w-64"
          />
        </CardHeader>
        <DataTable
          data={workOrders}
          columns={woColumns}
          searchValue={search}
          globalFilterFn={(row, f) =>
            row.woNo.toLowerCase().includes(f) ||
            row.productName.toLowerCase().includes(f) ||
            row.salesOrderNo.toLowerCase().includes(f) ||
            row.bay.toLowerCase().includes(f)
          }
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shop Floor — Active Stages</CardTitle>
          <SearchInput
            value={stageSearch}
            onChange={setStageSearch}
            placeholder="Search stages..."
            className="w-64"
          />
        </CardHeader>
        <DataTable
          data={productionStages}
          columns={stageColumns}
          searchValue={stageSearch}
          globalFilterFn={(row, f) =>
            row.woNo.toLowerCase().includes(f) ||
            row.stage.toLowerCase().includes(f) ||
            row.operator.toLowerCase().includes(f)
          }
        />
      </Card>
    </div>
  )
}
