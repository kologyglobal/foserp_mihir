import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Ban,
  CheckCircle2,
  Eye,
  PackageCheck,
  Pencil,
  Printer,
  RotateCw,
  Send,
} from 'lucide-react'
import { ErpDataGrid } from '../erp/ErpDataGrid'
import { TableLink } from '../ui/AppLink'
import { Badge } from '../ui/Badge'
import { StatusDot, type StatusDotTone } from '../design-system/StatusDot'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
  useDensityClass,
} from '../../design-system/enterprise'
import { CrmListFilterBar, type CrmListFilterBarProps } from '../crm/CrmListFilterBar'
import { purchaseStatusTone } from './purchaseCardFormShared'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { cn } from '../../utils/cn'
import type {
  PurchaseOrderApprovalStatus,
  PurchaseOrderDomainStatus,
  PurchaseOrderInvoiceStatus,
  PurchaseOrderListRow,
} from '../../types/purchaseDomain'
import {
  canPurchasePermission,
  getPurchasePermissionDenialReason,
} from '../../utils/permissions'

const REVISABLE_STATUSES: PurchaseOrderDomainStatus[] = [
  'released',
  'partially_received',
  'fully_received',
  'invoiced',
]

function poStatusDotTone(status: string): StatusDotTone {
  const tone = purchaseStatusTone(status)
  if (tone === 'critical') return 'danger'
  if (status === 'pending_approval') return 'warning'
  if (
    status === 'partially_received' ||
    status === 'fully_received' ||
    status === 'invoiced'
  ) {
    return 'info'
  }
  return tone
}

function invoiceStatusColor(
  status: PurchaseOrderInvoiceStatus,
): 'gray' | 'blue' | 'green' {
  if (status === 'fully_invoiced') return 'green'
  if (status === 'partially_invoiced') return 'blue'
  return 'gray'
}

function approvalStatusColor(
  status: PurchaseOrderApprovalStatus,
): 'gray' | 'yellow' | 'green' | 'red' {
  if (status === 'approved') return 'green'
  if (status === 'pending') return 'yellow'
  if (status === 'rejected') return 'red'
  return 'gray'
}

export interface PurchaseOrderRowHandlers {
  onView: (row: PurchaseOrderListRow) => void
  onEdit: (row: PurchaseOrderListRow) => void
  onRevise: (row: PurchaseOrderListRow) => void
  onPrint: (row: PurchaseOrderListRow) => void
  onSubmit: (row: PurchaseOrderListRow) => void
  onApprove: (row: PurchaseOrderListRow) => void
  onRelease: (row: PurchaseOrderListRow) => void
  onCancel: (row: PurchaseOrderListRow) => void
}

