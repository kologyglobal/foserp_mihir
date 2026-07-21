import { useMemo, useState } from 'react'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import { Copy, Eye, FileText, GitBranch, Pencil, Printer, Send, Trash2, Calendar, CheckCircle2, ThumbsUp, XCircle } from 'lucide-react'
import { ErpDataGrid } from '../erp/ErpDataGrid'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { formatDate } from '../../utils/dates/format'
import { quotationStatusLabel } from './QuotationCrmCard'
import type { QuotationListItem } from './QuotationCrmCard'
import { quotationRevisionLabel } from './Quotation360Sections'
import {
  EnterpriseIdCell,
  EnterpriseNumericCell,
  EnterpriseRecordCell,
  EnterpriseRowActionsMenu,
  entNumericMeta,
  useDensityClass,
} from '../../design-system/enterprise'
import { BulkActionToolbar } from '../../design-system/list-page/BulkActionToolbar'
import { buildEnterpriseBulkActions } from '../../design-system/list-page/buildEnterpriseBulkActions'
import { CrmListFilterBar, type CrmListFilterBarProps } from '@/components/crm/CrmListFilterBar'
import { cn } from '../../utils/cn'
import { StatusBadge } from '../../design-system/list-page'
import { resolveCreateSalesOrderGateForQuotationDocument } from '../../utils/opportunitySalesOrderDraft'
import { isQuotationDeletableStatus } from '../../utils/quotationDeletePolicy'
import { resolveQuotationRevisionPolicy } from '../../utils/quotationRevisionPolicy'

function listStatusLabel(item: QuotationListItem): string {
  if (item.document.status === 'sent' && item.customerApproval === 'approved') {
    return 'Customer Approved'
  }
  return quotationStatusLabel(item.document.status)
}

export interface CrmQuotationsTableProps {
  rows: QuotationListItem[]
  onView: (item: QuotationListItem) => void
  onEdit: (item: QuotationListItem) => void
  onDuplicate?: (item: QuotationListItem) => void
  onRevise?: (item: QuotationListItem) => void
  onPreview?: (item: QuotationListItem) => void
  onScheduleActivity?: (item: QuotationListItem) => void
  onCreateSalesOrder?: (item: QuotationListItem) => void
  onPrint?: (item: QuotationListItem) => void
  onSubmitApproval?: (item: QuotationListItem) => void
  onApprove?: (item: QuotationListItem) => void
  onReject?: (item: QuotationListItem) => void
  onMarkSent?: (item: QuotationListItem) => void
  onCustomerApprove?: (item: QuotationListItem) => void
  onBulkAssign?: (rows: QuotationListItem[]) => void
  onBulkExport?: (rows: QuotationListItem[]) => void
  onBulkDelete?: (rows: QuotationListItem[]) => void
  onBulkInactive?: (rows: QuotationListItem[]) => void
  onBulkActive?: (rows: QuotationListItem[]) => void
  canEdit?: boolean
  canDelete?: boolean
  emptyAction?: React.ReactNode
  search: string
  onSearchChange: (value: string) => void
  filterSlot?: React.ReactNode
  hasActiveFilters?: boolean
  onClearFilters?: () => void
  showCompactSearch?: boolean
  selectable?: boolean
  enableColumnSorting?: boolean
  registerFilter?: CrmListFilterBarProps
}

