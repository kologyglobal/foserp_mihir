import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Ban,
  Eye,
  PackagePlus,
  Pencil,
  Printer,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react'
import { ErpDataGrid } from '../erp/ErpDataGrid'
import { TableLink } from '../ui/AppLink'
import { StatusBadge } from '../../design-system/list-page'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
  useDensityClass,
} from '../../design-system/enterprise'
import { CrmListFilterBar, type CrmListFilterBarProps } from '../crm/CrmListFilterBar'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { cn } from '../../utils/cn'
import type {
  PurchaseOrderDomainStatus,
  PurchaseOrderListRow,
} from '../../types/purchaseDomain'
import {
  canPurchasePermission,
  getPurchasePermissionDenialReason,
} from '../../utils/permissions'

export interface PurchaseOrderRowHandlers {
  onView: (row: PurchaseOrderListRow) => void
  onEdit: (row: PurchaseOrderListRow) => void
  onSubmit: (row: PurchaseOrderListRow) => void
  onPrint: (row: PurchaseOrderListRow) => void
  onCreateGrn: (row: PurchaseOrderListRow) => void
  onReopen: (row: PurchaseOrderListRow) => void
  /** Withdraws a Pending Approved order back to Open. */
  onCancel: (row: PurchaseOrderListRow) => void
  onDelete: (row: PurchaseOrderListRow) => void
}

const PO_RECEIVABLE_STATUSES: PurchaseOrderDomainStatus[] = [
  'approved',
  'released',
  'partially_received',
  'fully_received',
  'invoiced',
]

function buildRowActions(
  row: PurchaseOrderListRow,
  handlers: PurchaseOrderRowHandlers,
  requireApprovalOnPo: boolean,
): RowActionItem[] {
  const status = row.status
  const canEdit = status === 'draft' || status === 'sent_back'
  const canSubmit = canEdit
  /** Cancel withdraws approval — Pending Approved returns to Open. Released cannot cancel. */
  const canCancel = status === 'pending_approval'
  const canReopen =
    status === 'closed' || status === 'rejected' || status === 'cancelled'
  /** Hard delete only for Open (draft); destructive path stays on detail for other statuses. */
  const canDelete = status === 'draft'
  const statusLabel = row.statusLabel || status

  const canEditPerm = canPurchasePermission('purchase.po.edit')
  const canCancelPerm = canPurchasePermission('purchase.po.cancel')
  const canCreateGrnPerm = canPurchasePermission('purchase.grn.create')
  const canCreateGrn =
    PO_RECEIVABLE_STATUSES.includes(status) && row.receivedPercentage < 100

  return [
    { id: 'view', label: 'View', icon: Eye, onClick: () => handlers.onView(row) },
    {
      id: 'edit',
      label: 'Edit',
      icon: Pencil,
      onClick: () => handlers.onEdit(row),
      disabled: !canEditPerm || !canEdit,
      disabledReason: !canEditPerm
        ? getPurchasePermissionDenialReason('purchase.po.edit')
        : `${statusLabel} purchase orders cannot be edited`,
    },
    // Approval can be switched off in Purchase Setup — then Open goes straight to Release.
    ...(requireApprovalOnPo
      ? [
          {
            id: 'submit',
            label: 'Send for Approval',
            icon: Send,
            onClick: () => handlers.onSubmit(row),
            disabled: !canEditPerm || !canSubmit,
            disabledReason: !canEditPerm
              ? getPurchasePermissionDenialReason('purchase.po.edit')
              : `${statusLabel} purchase orders cannot be sent for approval`,
          } satisfies RowActionItem,
        ]
      : []),
    {
      id: 'cancel',
      label: 'Cancel',
      icon: Ban,
      onClick: () => handlers.onCancel(row),
      disabled: !canCancelPerm || !canCancel,
      disabledReason: !canCancelPerm
        ? getPurchasePermissionDenialReason('purchase.po.cancel')
        : 'Cancel returns a Pending Approved order to Open',
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      danger: true,
      onClick: () => handlers.onDelete(row),
      disabled: !canCancelPerm || !canDelete,
      disabledReason: !canCancelPerm
        ? getPurchasePermissionDenialReason('purchase.po.cancel')
        : `${statusLabel} purchase orders cannot be deleted`,
    },
    { id: 'print', label: 'Print', icon: Printer, onClick: () => handlers.onPrint(row) },
    {
      id: 'create-grn',
      label: 'Create GRN',
      icon: PackagePlus,
      onClick: () => handlers.onCreateGrn(row),
      disabled: !canCreateGrnPerm || !canCreateGrn,
      disabledReason: !canCreateGrnPerm
        ? getPurchasePermissionDenialReason('purchase.grn.create')
        : row.receivedPercentage >= 100
          ? 'Purchase order is fully received'
          : `${statusLabel} purchase orders cannot receive goods`,
    },
    {
      id: 'reopen',
      label: 'Reopen',
      icon: RotateCcw,
      onClick: () => handlers.onReopen(row),
      disabled: !canEditPerm || !canReopen,
      disabledReason: !canEditPerm
        ? getPurchasePermissionDenialReason('purchase.po.edit')
        : canReopen
          ? undefined
          : 'Reopen is available for Rejected, Cancelled, or Closed orders',
    },
  ]
}

export interface PurchaseOrdersTableProps {
  rows: PurchaseOrderListRow[]
  registerFilter?: CrmListFilterBarProps
  handlers: PurchaseOrderRowHandlers
  /** Purchase Setup → “Require approval on new PO”; hides the submit action when off. */
  requireApprovalOnPo?: boolean
  busyId?: string | null
  emptyAction?: React.ReactNode
  hasActiveFilters?: boolean
  onClearFilters?: () => void
  onExport?: () => void
  /** Current page-level Sort key — clears header column sort when it changes */
  sortBy?: string
}

export function PurchaseOrdersTable({
  rows,
  registerFilter,
  handlers,
  requireApprovalOnPo = true,
  busyId,
  emptyAction,
  hasActiveFilters,
  onClearFilters,
  onExport,
  sortBy,
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
        accessorKey: 'createdByName',
        header: 'Created By',
        meta: { columnLabel: 'Created By' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.createdByName || '—'}</span>
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
          <StatusBadge label={row.original.invoiceStatusLabel} status={row.original.invoiceStatus} />
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: { columnLabel: 'Status' },
        cell: ({ row }) => (
          <StatusBadge label={row.original.statusLabel} status={row.original.status} />
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
              <EnterpriseRowActionsMenu
                actions={buildRowActions(po, handlers, requireApprovalOnPo)}
              />
            </div>
          )
        },
      },
    ],
    [busyId, handlers, requireApprovalOnPo],
  )

  const emptyMessage = hasActiveFilters
    ? 'No purchase orders match current filters.'
    : 'No purchase orders yet.'

  return (
    <ErpDataGrid
      className={cn('erp-po-table', densityClass)}
      data={rows}
      columns={columns}
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
      sortResetToken={sortBy}
      exportFileName="purchase-orders"
      onExport={onExport}
      getRowId={(r) => r.id}
      onRowQuickView={handlers.onView}
      registerBar={
        registerFilter ? (
          <CrmListFilterBar
            {...registerFilter}
            showCommandPaletteHint={false}
            className="crm-list-filter-bar--embedded"
          />
        ) : undefined
      }
    />
  )
}