function buildRowActions(
  row: PurchaseOrderListRow,
  handlers: PurchaseOrderRowHandlers,
): RowActionItem[] {
  const status = row.status
  const isCancelled = status === 'cancelled'
  const isClosed = status === 'closed'
  const canEdit = status === 'draft'
  const canRevise = REVISABLE_STATUSES.includes(status)
  const canSubmit = status === 'draft'
  const canApprove = status === 'pending_approval'
  const canRelease = status === 'approved'
  const canCancel = !isCancelled && !isClosed

  const canEditPerm = canPurchasePermission('purchase.order.edit')
  const canApprovePerm = canPurchasePermission('purchase.order.approve')
  const canReleasePerm = canPurchasePermission('purchase.order.release')
  const canCancelPerm = canPurchasePermission('purchase.order.cancel')

  return [
    { id: 'view', label: 'View', icon: Eye, onClick: () => handlers.onView(row) },
    {
      id: 'edit',
      label: 'Edit',
      icon: Pencil,
      onClick: () => handlers.onEdit(row),
      disabled: !canEditPerm || !canEdit,
      disabledReason: !canEditPerm
        ? getPurchasePermissionDenialReason('purchase.order.edit')
        : canEdit
          ? undefined
          : 'Edit is only available for Draft orders',
    },
    {
      id: 'revise',
      label: 'Revise Order',
      icon: RotateCw,
      onClick: () => handlers.onRevise(row),
      disabled: !canEditPerm || !canRevise,
      disabledReason: !canEditPerm
        ? getPurchasePermissionDenialReason('purchase.order.edit')
        : canRevise
          ? undefined
          : 'Revise is only available once released',
    },
    { id: 'print', label: 'Print', icon: Printer, onClick: () => handlers.onPrint(row) },
    {
      id: 'submit',
      label: 'Submit for Approval',
      icon: Send,
      onClick: () => handlers.onSubmit(row),
      disabled: !canEditPerm || !canSubmit,
      disabledReason: !canEditPerm
        ? getPurchasePermissionDenialReason('purchase.order.edit')
        : canSubmit
          ? undefined
          : 'Only Draft orders can be submitted',
    },
    {
      id: 'approve',
      label: 'Approve',
      icon: CheckCircle2,
      onClick: () => handlers.onApprove(row),
      disabled: !canApprovePerm || !canApprove,
      disabledReason: !canApprovePerm
        ? getPurchasePermissionDenialReason('purchase.order.approve')
        : canApprove
          ? undefined
          : 'Only Pending Approval orders can be approved',
    },
    {
      id: 'release',
      label: 'Release',
      icon: PackageCheck,
      onClick: () => handlers.onRelease(row),
      disabled: !canReleasePerm || !canRelease,
      disabledReason: !canReleasePerm
        ? getPurchasePermissionDenialReason('purchase.order.release')
        : canRelease
          ? undefined
          : 'Only Approved orders can be released',
    },
    {
      id: 'cancel',
      label: 'Cancel',
      icon: Ban,
      onClick: () => handlers.onCancel(row),
      danger: true,
      disabled: !canCancelPerm || !canCancel,
      disabledReason: !canCancelPerm
        ? getPurchasePermissionDenialReason('purchase.order.cancel')
        : isCancelled
          ? 'Already cancelled'
          : isClosed
            ? 'Closed orders cannot be cancelled'
            : 'Cannot cancel this status',
    },
  ]
}

export interface PurchaseOrdersTableProps {
  rows: PurchaseOrderListRow[]
  registerFilter?: CrmListFilterBarProps
  handlers: PurchaseOrderRowHandlers
  busyId?: string | null
  emptyAction?: React.ReactNode
  hasActiveFilters?: boolean
  onClearFilters?: () => void
  onExport?: () => void
}

