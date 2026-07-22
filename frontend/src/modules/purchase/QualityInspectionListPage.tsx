import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { ClipboardCheck, Eye, Plus, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { PurchaseSimpleListFilterBar } from '@/components/purchase/PurchaseSimpleListFilterBar'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getQualityInspectionList,
  QUALITY_INSPECTION_STATUS_LABELS,
  QUALITY_INSPECTION_STATUSES,
} from '@/services/purchase'
import type { QualityInspectionListRow, QualityInspectionStatus } from '@/types/purchaseDomain'
import { formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { purchaseBreadcrumbs } from '@/utils/purchaseNavigation'
import { usePurchasePermissions } from '@/utils/permissions'

export function QualityInspectionListPage() {
  const navigate = useNavigate()
  const perms = usePurchasePermissions()
  const [searchParams] = useSearchParams()
  const grnFilter = searchParams.get('grnId') ?? ''
  const [rows, setRows] = useState<QualityInspectionListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await getQualityInspectionList(grnFilter || undefined))
    } finally {
      setLoading(false)
    }
  }, [grnFilter])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    let list = [...rows]
    if (status) list = list.filter((r) => r.status === status)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (r) =>
          r.documentNumber.toLowerCase().includes(q) ||
          r.goodsReceiptNumber.toLowerCase().includes(q) ||
          r.itemCode.toLowerCase().includes(q) ||
          r.itemName.toLowerCase().includes(q) ||
          r.batchLotNo.toLowerCase().includes(q),
      )
    }
    return list
  }, [rows, search, status])

  const columns = useMemo<ColumnDef<QualityInspectionListRow>[]>(
    () => [
      {
        accessorKey: 'documentNumber',
        header: 'Inspection No.',
        cell: ({ row }) => (
          <TableLink
            to={`/purchase/quality-inspections/${row.original.id}`}
            className="font-mono"
          >
            {row.original.documentNumber}
          </TableLink>
        ),
      },
      {
        accessorKey: 'documentDate',
        header: 'Date',
        cell: ({ row }) => formatDate(row.original.documentDate),
      },
      {
        accessorKey: 'goodsReceiptNumber',
        header: 'GRN',
        cell: ({ row }) => (
          <TableLink to={`/purchase/grn/${row.original.goodsReceiptId}`} className="font-mono">
            {row.original.goodsReceiptNumber}
          </TableLink>
        ),
      },
      {
        accessorKey: 'itemCode',
        header: 'Item',
        cell: ({ row }) => (
          <div>
            <div className="font-mono text-xs">{row.original.itemCode}</div>
            <div className="text-erp-muted">{row.original.itemName}</div>
          </div>
        ),
      },
      { accessorKey: 'batchLotNo', header: 'Batch / Lot' },
      {
        accessorKey: 'receivedQty',
        header: 'Received',
        cell: ({ row }) => formatNumber(row.original.receivedQty),
      },
      {
        accessorKey: 'sampleQty',
        header: 'Sample',
        cell: ({ row }) => formatNumber(row.original.sampleQty),
      },
      { accessorKey: 'inspectorName', header: 'Inspector' },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusDot
            tone={statusToneFromLabel(row.original.statusLabel)}
            label={row.original.statusLabel}
          />
        ),
      },
      {
        accessorKey: 'resultLabel',
        header: 'Result',
        cell: ({ row }) => row.original.resultLabel ?? '—',
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm text-erp-primary"
            onClick={() => navigate(`/purchase/quality-inspections/${row.original.id}`)}
          >
            <Eye className="h-4 w-4" /> Open
          </button>
        ),
      },
    ],
    [navigate],
  )

  return (
    <OperationalPageShell
      title="Quality Inspections"
      description="Incoming inspection against goods receipts"
      badge="Purchase"
      variant="dynamics"
      breadcrumbs={purchaseBreadcrumbs('Quality Inspections')}
      favoritePath="/purchase/quality-inspections"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            grnFilter && perms.canInspectQuality
              ? {
                  id: 'create',
                  label: 'Create Inspection',
                  icon: Plus,
                  onClick: () =>
                    navigate(`/purchase/quality-inspections/new?grnId=${encodeURIComponent(grnFilter)}`),
                }
              : undefined
          }
          secondaryActions={[
            {
              id: 'grn',
              label: 'GRN Register',
              icon: ClipboardCheck,
              onClick: () => navigate('/purchase/grn'),
            },
            {
              id: 'refresh',
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => void load(),
            },
          ]}
        />
      }
    >
      <PurchaseSimpleListFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search QI / GRN / item / batch"
        status={status}
        onStatusChange={setStatus}
        statusAriaLabel="Filter quality inspections by status"
        statusOptions={QUALITY_INSPECTION_STATUSES.map((s) => ({
          value: s,
          label: QUALITY_INSPECTION_STATUS_LABELS[s as QualityInspectionStatus],
        }))}
      />

      {loading && rows.length === 0 ? (
        <LoadingState variant="table" rows={8} cols={7} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No quality inspections"
          description={
            grnFilter
              ? 'Create an inspection for this goods receipt.'
              : 'Submit a GRN that requires inspection to create a QI document.'
          }
          action={
            grnFilter && perms.canInspectQuality ? (
              <button
                type="button"
                className="text-sm font-medium text-erp-primary"
                onClick={() =>
                  navigate(`/purchase/quality-inspections/new?grnId=${encodeURIComponent(grnFilter)}`)
                }
              >
                Create inspection
              </button>
            ) : undefined
          }
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </OperationalPageShell>
  )
}
