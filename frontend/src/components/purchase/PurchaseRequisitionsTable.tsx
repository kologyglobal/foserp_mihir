import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Ban,
  ClipboardList,
  Copy,
  Eye,
  Pencil,
  Printer,
  Send,
  ShoppingCart,
  Trash2,
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
import {
  canConvertPrToPo,
  canConvertPrToRfq,
  isPrPendingPo,
  prNextActionHint,
  prProcurementPathLabel,
} from '../../utils/purchaseRequisitionNextStep'

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
  onViewPlanning: (row: PurchaseRequisitionListRow) => void
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
  const canRfq = canConvertPrToRfq(row)
  const canPo = canConvertPrToPo(row)
  const canCancel = !isCancelled && !isConverted && status !== 'closed'
  const hasRfq = Boolean(row.convertedRfqId)

  const canEditPerm = canPurchasePermission('purchase.pr.edit')
  const canSubmitPerm = canPurchasePermission('purchase.pr.submit')
  const canCreateRfq = canPurchasePermission('purchase.rfq.create')
  const canCreatePo = canPurchasePermission('purchase.po.create')

  return [
    { id: 'view', label: 'View', icon: Eye, onClick: () => handlers.onView(row) },
    {
      id: 'edit',
      label: 'Edit',
      icon: Pencil,
      onClick: () => handlers.onEdit(row),
      disabled: !canEditPerm || !canEdit,
      disabledReason: !canEditPerm
        ? getPurchasePermissionDenialReason('purchase.pr.edit')
        : status === 'pending_approval'
          ? 'Pending approval — requester cannot edit'
          : isCancelled
            ? 'Cancelled documents are read-only'
            : isConverted
              ? 'Converted documents are read-only'
              : `${row.statusLabel || status} purchase requisitions cannot be edited`,
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: Copy,
      onClick: () => handlers.onDuplicate(row),
      disabled: !canPurchasePermission('purchase.pr.create'),
      disabledReason: getPurchasePermissionDenialReason('purchase.pr.create'),
    },
    {
      id: 'submit',
      label: 'Submit for Approval',
      icon: Send,
      onClick: () => handlers.onSubmit(row),
      disabled: !canSubmitPerm || !canSubmit,
      disabledReason: !canSubmitPerm
        ? getPurchasePermissionDenialReason('purchase.pr.submit')
        : 'Only Draft or Rejected requisitions can be submitted',
    },
    {
      id: 'to-rfq',
      label: hasRfq ? 'View RFQ' : 'Create RFQ',
      icon: ShoppingCart,
      onClick: () => handlers.onConvertRfq(row),
      disabled: hasRfq ? false : !canCreateRfq || !canRfq,
      disabledReason: hasRfq
        ? undefined
        : !canCreateRfq
          ? getPurchasePermissionDenialReason('purchase.rfq.create')
          : row.status === 'approved' && !row.rfqRequired
            ? 'This PR uses Direct Purchase Planning Path'
            : 'Only approved PRs that require RFQ can convert',
    },
    ...(isPrPendingPo(row)
      ? [
          {
            id: 'view-planning',
            label: 'View Planning Items',
            icon: ClipboardList,
            onClick: () => handlers.onViewPlanning(row),
          },
        ]
      : [
          {
            id: 'to-po',
            label: 'Convert to Purchase Order',
            icon: Truck,
            onClick: () => handlers.onConvertPo(row),
            disabled: !canCreatePo || !canPo,
            disabledReason: !canCreatePo
              ? getPurchasePermissionDenialReason('purchase.po.create')
              : row.status === 'approved' && row.rfqRequired
                ? 'RFQ is required first for this requisition'
                : 'Only RFQ-converted PRs can create a PO here',
          },
        ]),
    { id: 'print', label: 'Print', icon: Printer, onClick: () => handlers.onPrint(row) },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      onClick: () => handlers.onCancel(row),
      danger: true,
      disabled: !canEditPerm || !canCancel || status !== 'draft',
      disabledReason: !canEditPerm
        ? getPurchasePermissionDenialReason('purchase.pr.edit')
        : status !== 'draft'
          ? `${row.statusLabel || status} purchase requisitions cannot be deleted`
          : isCancelled
            ? 'Already cancelled'
            : 'Cannot delete this status',
    },
    {
      id: 'cancel',
      label: 'Cancel',
      icon: Ban,
      onClick: () => handlers.onCancel(row),
      danger: true,
      disabled: !canEditPerm || !canCancel || status === 'draft',
      disabledReason: !canEditPerm
        ? getPurchasePermissionDenialReason('purchase.pr.edit')
        : status === 'draft'
          ? 'Use Delete for draft requisitions'
          : isCancelled
            ? 'Already cancelled'
            : isConverted
              ? 'Converted documents cannot be cancelled'
              : `${row.statusLabel || status} purchase requisitions cannot be cancelled`,
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
            {(row.original.convertedRfqNumber ||
              row.original.convertedPoNumber ||
              prNextActionHint(row.original)) && (
              <div className="ent-record-cell__meta mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {prNextActionHint(row.original) ? (
                  <span
                    className={cn(
                      'text-[11px] font-medium',
                      isPrPendingPo(row.original) ? 'text-emerald-700' : 'text-sky-700',
                    )}
                  >
                    {prNextActionHint(row.original)}
                  </span>
                ) : null}
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
            {!row.original.convertedRfqNumber &&
            !row.original.convertedPoNumber &&
            !prNextActionHint(row.original) &&
            row.original.status === 'draft' ? (
              <div className="ent-record-cell__meta mt-0.5 text-[11px] text-erp-muted">
                {prProcurementPathLabel(row.original)}
              </div>
            ) : null}
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
          <div className="space-y-0.5">
            <StatusDot
              label={row.original.statusLabel}
              tone={statusToneFromLabel(row.original.statusLabel)}
            />
            {isPrPendingPo(row.original) ? (
              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                Pending PO
              </div>
            ) : null}
          </div>
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
      recordLabel={undefined}
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
