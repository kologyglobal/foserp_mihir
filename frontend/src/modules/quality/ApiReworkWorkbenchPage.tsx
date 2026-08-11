import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DataGrid } from '@/components/design-system/DataGrid'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { StatusDot } from '@/components/design-system/StatusDot'
import { TableLink } from '@/components/ui/AppLink'
import { listInspections, type QualityInspection } from '@/services/api/qualityApi'
import { notify } from '@/store/toastStore'
import { formatDateTime } from '@/utils/dates/format'

/**
 * Live Rework Workbench — inspections decided as REWORK that still need
 * re-inspection / final disposition (API mode).
 *
 * There is no separate rework-WO document in Quality Phase 4A; rework is the
 * inspection status after a REWORK decision. Operators open the inspection to
 * re-decide PASS / REJECT / REWORK again.
 */
export function ApiReworkWorkbenchPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<QualityInspection[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listInspections({ status: 'REWORK', limit: 100 })
      setRows(res.data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load rework queue')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const columns = useMemo<ColumnDef<QualityInspection, unknown>[]>(
    () => [
      {
        id: 'inspectionNumber',
        accessorKey: 'inspectionNumber',
        header: 'Inspection',
        enableHiding: false,
        cell: ({ row }) => (
          <TableLink to={`/quality/inspections/${row.original.id}`}>{row.original.inspectionNumber}</TableLink>
        ),
      },
      {
        id: 'category',
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) => row.original.category.replace(/_/g, ' '),
      },
      {
        id: 'workOrder',
        header: 'Work Order',
        accessorFn: (r) => r.productionOrderNumber ?? '',
        cell: ({ row }) =>
          row.original.productionOrderId ? (
            <Link to={`/manufacturing/work-orders/${row.original.productionOrderId}`} className="text-erp-primary hover:underline">
              View WO
            </Link>
          ) : (
            '-'
          ),
      },
      { id: 'title', accessorKey: 'title', header: 'Title' },
      {
        id: 'reworkQty',
        accessorKey: 'reworkQty',
        header: 'Rework qty',
        meta: { align: 'right' },
        cell: ({ row }) => row.original.reworkQty ?? '-',
      },
      {
        id: 'decidedAt',
        accessorKey: 'decidedAt',
        header: 'Decided',
        cell: ({ row }) => (row.original.decidedAt ? formatDateTime(row.original.decidedAt) : '-'),
      },
      {
        id: 'status',
        header: 'Status',
        enableHiding: false,
        enableSorting: false,
        cell: () => <StatusDot label="rework" tone="warning" />,
      },
    ],
    [],
  )

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Quality"
      title="Rework Workbench"
      description="Inspections sent for rework — open to re-inspect and decide PASS, REJECT, or REWORK again."
      breadcrumbs={[{ label: 'Quality', to: '/quality' }, { label: 'Rework' }]}
      autoBreadcrumbs={false}
      favoritePath="/quality/rework"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'queue', label: 'QC Queue', onClick: () => navigate('/quality/queue') },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      }
    >
      <EnterpriseRegisterTableShell className="min-w-0 flex-1">
        <DataGrid<QualityInspection>
          data={rows}
          columns={columns}
          getRowId={(r) => r.id}
          loading={loading}
          columnLayoutKey="/quality/rework"
          emptyMessage="No open rework — inspections decided as REWORK will appear here until re-decided."
        />
      </EnterpriseRegisterTableShell>
    </OperationalPageShell>
  )
}
