import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Ban,
  Copy,
  Eye,
  Pencil,
  Printer,
  Send,
  ShoppingCart,
  Truck,
} from 'lucide-react'
import { ErpDataGrid } from '../erp/ErpDataGrid'
import { TableLink } from '../ui/AppLink'
import { Badge } from '../ui/Badge'
import { StatusDot, statusToneFromLabel } from '../design-system/StatusDot'
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
  PurchaseRequisitionListRow,
  PurchaseRequisitionPriority,
  PurchaseRequisitionSource,
} from '../../types/purchaseDomain'
import {
  canPurchasePermission,
  getPurchasePermissionDenialReason,
} from '../../utils/permissions'

function priorityColor(priority: PurchaseRequisitionPriority): 'gray' | 'blue' | 'orange' | 'red' {
  if (priority === 'urgent') return 'red'
  if (priority === 'high') return 'orange'
  if (priority === 'normal') return 'blue'
  return 'gray'
}

function sourceColor(source: PurchaseRequisitionSource): 'blue' | 'orange' | 'purple' | 'green' | 'gray' {
  if (source === 'mrp' || source === 'work_order') return 'blue'
  if (source === 'reorder' || source === 'maintenance') return 'orange'
  if (source === 'sales_order' || source === 'project') return 'purple'
  if (source === 'manual') return 'green'
  return 'gray'
}

export interface PurchaseRequisitionRowHandlers {
  onView: (row: PurchaseRequisitionListRow) => void
  onEdit: (row: PurchaseRequisitionListRow) => void
  onDuplicate: (row: PurchaseRequisitionListRow) => void
  onSubmit: (row: PurchaseRequisitionListRow) => void
  onConvertRfq: (row: PurchaseRequisitionListRow) => void
  onConvertPo: (row: PurchaseRequisitionListRow) => void
  onPrint: (row: PurchaseRequisitionListRow) => void
  onCancel: (row: PurchaseRequisitionListRow) => void
}

function buildRowActions(
  row: PurchaseRequisitionListRow,
  handlers: PurchaseRequisitionRowHandlers,
): RowActionItem[] {
  const status = row.status
  const isCancelled = status === 'cancelled'
  const isConverted = status === 'converted_to_rfq' || status === 'converted_to_po'
  const canEdit = status === 'draft' || status === 'rejected'
  const canSubmit = status === 'draft' || status === 'rejected'
  const canConvert = status === 'approved'
  const canCancel = !isCancelled && !isConverted && status !== 'closed'

  const canEditPerm = canPurchasePermission('purchase.requisition.edit')
  const canSubmitPerm = canPurchasePermission('purchase.requisition.submit')
  const canCreateRfq = canPurchasePermission('purchase.rfq.create')
  const canCreatePo = canPurchasePermission('purchase.order.create')

  return [
    { id: 'view', label: 'View', icon: Eye, onClick: () => handlers.onView(row) },
    {
      id: 'edit',
      label: 'Edit',
      icon: Pencil,
      onClick: () => handlers.onEdit(row),
      disabled: !canEditPerm || !canEdit,
      disabledReason: !canEditPerm
        ? getPurchasePermissionDenialReason('purchase.requisition.edit')
        : status === 'pending_approval'
          ? 'Pending approval — requester cannot edit'
          : isCancelled
            ? 'Cancelled documents are read-only'
            : isConverted
              ? 'Converted documents are read-only'
              : 'Edit is only available for Draft or Rejected',
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: Copy,
      onClick: () => handlers.onDuplicate(row),
      disabled: !canPurchasePermission('purchase.requisition.create'),
      disabledReason: getPurchasePermissionDenialReason('purchase.requisition.create'),
    },
    {
      id: 'submit',
      label: 'Submit for Approval',
      icon: Send,
      onClick: () => handlers.onSubmit(row),
      disabled: !canSubmitPerm || !canSubmit,
      disabledReason: !canSubmitPerm
        ? getPurchasePermissionDenialReason('purchase.requisition.submit')
        : 'Only Draft or Rejected requisitions can be submitted',
    },
    {
      id: 'to-rfq',
      label: 'Convert to RFQ',
      icon: ShoppingCart,
      onClick: () => handlers.onConvertRfq(row),
      disabled: !canCreateRfq || !canConvert,
      disabledReason: !canCreateRfq
        ? getPurchasePermissionDenialReason('purchase.rfq.create')
        : 'Only Approved requisitions can convert to RFQ',
    },
    {
      id: 'to-po',
      label: 'Convert to Purchase Order',
      icon: Truck,
      onClick: () => handlers.onConvertPo(row),
      disabled: !canCreatePo || !canConvert,
      disabledReason: !canCreatePo
        ? getPurchasePermissionDenialReason('purchase.order.create')
        : 'Only Approved requisitions can convert to PO',
    },
    { id: 'print', label: 'Print', icon: Printer, onClick: () => handlers.onPrint(row) },
    {
      id: 'cancel',
      label: 'Cancel',
      icon: Ban,
      onClick: () => handlers.onCancel(row),
      danger: true,
      disabled: !canEditPerm || !canCancel,
      disabledReason: !canEditPerm
        ? getPurchasePermissionDenialReason('purchase.requisition.edit')
        : isCancelled
          ? 'Already cancelled'
          : isConverted
            ? 'Converted documents cannot be cancelled'
            : 'Cannot cancel this status',
    },
  ]
}

