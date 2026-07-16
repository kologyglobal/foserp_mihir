import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, Download, CheckCircle, Eye } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { Card, CardHeader, CardTitle } from '../../components/ui/Card'
import { SearchInput } from '../../components/ui/SearchInput'
import { DataTable } from '../../components/tables/DataTable'
import { bomItems, drawings, ecos } from '@/data/bom/legacyEngineering'
import type { BOMItem, EngineeringDrawing, ECO } from '../../types/erp'
import { formatDate } from '../../utils/dates/format'
import { productMap } from '@/data/masters/legacyProducts'

export function EngineeringPage() {
  const [bomSearch, setBomSearch] = useState('')
  const [drawingSearch, setDrawingSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'bom' | 'drawings' | 'eco'>('bom')

  const bomColumns: ColumnDef<BOMItem, unknown>[] = [
    {
      accessorKey: 'productCode',
      header: 'Product',
      cell: ({ row }) => productMap[row.original.productCode]?.name ?? row.original.productCode,
    },
    {
      accessorKey: 'itemCode',
      header: 'Item Code',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.itemCode}</span>
      ),
    },
    { accessorKey: 'description', header: 'Description' },
    {
      accessorKey: 'quantity',
      header: 'Qty',
      cell: ({ row }) => `${row.original.quantity} ${row.original.uom}`,
    },
    { accessorKey: 'materialGrade', header: 'Material Grade' },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: () => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" title="View BOM line">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" title="Download spec">
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  const drawingColumns: ColumnDef<EngineeringDrawing, unknown>[] = [
    {
      accessorKey: 'drawingNo',
      header: 'Drawing No',
      cell: ({ row }) => (
        <span className="font-medium text-slate-800">{row.original.drawingNo}</span>
      ),
    },
    {
      accessorKey: 'productCode',
      header: 'Product',
      cell: ({ row }) => productMap[row.original.productCode]?.name,
    },
    { accessorKey: 'title', header: 'Title' },
    { accessorKey: 'revision', header: 'Rev' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge color={statusColor(row.original.status)}>
          {formatStatus(row.original.status)}
        </Badge>
      ),
    },
    { accessorKey: 'engineer', header: 'Engineer' },
    {
      accessorKey: 'lastUpdated',
      header: 'Updated',
      cell: ({ row }) => formatDate(row.original.lastUpdated),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" title="View drawing">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {row.original.status === 'approved' && (
            <Button variant="ghost" size="sm" title="Release drawing">
              <CheckCircle className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" title="Download PDF">
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  const ecoColumns: ColumnDef<ECO, unknown>[] = [
    {
      accessorKey: 'ecoNo',
      header: 'ECO No',
      cell: ({ row }) => (
        <span className="font-medium text-slate-800">{row.original.ecoNo}</span>
      ),
    },
    {
      accessorKey: 'productCode',
      header: 'Product',
      cell: ({ row }) => productMap[row.original.productCode]?.name,
    },
    { accessorKey: 'title', header: 'Change Description' },
    { accessorKey: 'reason', header: 'Reason' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge color={statusColor(row.original.status)}>
          {formatStatus(row.original.status)}
        </Badge>
      ),
    },
    { accessorKey: 'requestedBy', header: 'Requested By' },
    {
      accessorKey: 'targetDate',
      header: 'Target Date',
      cell: ({ row }) => formatDate(row.original.targetDate),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" title="Review ECO">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {row.original.status === 'under-review' && (
            <Button variant="success" size="sm">
              Approve
            </Button>
          )}
        </div>
      ),
    },
  ]

  const tabs = [
    { id: 'bom' as const, label: 'Bill of Materials', count: bomItems.length },
    { id: 'drawings' as const, label: 'Drawings', count: drawings.length },
    { id: 'eco' as const, label: 'Engineering Change Orders', count: ecos.length },
  ]

  return (
    <div>
      <PageHeader
        title="Engineering"
        description="BOM management, drawings, and engineering change control"
        actions={
          <>
            <Button variant="secondary" size="sm">
              Export BOM
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New ECO
            </Button>
          </>
        }
      />

      <div className="mb-4 flex gap-1 rounded-lg border border-erp-border bg-white p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-erp-accent text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {activeTab === 'bom' && (
        <Card>
          <CardHeader>
            <CardTitle>Bill of Materials — Trailer Products</CardTitle>
            <SearchInput
              value={bomSearch}
              onChange={setBomSearch}
              placeholder="Search BOM..."
              className="w-64"
            />
          </CardHeader>
          <DataTable
            data={bomItems}
            columns={bomColumns}
            searchValue={bomSearch}
            globalFilterFn={(row, f) =>
              row.itemCode.toLowerCase().includes(f) ||
              row.description.toLowerCase().includes(f)
            }
          />
        </Card>
      )}

      {activeTab === 'drawings' && (
        <Card>
          <CardHeader>
            <CardTitle>Engineering Drawings</CardTitle>
            <SearchInput
              value={drawingSearch}
              onChange={setDrawingSearch}
              placeholder="Search drawings..."
              className="w-64"
            />
          </CardHeader>
          <DataTable
            data={drawings}
            columns={drawingColumns}
            searchValue={drawingSearch}
            globalFilterFn={(row, f) =>
              row.drawingNo.toLowerCase().includes(f) ||
              row.title.toLowerCase().includes(f)
            }
          />
        </Card>
      )}

      {activeTab === 'eco' && (
        <Card>
          <CardHeader>
            <CardTitle>Engineering Change Orders</CardTitle>
          </CardHeader>
          <DataTable data={ecos} columns={ecoColumns} />
        </Card>
      )}
    </div>
  )
}