export function CrmQuotationsTable({
  rows,
  onView,
  onEdit,
  onDuplicate,
  onRevise,
  onPreview,
  onScheduleActivity,
  onCreateSalesOrder,
  onPrint,
  onSubmitApproval,
  onApprove,
  onReject,
  onMarkSent,
  onCustomerApprove,
  onBulkAssign,
  onBulkExport,
  onBulkDelete,
  onBulkInactive,
  onBulkActive,
  canEdit = false,
  canDelete = false,
  emptyAction,
  search,
  onSearchChange,
  filterSlot,
  hasActiveFilters,
  onClearFilters,
  showCompactSearch = false,
  selectable = true,
  enableColumnSorting = false,
  registerFilter,
}: CrmQuotationsTableProps) {
  const densityClass = useDensityClass()
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const selectedRows = useMemo(() => {
    const ids = Object.keys(rowSelection).filter((k) => rowSelection[k])
    return rows.filter((r) => ids.includes(r.document.id))
  }, [rowSelection, rows])

  const selectedDraftRows = useMemo(
    () => selectedRows.filter((r) => isQuotationDeletableStatus(r.document.status)),
    [selectedRows],
  )
  const canBulkDeleteDrafts = Boolean(
    canDelete && onBulkDelete && selectedRows.length > 0 && selectedDraftRows.length === selectedRows.length,
  )

  const columns: ColumnDef<QuotationListItem>[] = useMemo(
    () => [
      {
        id: 'quotation',
        header: 'Quotation',
        accessorFn: (r) => r.quotationNo,
        meta: { columnLabel: 'Quotation' },
        cell: ({ row }) => (
          <button type="button" className="text-left" onClick={(e) => { e.stopPropagation(); onView(row.original) }}>
            <EnterpriseIdCell id={row.original.quotationNo} />
            <p className="mt-0.5 text-[11px] font-medium text-erp-muted">
              {quotationRevisionLabel(row.original.document.revisionNo)}
              {row.original.revisionCount > 1 ? ` · ${row.original.revisionCount} versions` : null}
            </p>
            {row.original.opportunityName ? (
              <p className="mt-0.5 max-w-[200px] truncate text-[12px] text-erp-muted">{row.original.opportunityName}</p>
            ) : null}
          </button>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        accessorFn: (r) => r.customerName,
        cell: ({ row }) => (
          <EnterpriseRecordCell
            primary={row.original.customerName}
            subtitle={row.original.opportunityName ?? `R${row.original.document.revisionNo}`}
          />
        ),
      },
      {
        id: 'quotationDate',
        header: 'Quotation Date',
        accessorFn: (r) => r.quotationDate,
        meta: { columnLabel: 'Quotation Date' },
        cell: ({ row }) => formatDate(row.original.quotationDate),
      },
      {
        id: 'expiryDate',
        header: 'Expiry',
        accessorFn: (r) => r.expiryDate,
        meta: { columnLabel: 'Expiry Date' },
        cell: ({ row }) => formatDate(row.original.expiryDate),
      },
      {
        id: 'total',
        header: 'Amount',
        accessorFn: (r) => r.document.totalAmount,
        meta: entNumericMeta('Amount'),
        cell: ({ row }) => (
          <EnterpriseNumericCell value={formatCrmCurrency(row.original.document.totalAmount)} className="font-semibold text-erp-primary" />
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: listStatusLabel,
        cell: ({ row }) => (
          <StatusBadge
            label={listStatusLabel(row.original)}
            status={
              row.original.document.status === 'sent' && row.original.customerApproval === 'approved'
                ? 'approved'
                : row.original.document.status
            }
          />
        ),
      },
      {
        id: 'owner',
        header: 'Owner',
        accessorFn: (r) => r.ownerName,
        meta: { columnLabel: 'Owner' },
        cell: ({ row }) => (
          <EnterpriseRecordCell primary={row.original.ownerName} />
        ),
      },
      {
        id: 'actions',
        header: '',
        meta: { align: 'center', columnLabel: 'Actions' },
        cell: ({ row }) => {
          const item = row.original
          const d = item.document
          const soGate = resolveCreateSalesOrderGateForQuotationDocument(d.id)
          const soAlreadyExists = Boolean(soGate.salesOrderId)
          const canCreateSo = Boolean(onCreateSalesOrder) && (soAlreadyExists || soGate.enabled)
          const canRevise = Boolean(onRevise)
            && resolveQuotationRevisionPolicy({
              status: d.status,
              customerApproval: item.customerApproval ?? 'pending',
              isLatest: true,
            }).canCreateRevision
            && !soAlreadyExists
          const canSubmit = Boolean(onSubmitApproval) && (d.status === 'draft' || d.status === 'rejected')
          const canApproveRow = Boolean(onApprove) && d.status === 'pending_approval'
          const canRejectRow = Boolean(onReject) && d.status === 'pending_approval'
          const canSend = Boolean(onMarkSent) && d.status === 'approved'
          const canCustomerApproveRow =
            Boolean(onCustomerApprove) && d.status === 'sent' && item.customerApproval === 'pending'
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <EnterpriseRowActionsMenu
                actions={[
                  { id: 'view', label: 'View', icon: Eye, onClick: () => onView(item) },
                  { id: 'edit', label: 'Edit', icon: Pencil, onClick: () => onEdit(item), disabled: !canEdit },
                  { id: 'duplicate', label: 'Duplicate', icon: Copy, onClick: () => (onDuplicate ? onDuplicate(item) : onEdit(item)), disabled: !canEdit },
                  ...(canDelete && onBulkDelete && isQuotationDeletableStatus(d.status)
                    ? [{
                        id: 'delete',
                        label: 'Delete',
                        icon: Trash2,
                        onClick: () => onBulkDelete([item]),
                        danger: true as const,
                      }]
                    : []),
                  { id: 'sep-workflow', separator: true, label: '' },
                  ...(canSubmit
                    ? [{
                        id: 'approval',
                        label: 'Submit for Internal Approval',
                        icon: FileText,
                        onClick: () => onSubmitApproval?.(item),
                      }]
                    : []),
                  ...(canApproveRow
                    ? [{
                        id: 'approve',
                        label: 'Approve',
                        icon: CheckCircle2,
                        onClick: () => onApprove?.(item),
                      }]
                    : []),
                  ...(canRejectRow
                    ? [{
                        id: 'reject',
                        label: 'Reject',
                        icon: XCircle,
                        onClick: () => onReject?.(item),
                        danger: true as const,
                      }]
                    : []),
                  ...(canSend
                    ? [{
                        id: 'send',
                        label: 'Send to Customer',
                        icon: Send,
                        onClick: () => onMarkSent?.(item),
                      }]
                    : []),
                  ...(canCustomerApproveRow
                    ? [{
                        id: 'customer-approve',
                        label: 'Customer Approve',
                        icon: ThumbsUp,
                        onClick: () => onCustomerApprove?.(item),
                      }]
                    : []),
                  ...(canRevise
                    ? [{
                        id: 'revise',
                        label: 'Revised Quotation',
                        icon: GitBranch,
                        onClick: () => onRevise?.(item),
                      }]
                    : []),
                  {
                    id: 'convert',
                    label: soAlreadyExists ? 'View Sales Order' : 'Convert to Sales Order',
                    icon: Send,
                    primary: true,
                    onClick: () => onCreateSalesOrder?.(item),
                    disabled: !canCreateSo,
                    disabledReason: soAlreadyExists ? undefined : (soGate.disabledReason ?? undefined),
                  },
                  {
                    id: 'follow-up',
                    label: 'Schedule Activity',
                    icon: Calendar,
                    onClick: () => onScheduleActivity?.(item),
                    disabled: !onScheduleActivity,
                  },
                  {
                    id: 'print',
                    label: 'Print / Preview',
                    icon: Printer,
                    onClick: () => (onPrint ? onPrint(item) : onPreview?.(item)),
                  },
                ]}
              />
            </div>
          )
        },
      },
    ],
    [onView, onEdit, onDuplicate, onRevise, onPreview, onScheduleActivity, onCreateSalesOrder, onPrint, onSubmitApproval, onApprove, onReject, onMarkSent, onCustomerApprove, onBulkDelete, canEdit, canDelete, enableColumnSorting],
  )

  const emptyMessage = hasActiveFilters ? 'No quotations match current filters.' : 'No quotations found.'

  return (
    <ErpDataGrid
      className={cn('erp-quotations-table', densityClass)}
      data={rows}
      columns={columns}
      recordLabel="Quotations"
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search quotation, customer, opportunity…"
      stickyFirstColumn
      showCompactSearch={showCompactSearch}
      showToolbarExport={false}
      exportFileName="crm-quotations"
      emptyMessage={emptyMessage}
      emptyAction={
        emptyAction ?? (
          hasActiveFilters && onClearFilters ? (
            <button type="button" className="text-[13px] font-semibold text-erp-primary" onClick={onClearFilters}>
              Clear Filters
            </button>
          ) : undefined
        )
      }
      filterSlot={filterSlot}
      enableColumnSorting={enableColumnSorting}
      registerBar={
        registerFilter ? (
          <CrmListFilterBar {...registerFilter} className="crm-list-filter-bar--embedded" />
        ) : undefined
      }
      getRowId={(row) => row.document.id}
      selectable={selectable}
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      onRowQuickView={onPreview}
      bulkActions={
        <BulkActionToolbar
          count={selectedRows.length}
          entityLabel="selected"
          onClear={() => setRowSelection({})}
          actions={buildEnterpriseBulkActions(selectedRows, {
            onAssign: onBulkAssign,
            onExport: onBulkExport,
            onDelete: canBulkDeleteDrafts ? (rows) => onBulkDelete?.(rows) : undefined,
            onInactive: onBulkInactive,
            onActive: onBulkActive,
            canAssign: canEdit,
            canDelete: canBulkDeleteDrafts,
            canSetStatus: canEdit,
          }).filter((action) => action.id !== 'delete' || canBulkDeleteDrafts)}
        />
      }
    />
  )
}