export interface PurchaseRequisitionsTableProps {
  rows: PurchaseRequisitionListRow[]
  registerFilter?: CrmListFilterBarProps
  handlers: PurchaseRequisitionRowHandlers
  busyId?: string | null
  emptyAction?: React.ReactNode
  hasActiveFilters?: boolean
  onClearFilters?: () => void
  onExport?: () => void
}

export function PurchaseRequisitionsTable({
  rows,
  registerFilter,
  handlers,
  busyId,
  emptyAction,
  hasActiveFilters,
  onClearFilters,
  onExport,
}: PurchaseRequisitionsTableProps) {
  const densityClass = useDensityClass()

  const columns: ColumnDef<PurchaseRequisitionListRow, unknown>[] = useMemo(
    () => [
      {
        accessorKey: 'documentNumber',
        header: 'PR Number',
        meta: { columnLabel: 'PR Number' },
        cell: ({ row }) => (
          <div className="min-w-[8.5rem]">
            <TableLink
              to={`/purchase/requisitions/${row.original.id}`}
              className="ent-record-cell__id font-mono"
            >
              {row.original.documentNumber}
            </TableLink>
            {(row.original.convertedRfqNumber || row.original.convertedPoNumber) && (
              <div className="ent-record-cell__meta mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {row.original.convertedRfqNumber ? (
                  <TableLink to={`/purchase/rfqs/${row.original.convertedRfqId}`} className="font-mono">
                    RFQ {row.original.convertedRfqNumber}
                  </TableLink>
                ) : null}
                {row.original.convertedPoNumber ? (
                  <TableLink to={`/purchase/orders/${row.original.convertedPoId}`} className="font-mono">
                    PO {row.original.convertedPoNumber}
                  </TableLink>
                ) : null}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'documentDate',
        header: 'PR Date',
        meta: { columnLabel: 'PR Date' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-erp-text">
            {formatDate(row.original.documentDate)}
          </span>
        ),
      },
      {
        accessorKey: 'department',
        header: 'Department',
        meta: { columnLabel: 'Department' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.department || '—'}</span>
        ),
      },
      {
        id: 'location',
        accessorFn: (r) => r.location.name,
        header: 'Location',
        meta: { columnLabel: 'Location' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.location.name}</span>
        ),
      },
      {
        id: 'requester',
        accessorFn: (r) => r.requester.name,
        header: 'Requested By',
        meta: { columnLabel: 'Requested By' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.requester.name}</span>
        ),
      },
      {
        accessorKey: 'requiredBy',
        header: 'Required By',
        meta: { columnLabel: 'Required By' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-erp-text">
            {row.original.requiredBy ? formatDate(row.original.requiredBy) : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'itemCount',
        header: 'Items',
        meta: { align: 'right', columnLabel: 'Items' },
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.itemCount}</span>
        ),
      },
      {
        accessorKey: 'estimatedValue',
        header: 'Est. Value',
        meta: { align: 'right', columnLabel: 'Est. Value' },
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatCurrency(row.original.estimatedValue)}
          </span>
        ),
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        meta: { columnLabel: 'Priority' },
        cell: ({ row }) => (
          <Badge color={priorityColor(row.original.priority)} className="ent-status-chip !normal-case tracking-normal">
            {row.original.priorityLabel}
          </Badge>
        ),
      },
      {
        accessorKey: 'source',
        header: 'Source',
        meta: { columnLabel: 'Source' },
        cell: ({ row }) => (
          <Badge color={sourceColor(row.original.source)} className="ent-status-chip !normal-case tracking-normal">
            {row.original.sourceLabel}
          </Badge>
        ),
      },
      {
        accessorKey: 'approvalStatusLabel',
        header: 'Approval',
        meta: { columnLabel: 'Approval' },
        cell: ({ row }) => (
          <StatusDot
            label={row.original.approvalStatusLabel}
            tone={statusToneFromLabel(row.original.approvalStatusLabel)}
          />
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: { columnLabel: 'Status' },
        cell: ({ row }) => (
          <StatusDot
            label={row.original.statusLabel}
            tone={statusToneFromLabel(row.original.statusLabel)}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const pr = row.original
          return (
            <div
              className={busyId === pr.id ? 'pointer-events-none opacity-50' : undefined}
              onClick={(e) => e.stopPropagation()}
            >
              <EnterpriseRowActionsMenu actions={buildRowActions(pr, handlers)} />
            </div>
          )
        },
      },
    ],
    [busyId, handlers],
  )

  const emptyMessage = hasActiveFilters
    ? 'No requisitions match current filters.'
    : 'No purchase requisitions yet.'

  return (
    <ErpDataGrid
      className={cn('erp-pr-table', densityClass)}
      data={rows}
      columns={columns}
      recordLabel="Purchase Requisitions"
      emptyMessage={emptyMessage}
      emptyAction={
        emptyAction ?? (
          hasActiveFilters && onClearFilters ? (
            <button
              type="button"
              className="text-[13px] font-semibold text-erp-primary"
              onClick={onClearFilters}
            >
              Clear Filters
            </button>
          ) : undefined
        )
      }
      stickyFirstColumn
      showCompactSearch={false}
      enableColumnSorting={false}
      exportFileName="purchase-requisitions"
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
