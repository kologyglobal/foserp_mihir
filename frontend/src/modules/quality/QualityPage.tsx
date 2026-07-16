import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { SearchInput } from '../../components/ui/SearchInput'
import { DataTable } from '../../components/tables/DataTable'
import { qcInspections, ncrs } from '@/data/quality/legacyDemo'
import type { QCInspection, NCR } from '../../types/erp'
import { formatDate } from '../../utils/dates/format'
export function QualityPage() {
  const [inspectionSearch, setInspectionSearch] = useState('')
  const [ncrSearch, setNcrSearch] = useState('')

  const inspectionColumns: ColumnDef<QCInspection, unknown>[] = [
    {
      accessorKey: 'inspectionNo',
      header: 'Inspection No',
      cell: ({ row }) => (
        <span className="font-medium text-slate-800">{row.original.inspectionNo}</span>
      ),
    },
    { accessorKey: 'woNo', header: 'Work Order' },
    { accessorKey: 'productName', header: 'Product' },
    { accessorKey: 'inspectionType', header: 'Type' },
    { accessorKey: 'inspector', header: 'Inspector' },
    {
      accessorKey: 'scheduledDate',
      header: 'Scheduled',
      cell: ({ row }) => formatDate(row.original.scheduledDate),
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
      accessorKey: 'defectsFound',
      header: 'Defects',
      cell: ({ row }) => (
        <span
          className={
            row.original.defectsFound > 0 ? 'font-semibold text-red-600' : ''
          }
        >
          {row.original.defectsFound}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          {row.original.status === 'pending' && (
            <Button variant="primary" size="sm">
              Start Inspection
            </Button>
          )}
          {row.original.status === 'in-progress' && (
            <>
              <Button variant="success" size="sm" title="Pass inspection">
                <CheckCircle className="h-3.5 w-3.5" />
                Pass
              </Button>
              <Button variant="danger" size="sm" title="Fail inspection">
                <XCircle className="h-3.5 w-3.5" />
                Fail
              </Button>
            </>
          )}
          {row.original.status === 'failed' && (
            <Button variant="secondary" size="sm" title="Send for rework">
              <RotateCcw className="h-3.5 w-3.5" />
              Rework
            </Button>
          )}
        </div>
      ),
    },
  ]

  const ncrColumns: ColumnDef<NCR, unknown>[] = [
    {
      accessorKey: 'ncrNo',
      header: 'NCR No',
      cell: ({ row }) => (
        <span className="font-medium text-slate-800">{row.original.ncrNo}</span>
      ),
    },
    { accessorKey: 'woNo', header: 'Work Order' },
    { accessorKey: 'defectType', header: 'Defect Type' },
    {
      accessorKey: 'severity',
      header: 'Severity',
      cell: ({ row }) => (
        <Badge color={statusColor(row.original.severity)}>
          {formatStatus(row.original.severity)}
        </Badge>
      ),
    },
    { accessorKey: 'reportedBy', header: 'Reported By' },
    {
      accessorKey: 'reportedDate',
      header: 'Date',
      cell: ({ row }) => formatDate(row.original.reportedDate),
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
    { accessorKey: 'disposition', header: 'Disposition' },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          {row.original.status === 'open' && (
            <Button variant="primary" size="sm">
              Investigate
            </Button>
          )}
          {row.original.status === 'investigating' && (
            <Button variant="success" size="sm">
              Resolve
            </Button>
          )}
          {row.original.status === 'resolved' && (
            <Button variant="secondary" size="sm">
              Close NCR
            </Button>
          )}
        </div>
      ),
    },
  ]

  const pending = qcInspections.filter(
    (q) => q.status === 'pending' || q.status === 'in-progress',
  ).length
  const openNCRs = ncrs.filter((n) => n.status !== 'closed').length

  return (
    <div>
      <PageHeader
        title="Quality Assurance"
        description="Inspections, NCR management, and compliance"
        actions={
          <>
            <Button variant="secondary" size="sm">
              QC Reports
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New Inspection
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Total Inspections</p>
            <p className="text-2xl font-bold">{qcInspections.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Pending QC</p>
            <p className="text-2xl font-bold text-amber-600">{pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Open NCRs</p>
            <p className="text-2xl font-bold text-red-600">{openNCRs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500">Pass Rate</p>
            <p className="text-2xl font-bold text-emerald-600">
              {Math.round(
                (qcInspections.filter((q) => q.status === 'passed').length /
                  qcInspections.filter((q) =>
                    ['passed', 'failed'].includes(q.status),
                  ).length) *
                  100,
              ) || 0}
              %
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Inspection Schedule</CardTitle>
          <SearchInput
            value={inspectionSearch}
            onChange={setInspectionSearch}
            placeholder="Search inspections..."
            className="w-64"
          />
        </CardHeader>
        <DataTable
          data={qcInspections}
          columns={inspectionColumns}
          searchValue={inspectionSearch}
          globalFilterFn={(row, f) =>
            row.inspectionNo.toLowerCase().includes(f) ||
            row.woNo.toLowerCase().includes(f) ||
            row.inspectionType.toLowerCase().includes(f)
          }
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Non-Conformance Reports (NCR)</CardTitle>
          <SearchInput
            value={ncrSearch}
            onChange={setNcrSearch}
            placeholder="Search NCRs..."
            className="w-64"
          />
        </CardHeader>
        <DataTable
          data={ncrs}
          columns={ncrColumns}
          searchValue={ncrSearch}
          globalFilterFn={(row, f) =>
            row.ncrNo.toLowerCase().includes(f) ||
            row.woNo.toLowerCase().includes(f) ||
            row.defectType.toLowerCase().includes(f)
          }
        />
      </Card>
    </div>
  )
}
