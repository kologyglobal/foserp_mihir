import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  CheckCircle,
  CornerDownLeft,
  Eye,
  History,
  UserPlus,
  XCircle,
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
import type { PurchaseApprovalQueueRow } from '../../types/purchaseDomain'
import { canPurchasePermission } from '../../utils/permissions'

function documentPath(row: PurchaseApprovalQueueRow) {
  return row.documentType === 'purchase_requisition'
    ? `/purchase/requisitions/${row.documentId}`
    : `/purchase/orders/${row.documentId}`
}

function priorityColor(
  priority: PurchaseApprovalQueueRow['priority'],
): 'red' | 'orange' | 'blue' | 'gray' {
  if (priority === 'urgent') return 'red'
  if (priority === 'high') return 'orange'
  if (priority === 'normal') return 'blue'
  return 'gray'
}

function docTypeShort(type: PurchaseApprovalQueueRow['documentType']) {
  return type === 'purchase_requisition' ? 'PR' : 'PO'
}

export interface PurchaseApprovalRowHandlers {
  onReview: (row: PurchaseApprovalQueueRow) => void
  onHistory: (row: PurchaseApprovalQueueRow) => void
  onApprove: (row: PurchaseApprovalQueueRow) => void
  onReject: (row: PurchaseApprovalQueueRow) => void
  onSendBack: (row: PurchaseApprovalQueueRow) => void
  onDelegate: (row: PurchaseApprovalQueueRow) => void
}

function buildRowActions(
  row: PurchaseApprovalQueueRow,
  handlers: PurchaseApprovalRowHandlers,
): RowActionItem[] {
  const actions: RowActionItem[] = [
    {
      id: 'review',
      label: 'Review',
      icon: Eye,
      onClick: () => handlers.onReview(row),
    },
    {
      id: 'history',
      label: 'View Approval History',
      icon: History,
      onClick: () => handlers.onHistory(row),
    },
  ]

  if (row.status === 'pending' && row.canAct) {
    const canApprove =
      row.documentType === 'purchase_order'
        ? canPurchasePermission('purchase.order.approve')
        : canPurchasePermission('purchase.requisition.approve')
    if (canApprove) {
      actions.splice(
        1,
        0,
        {
          id: 'approve',
          label: 'Approve',
          icon: CheckCircle,
          onClick: () => handlers.onApprove(row),
        },
        {
          id: 'reject',
          label: 'Reject',
          icon: XCircle,
          onClick: () => handlers.onReject(row),
        },
        {
          id: 'sendback',
          label: 'Send Back for Correction',
          icon: CornerDownLeft,
          onClick: () => handlers.onSendBack(row),
        },
        {
          id: 'delegate',
          label: 'Delegate',
          icon: UserPlus,
          onClick: () => handlers.onDelegate(row),
        },
      )
    }
  }

  return actions
}

export interface PurchaseApprovalsTableProps {
  rows: PurchaseApprovalQueueRow[]
  registerFilter?: CrmListFilterBarProps
  handlers: PurchaseApprovalRowHandlers
  busyId?: string | null
  emptyAction?: React.ReactNode
  hasActiveFilters?: boolean
  onClearFilters?: () => void
}

export function PurchaseApprovalsTable({
  rows,
  registerFilter,
  handlers,
  busyId,
  emptyAction,
  hasActiveFilters,
  onClearFilters,
}: PurchaseApprovalsTableProps) {
  const densityClass = useDensityClass()

  const columns: ColumnDef<PurchaseApprovalQueueRow, unknown>[] = useMemo(
    () => [
      {
        accessorKey: 'documentNumber',
        header: 'Document',
        meta: { columnLabel: 'Document Number' },
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="min-w-[9rem]">
              <TableLink to={documentPath(r)} className="ent-record-cell__id font-mono">
                {r.documentNumber}
              </TableLink>
              <div className="ent-record-cell__meta mt-0.5">
                <span className="font-medium text-erp-text-muted">{docTypeShort(r.documentType)}</span>
                <span className="mx-1 text-erp-border-strong">·</span>
                <span className="tabular-nums">{formatDate(r.documentDate)}</span>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'requestedBy',
        header: 'Requester',
        meta: { columnLabel: 'Requested By' },
        cell: ({ row }) => (
          <div className="min-w-[8.5rem]">
            <span className="whitespace-nowrap">{row.original.requestedBy}</span>
            <div className="ent-record-cell__meta mt-0.5 whitespace-nowrap">
              {row.original.department || '—'}
            </div>
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
        accessorKey: 'amount',
        header: 'Amount',
        meta: { align: 'right', columnLabel: 'Amount' },
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{formatCurrency(row.original.amount)}</span>
        ),
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        meta: { columnLabel: 'Priority' },
        cell: ({ row }) => (
          <Badge
            color={priorityColor(row.original.priority)}
            className="ent-status-chip !normal-case tracking-normal"
          >
            {row.original.priorityLabel}
          </Badge>
        ),
      },
      {
        accessorKey: 'submittedDate',
        header: 'Submitted',
        meta: { columnLabel: 'Submitted Date' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-erp-text">
            {formatDate(row.original.submittedDate.slice(0, 10))}
          </span>
        ),
      },
      {
        accessorKey: 'pendingSinceDays',
        header: 'Age',
        meta: { align: 'right', columnLabel: 'Pending Since' },
        cell: ({ row }) => {
          const r = row.original
          if (r.status !== 'pending') {
            return <span className="text-erp-text-muted">—</span>
          }
          const overdue = r.pendingSinceDays >= 8
          return (
            <span
              className={cn(
                'tabular-nums whitespace-nowrap',
                overdue ? 'font-semibold text-erp-danger-fg' : 'text-erp-text',
              )}
            >
              {r.pendingSinceDays}d
            </span>
          )
        },
      },
      {
        accessorKey: 'approvalLevelLabel',
        header: 'Level',
        meta: { columnLabel: 'Approval Level' },
        cell: ({ row }) => (
          <div className="min-w-[7.5rem]">
            <span className="text-[12px] leading-snug text-erp-text">
              {row.original.approvalLevelLabel}
            </span>
          </div>
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
          const r = row.original
          return (
            <div
              className={busyId === r.approvalId ? 'pointer-events-none opacity-50' : undefined}
              onClick={(e) => e.stopPropagation()}
            >
              <EnterpriseRowActionsMenu actions={buildRowActions(r, handlers)} />
            </div>
          )
        },
      },
    ],
    [busyId, handlers],
  )

  const emptyMessage = hasActiveFilters
    ? 'No approvals match current filters.'
    : 'No approvals in this view.'

  return (
    <ErpDataGrid
      className={cn('erp-approvals-table', densityClass)}
      data={rows}
      columns={columns}
      recordLabel="Approvals"
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
      getRowId={(r) => r.approvalId}
      onRowQuickView={(r) => handlers.onReview(r)}
      registerBar={
        registerFilter ? (
          <CrmListFilterBar {...registerFilter} className="crm-list-filter-bar--embedded" />
        ) : undefined
      }
    />
  )
}
