import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Eye, Pencil, Printer, Trash2 } from 'lucide-react'
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
  InvoiceMatchingResultStatus,
  PurchaseInvoiceListRow,
  PurchaseInvoiceStatus,
} from '../../types/purchaseDomain'

function invoiceStatusDotTone(status: PurchaseInvoiceStatus): StatusDotTone {
  const tone = purchaseStatusTone(status)
  if (tone === 'critical') return 'danger'
  if (
    status === 'pending_approval' ||
    status === 'pending_verification' ||
    status === 'on_hold' ||
    status === 'mismatch'
  ) {
    return 'warning'
  }
  if (status === 'matched' || status === 'posted' || status === 'paid') return 'success'
  if (status === 'approved') return 'info'
  return tone
}

function matchBadgeColor(
  status: InvoiceMatchingResultStatus,
): 'green' | 'yellow' | 'red' | 'blue' | 'gray' {
  if (status === 'fully_matched') return 'green'
  if (status === 'within_tolerance') return 'blue'
  if (status === 'missing_grn' || status === 'duplicate_invoice') return 'red'
  if (
    status === 'quantity_mismatch' ||
    status === 'rate_mismatch' ||
    status === 'tax_mismatch' ||
    status === 'amount_mismatch'
  ) {
    return 'yellow'
  }
  return 'gray'
}

export interface PurchaseInvoiceRowHandlers {
  onView: (row: PurchaseInvoiceListRow) => void
  onEdit: (row: PurchaseInvoiceListRow) => void
  onPrint: (row: PurchaseInvoiceListRow) => void
}

function buildRowActions(
  row: PurchaseInvoiceListRow,
  handlers: PurchaseInvoiceRowHandlers,
): RowActionItem[] {
  const canEdit = row.status === 'draft' || row.status === 'pending_verification'
  const statusLabel = row.statusLabel || row.status
  return [
    {
      id: 'view',
      label: 'View',
      icon: Eye,
      onClick: () => handlers.onView(row),
    },
    {
      id: 'edit',
      label: 'Edit',
      icon: Pencil,
      onClick: () => handlers.onEdit(row),
      disabled: !canEdit,
      disabledReason: `${statusLabel} purchase invoices cannot be edited`,
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      danger: true,
      disabled: row.status !== 'draft',
      disabledReason: `${statusLabel} purchase invoices cannot be deleted`,
    },
    {
      id: 'print',
      label: 'Print',
      icon: Printer,
      onClick: () => handlers.onPrint(row),
    },
  ]
}

export interface PurchaseInvoicesTableProps {
  rows: PurchaseInvoiceListRow[]
  handlers: PurchaseInvoiceRowHandlers
  busyId?: string | null
  registerFilter?: CrmListFilterBarProps
  emptyAction?: React.ReactNode
  hasActiveFilters?: boolean
  onClearFilters?: () => void
  onExport?: () => void
}

export function PurchaseInvoicesTable({
  rows,
  handlers,
  busyId,
  registerFilter,
  emptyAction,
  hasActiveFilters,
  onClearFilters,
  onExport,
}: PurchaseInvoicesTableProps) {
  const densityClass = useDensityClass()

  const columns: ColumnDef<PurchaseInvoiceListRow, unknown>[] = useMemo(
    () => [
      {
        accessorKey: 'documentNumber',
        header: 'Invoice No',
        meta: { columnLabel: 'Invoice Number' },
        cell: ({ row }) => (
          <div className="min-w-[8.5rem]">
            <TableLink
              to={`/purchase/invoices/${row.original.id}`}
              className="ent-record-cell__id font-mono"
            >
              {row.original.documentNumber}
            </TableLink>
            {row.original.vendorInvoiceNumber ? (
              <div className="ent-record-cell__meta mt-0.5">
                Vendor #{row.original.vendorInvoiceNumber}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'documentDate',
        header: 'Date',
        meta: { columnLabel: 'Invoice Date' },
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
        accessorKey: 'purchaseOrderNumber',
        header: 'PO',
        meta: { columnLabel: 'Purchase Order' },
        cell: ({ row }) => (
          <span className="font-mono whitespace-nowrap">
            {row.original.purchaseOrderNumber || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'goodsReceiptNumber',
        header: 'GRN',
        meta: { columnLabel: 'Goods Receipt' },
        cell: ({ row }) => (
          <span className="font-mono whitespace-nowrap">
            {row.original.goodsReceiptNumber || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'originLabel',
        header: 'Origin',
        meta: { columnLabel: 'Origin' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.originLabel}</span>
        ),
      },
      {
        accessorKey: 'matchingResultStatus',
        header: 'Matching',
        meta: { columnLabel: 'Matching Result' },
        cell: ({ row }) => (
          <Badge
            color={matchBadgeColor(row.original.matchingResultStatus)}
            className="ent-status-chip !normal-case tracking-normal"
          >
            {row.original.matchingResultStatusLabel}
          </Badge>
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
        accessorKey: 'dueDate',
        header: 'Due',
        meta: { columnLabel: 'Due Date' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums text-erp-text">
            {row.original.dueDate ? formatDate(row.original.dueDate) : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: { columnLabel: 'Invoice Status' },
        cell: ({ row }) => (
          <StatusDot
            label={row.original.statusLabel}
            tone={invoiceStatusDotTone(row.original.status)}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const inv = row.original
          return (
            <div
              className={busyId === inv.id ? 'pointer-events-none opacity-50' : undefined}
              onClick={(e) => e.stopPropagation()}
            >
              <EnterpriseRowActionsMenu actions={buildRowActions(inv, handlers)} />
            </div>
          )
        },
      },
    ],
    [busyId, handlers],
  )

  const emptyMessage = hasActiveFilters
    ? 'No purchase invoices match current filters.'
    : 'No purchase invoices yet.'

  return (
    <ErpDataGrid
      className={cn('erp-invoice-table', densityClass)}
      data={rows}
      columns={columns}
      recordLabel={undefined}
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
      exportFileName="purchase-invoices"
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
