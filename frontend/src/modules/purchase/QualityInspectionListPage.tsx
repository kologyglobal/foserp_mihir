import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { ClipboardCheck, Eye, Plus, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { PurchaseSimpleListFilterBar } from '@/components/purchase/PurchaseSimpleListFilterBar'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpDataGrid } from '@/components/erp/ErpDataGrid'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
} from '@/design-system/enterprise/EnterpriseTablePrimitives'
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
        meta: { columnLabel: 'Inspection No.' },
        cell: ({ row }) => (
          <TableLink
            to={`/purchase/quality-inspections/${row.original.id}`}
            className="font-mono"
          >
            {row.original.documentNumber || '—'}
          </TableLink>
        ),
      },
      {
        accessorKey: 'documentDate',
        header: 'Date',
        meta: { columnLabel: 'Date' },
        cell: ({ row }) => formatDate(row.original.documentDate) || '—',
      },
      {
        accessorKey: 'goodsReceiptNumber',
        header: 'GRN',
        meta: { columnLabel: 'GRN' },
        cell: ({ row }) =>
          row.original.goodsReceiptId ? (
            <TableLink to={`/purchase/grn/${row.original.goodsReceiptId}`} className="font-mono">
              {row.original.goodsReceiptNumber || 'Open GRN'}
            </TableLink>
          ) : (
            '—'
          ),
      },
      {
        accessorKey: 'itemCode',
        header: 'Item',
        meta: { columnLabel: 'Item' },
        cell: ({ row }) => (
          <div>
            <div className="font-mono text-xs">{row.original.itemCode || '—'}</div>
            <div className="text-erp-muted">{row.original.itemName || ''}</div>
          </div>
        ),
      },
      {
        accessorKey: 'batchLotNo',
        header: 'Batch / Lot',
        meta: { columnLabel: 'Batch / Lot' },
        cell: ({ row }) => row.original.batchLotNo || '—',
      },
      {
        accessorKey: 'receivedQty',
        header: 'Received',
        meta: { columnLabel: 'Received' },
        cell: ({ row }) => formatNumber(row.original.receivedQty),
      },
      {
        accessorKey: 'sampleQty',
        header: 'Sample',
        meta: { columnLabel: 'Sample' },
        cell: ({ row }) => formatNumber(row.original.sampleQty),
      },
      {
        accessorKey: 'inspectorName',
        header: 'Inspector',
        meta: { columnLabel: 'Inspector' },
        cell: ({ row }) => row.original.inspectorName || '—',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: { columnLabel: 'Status' },
        cell: ({ row }) => (
          <StatusDot
            tone={statusToneFromLabel(row.original.statusLabel)}
            label={row.original.statusLabel || '—'}
          />
        ),
      },
      {
        accessorKey: 'resultLabel',
        header: 'Result',
        meta: { columnLabel: 'Result' },
        cell: ({ row }) => row.original.resultLabel ?? '—',
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original
          const actions: RowActionItem[] = [
            {
              id: 'view',
              label: 'View',
              icon: Eye,
              onClick: () => navigate(`/purchase/quality-inspections/${r.id}`),
            },
            {
              id: 'grn',
              label: 'Open GRN',
              icon: ClipboardCheck,
              onClick: () => navigate(`/purchase/grn/${r.goodsReceiptId}`),
              disabled: !r.goodsReceiptId,
            },
          ]
          return <EnterpriseRowActionsMenu actions={actions} />
        },
      },
    ],
    [navigate],
  )

  const createHref = grnFilter
    ? `/purchase/quality-inspections/new?grnId=${encodeURIComponent(grnFilter)}`
    : '/purchase/quality-inspections/new'

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
            perms.canInspectQuality
              ? {
                  id: 'create',
                  label: grnFilter ? 'Create Inspection' : 'New Inspection',
                  icon: Plus,
                  onClick: () => navigate(createHref),
                }
              : undefined
          }
          secondaryActions={[
            {
              id: 'grn',
              label: 'GRN Register',
              icon: ClipboardCheck,
              onClick: () => navigate(grnFilter ? `/purchase/grn/${grnFilter}` : '/purchase/grn'),
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
          title={grnFilter ? 'No inspection for this GRN yet' : 'No quality inspections'}
          description={
            grnFilter
              ? 'This goods receipt is pending inspection. Create a quality inspection to record accept / reject quantities.'
              : 'Submit a GRN that requires inspection, then create a QI document.'
          }
          action={
            perms.canInspectQuality ? (
              <button
                type="button"
                className="erp-btn erp-btn--primary text-[13px]"
                onClick={() => navigate(createHref)}
              >
                {grnFilter ? 'Create inspection' : 'New inspection'}
              </button>
            ) : undefined
          }
        />
      ) : (
        <EnterpriseRegisterTableShell className="min-w-0">
          <ErpDataGrid
            data={filtered}
            columns={columns}
            showCompactSearch={false}
            enableColumnSorting={false}
            stickyFirstColumn
            emptyMessage="No quality inspections match current filters."
            getRowId={(r) => r.id}
          />
        </EnterpriseRegisterTableShell>
      )}
    </OperationalPageShell>
  )
}