export function PurchaseOrdersTable({
  rows,
  registerFilter,
  handlers,
  busyId,
  emptyAction,
  hasActiveFilters,
  onClearFilters,
  onExport,
}: PurchaseOrdersTableProps) {
  const densityClass = useDensityClass()

  const columns: ColumnDef<PurchaseOrderListRow, unknown>[] = useMemo(
    () => [
      {
        accessorKey: 'documentNumber',
        header: 'PO Number',
        meta: { columnLabel: 'PO Number' },
        cell: ({ row }) => (
          <div className="min-w-[8.5rem]">
            <TableLink
              to={`/purchase/orders/${row.original.id}`}
              className="ent-record-cell__id font-mono"
            >
              {row.original.documentNumber}
            </TableLink>
            {row.original.revisionNo > 0 ? (
              <div className="ent-record-cell__meta mt-0.5">Rev {row.original.revisionNo}</div>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'documentDate',
        header: 'PO Date',
        meta: { columnLabel: 'PO Date' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-erp-text">
            {formatDate(row.original.documentDate)}
          </span>
        ),
      },
      {
        accessorKey: 'vendorName',
        header: 'Vendor',
        meta: { columnLabel: 'Vendor' },
        cell: ({ row }) => (
          <div className="min-w-[10rem]">
            <span className="whitespace-nowrap">{row.original.vendorName}</span>
            {row.original.vendorGstin ? (
              <div className="ent-record-cell__meta mt-0.5 font-mono">
                {row.original.vendorGstin}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'locationName',
        header: 'Location',
        meta: { columnLabel: 'Location' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.locationName || '—'}</span>
        ),
      },
      {
        accessorKey: 'buyerName',
        header: 'Buyer',
        meta: { columnLabel: 'Buyer' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.buyerName || '—'}</span>
        ),
      },
      {
        accessorKey: 'expectedDeliveryDate',
        header: 'Expected Delivery',
        meta: { columnLabel: 'Expected Delivery' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-erp-text">
            {formatDate(row.original.expectedDeliveryDate)}
          </span>
        ),
      },
      {
        accessorKey: 'basicAmount',
        header: 'Basic',
        meta: { align: 'right', columnLabel: 'Basic Amount' },
        cell: ({ row }) => (
          <span className="tabular-nums">{formatCurrency(row.original.basicAmount)}</span>
        ),
      },
      {
        accessorKey: 'taxAmount',
        header: 'Tax',
        meta: { align: 'right', columnLabel: 'Tax Amount' },
        cell: ({ row }) => (
          <span className="tabular-nums">{formatCurrency(row.original.taxAmount)}</span>
        ),
      },
      {
        accessorKey: 'totalAmount',
        header: 'Total',
        meta: { align: 'right', columnLabel: 'Total Amount' },
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatCurrency(row.original.totalAmount)}
          </span>
        ),
      },
      {
        accessorKey: 'receivedPercentage',
        header: 'Received %',
        meta: { align: 'right', columnLabel: 'Received %' },
        cell: ({ row }) => (
          <span className="tabular-nums">{Math.round(row.original.receivedPercentage)}%</span>
        ),
      },
      {
        accessorKey: 'invoiceStatus',
        header: 'Invoice',
        meta: { columnLabel: 'Invoice Status' },
        cell: ({ row }) => (
          <Badge
            color={invoiceStatusColor(row.original.invoiceStatus)}
            className="ent-status-chip !normal-case tracking-normal"
          >
            {row.original.invoiceStatusLabel}
          </Badge>
        ),
      },
      {
        accessorKey: 'approvalStatus',
        header: 'Approval',
        meta: { columnLabel: 'Approval Status' },
        cell: ({ row }) => (
          <Badge
            color={approvalStatusColor(row.original.approvalStatus)}
            className="ent-status-chip !normal-case tracking-normal"
          >
            {row.original.approvalStatusLabel}
          </Badge>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: { columnLabel: 'PO Status' },
        cell: ({ row }) => (
          <StatusDot
            label={row.original.statusLabel}
            tone={poStatusDotTone(row.original.status)}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const po = row.original
          return (
            <div
              className={busyId === po.id ? 'pointer-events-none opacity-50' : undefined}
              onClick={(e) => e.stopPropagation()}
            >
              <EnterpriseRowActionsMenu actions={buildRowActions(po, handlers)} />
            </div>
          )
        },
      },
    ],
    [busyId, handlers],
  )

  const emptyMessage = hasActiveFilters
    ? 'No purchase orders match current filters.'
    : 'No purchase orders yet.'

  return (
    <ErpDataGrid
      className={cn('erp-po-table', densityClass)}
      data={rows}
      columns={columns}
      recordLabel="Purchase Orders"
      emptyMessage={emptyMessage}
      emptyAction={
        emptyAction ??
        (hasActiveFilters && onClearFilters ? (
          <button
            type="button"
            className="text-[13px] font-semibold text-erp-primary"
            onClick={onClearFilters}
          >
            Clear Filters
          </button>
        ) : undefined)
      }
      stickyFirstColumn
      showCompactSearch={false}
      enableColumnSorting={false}
      exportFileName="purchase-orders"
      onExport={onExport}
      getRowId={(r) => r.id}
      onRowQuickView={handlers.onView}
      registerBar={
        registerFilter ? (
          <CrmListFilterBar {...registerFilter} className="crm-list-filter-bar--embedded" />
        ) : undefined
      }
    />
  )
}
