import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { ClipboardCheck, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DataGrid } from '@/components/design-system/DataGrid'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { StatusDot } from '@/components/design-system/StatusDot'
import { TableLink } from '@/components/ui/AppLink'
import { listInspections, type QualityInspection } from '@/services/api/qualityApi'
import { notify } from '@/store/toastStore'
import { formatDateTime } from '@/utils/dates/format'

/** API-mode thin QC queue — pending in-process and final inspections. */
export function ApiQcQueuePage() {
  const [rows, setRows] = useState<QualityInspection[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listInspections({ status: 'PENDING', limit: 100 })
      setRows(res.data.filter((i) => i.category === 'IN_PROCESS' || i.category === 'FINAL'))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load QC queue')
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
        cell: ({ row }) =>
          row.original.category === 'IN_PROCESS'
            ? 'In-process'
            : row.original.category === 'FINAL'
              ? 'Final'
              : row.original.category.replace(/_/g, ' '),
      },
      {
        id: 'workOrder',
        header: 'Work Order',
        accessorFn: (r) => r.productionOrderNumber ?? '',
        cell: ({ row }) =>
          row.original.productionOrderId ? (
            <Link
              to={`/manufacturing/work-orders/${row.original.productionOrderId}`}
              className="font-semibold text-erp-primary hover:underline"
            >
              {row.original.productionOrderNumber || 'Open work order'}
            </Link>
          ) : (
            '-'
          ),
      },
      { id: 'title', accessorKey: 'title', header: 'Title' },
      {
        id: 'requestedAt',
        accessorKey: 'requestedAt',
        header: 'Requested',
        cell: ({ row }) => formatDateTime(row.original.requestedAt),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        enableHiding: false,
        cell: ({ row }) => <StatusDot label={row.original.status.toLowerCase()} tone="warning" />,
      },
    ],
    [],
  )

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Quality"
      title="QC Queue"
      description="Pending manufacturing inspections awaiting decision (API mode)."
      breadcrumbs={[{ label: 'Quality', to: '/quality' }, { label: 'QC Queue' }]}
      autoBreadcrumbs={false}
      favoritePath="/quality/queue"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <EnterpriseRegisterTableShell className="min-w-0 flex-1">
        <DataGrid<QualityInspection>
          data={rows}
          columns={columns}
          getRowId={(r) => r.id}
          loading={loading}
          columnLayoutKey="/quality/queue"
          emptyMessage="No pending inspections — all caught up on in-process and final QC."
          emptyAction={
            <span className="inline-flex items-center gap-1 text-[12px] text-erp-muted">
              <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
            </span>
          }
        />
      </EnterpriseRegisterTableShell>
    </OperationalPageShell>
  )
}
