import { useMemo, useState } from 'react'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import { Copy, Eye, FileText, GitBranch, Pencil, Printer, Send, Trash2, Calendar, CheckCircle2, ThumbsUp, XCircle } from 'lucide-react'
import { ErpDataGrid } from '../erp/ErpDataGrid'
import { TableLink } from '../ui/AppLink'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { formatDate, formatDateTime } from '../../utils/dates/format'
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
import { StatusBadge, StageBadge } from '../../design-system/list-page'
import { resolveCreateSalesOrderGateForQuotationDocument } from '../../utils/opportunitySalesOrderDraft'
import { isQuotationDeletableStatus } from '../../utils/quotationDeletePolicy'
import { resolveQuotationRevisionPolicy } from '../../utils/quotationRevisionPolicy'
import { opportunityStageLabel } from '../../utils/opportunityUtils'
import { entity360CustomerPath } from '../../config/entity360Routes'
import { resolveSalesOrderDetailPath } from '../../utils/crmSalesOrderNavigation'

function listStatusLabel(item: QuotationListItem): string {
  if (item.document.status === 'sent' && item.customerApproval === 'approved') {
    return 'Customer Approved'
  }
  return quotationStatusLabel(item.document.status)
}

function customerApprovalLabel(value?: string | null): string {
  if (!value) return '-'
  return value.replace(/_/g, ' ')
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
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Quotation' },
        cell: ({ row }) => (
          <button type="button" className="text-left" onClick={(e) => { e.stopPropagation(); onView(row.original) }}>
            <EnterpriseIdCell id={row.original.quotationNo} />
            {row.original.document.locked ? (
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Locked</p>
            ) : null}
          </button>
        ),
      },
      {
        id: 'revision',
        header: 'Rev',
        accessorFn: (r) => r.document.revisionNo,
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Revision' },
        cell: ({ row }) => (
          <EnterpriseRecordCell
            primary={quotationRevisionLabel(row.original.document.revisionNo)}
            subtitle={row.original.revisionCount > 1 ? `${row.original.revisionCount} versions` : undefined}
          />
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        accessorFn: (r) => r.customerName,
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Customer' },
        cell: ({ row }) => {
          const { customerName, customerId } = row.original
          if (customerId) {
            return (
              <TableLink to={entity360CustomerPath(customerId)}>
                <EnterpriseRecordCell primary={customerName} />
              </TableLink>
            )
          }
          return <EnterpriseRecordCell primary={customerName} />
        },
      },
      {
        id: 'opportunity',
        header: 'Opportunity',
        accessorFn: (r) => r.opportunityName ?? r.opportunityNo ?? '',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Opportunity' },
        cell: ({ row }) => {
          const { opportunityName, opportunityNo, opportunityId } = row.original
          const label = opportunityName || opportunityNo || '-'
          if (label === '-') return <span className="text-[13px] text-erp-muted">-</span>
          if (opportunityId) {
            return (
              <TableLink to={`/crm/opportunities/${opportunityId}`}>
                <EnterpriseRecordCell
                  primary={opportunityName || opportunityNo || '-'}
                  subtitle={opportunityNo && opportunityName ? opportunityNo : undefined}
                />
              </TableLink>
            )
          }
          return (
            <EnterpriseRecordCell
              primary={opportunityName || opportunityNo || '-'}
              subtitle={opportunityNo && opportunityName ? opportunityNo : undefined}
            />
          )
        },
      },
      {
        id: 'oppStage',
        header: 'Opp Stage',
        accessorFn: (r) => r.opportunityStage ?? '',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Opportunity Stage' },
        cell: ({ row }) => {
          const stage = row.original.opportunityStage
          if (!stage) return <span className="text-[13px] text-erp-muted">-</span>
          return <StageBadge label={opportunityStageLabel(stage)} stage={stage} />
        },
      },
      {
        id: 'quotationDate',
        header: 'Date',
        accessorFn: (r) => r.quotationDate,
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Quotation Date' },
        cell: ({ row }) => (
          <span className="text-[13px] text-erp-text">{formatDate(row.original.quotationDate)}</span>
        ),
      },
      {
        id: 'expiryDate',
        header: 'Valid Until',
        accessorFn: (r) => r.expiryDate,
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Valid Until' },
        cell: ({ row }) => {
          const { expiryDate } = row.original
          if (!expiryDate) return <span className="text-[13px] text-erp-muted">-</span>
          const overdue = expiryDate < new Date().toISOString().slice(0, 10)
            && row.original.document.status !== 'converted'
            && row.original.document.status !== 'superseded'
          return (
            <span className={cn('text-[13px] text-erp-text', overdue && 'font-semibold text-erp-critical')}>
              {formatDate(expiryDate)}
            </span>
          )
        },
      },
      {
        id: 'lines',
        header: 'Lines',
        accessorFn: (r) => r.document.priceLines?.length ?? 0,
        enableSorting: enableColumnSorting,
        meta: entNumericMeta('Lines'),
        cell: ({ row }) => (
          <EnterpriseNumericCell value={String(row.original.document.priceLines?.length ?? 0)} />
        ),
      },
      {
        id: 'qty',
        header: 'Qty',
        accessorFn: (r) => r.qty ?? 0,
        enableSorting: enableColumnSorting,
        meta: entNumericMeta('Qty'),
        cell: ({ row }) => {
          const qty = row.original.qty
          if (qty == null) return <span className="text-[13px] text-erp-muted">-</span>
          return <EnterpriseNumericCell value={String(qty)} />
        },
      },
      {
        id: 'subtotal',
        header: 'Subtotal',
        accessorFn: (r) => r.subtotalAmount ?? 0,
        enableSorting: enableColumnSorting,
        meta: entNumericMeta('Subtotal'),
        cell: ({ row }) => {
          const v = row.original.subtotalAmount
          if (v == null) return <span className="text-[13px] text-erp-muted">-</span>
          return <EnterpriseNumericCell value={formatCrmCurrency(v)} />
        },
      },
      {
        id: 'tax',
        header: 'Tax',
        accessorFn: (r) => r.taxAmount ?? 0,
        enableSorting: enableColumnSorting,
        meta: entNumericMeta('Tax'),
        cell: ({ row }) => {
          const v = row.original.taxAmount
          if (v == null) return <span className="text-[13px] text-erp-muted">-</span>
          return <EnterpriseNumericCell value={formatCrmCurrency(v)} />
        },
      },
      {
        id: 'total',
        header: 'Amount',
        accessorFn: (r) => r.document.totalAmount,
        enableSorting: enableColumnSorting,
        meta: entNumericMeta('Amount'),
        cell: ({ row }) => (
          <EnterpriseNumericCell value={formatCrmCurrency(row.original.document.totalAmount)} className="font-semibold text-erp-primary" />
        ),
      },
      {
        id: 'currency',
        header: 'Curr',
        accessorFn: (r) => r.currencyCode ?? 'INR',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Currency' },
        cell: ({ row }) => (
          <span className="text-[12px] font-semibold uppercase text-erp-text">
            {row.original.currencyCode || 'INR'}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: listStatusLabel,
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Status' },
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
        id: 'customerApproval',
        header: 'Cust. Approval',
        accessorFn: (r) => r.customerApproval ?? '',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Customer Approval' },
        cell: ({ row }) => {
          const approval = row.original.customerApproval
          if (!approval) return <span className="text-[13px] text-erp-muted">-</span>
          return <StatusBadge label={customerApprovalLabel(approval)} status={approval} />
        },
      },
      {
        id: 'owner',
        header: 'Owner',
        accessorFn: (r) => r.ownerName,
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Owner' },
        cell: ({ row }) => (
          <span className="text-[13px] text-erp-text">{row.original.ownerName}</span>
        ),
      },
      {
        id: 'paymentTerms',
        header: 'Payment',
        accessorFn: (r) => r.paymentTerms ?? '',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Payment Terms' },
        cell: ({ row }) => (
          <span className="max-w-[140px] truncate text-[12px] text-erp-text" title={row.original.paymentTerms ?? undefined}>
            {row.original.paymentTerms?.trim() || '-'}
          </span>
        ),
      },
      {
        id: 'deliveryTime',
        header: 'Delivery',
        accessorFn: (r) => r.deliveryTime ?? '',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Delivery Time' },
        cell: ({ row }) => (
          <span className="max-w-[120px] truncate text-[12px] text-erp-text" title={row.original.deliveryTime ?? undefined}>
            {row.original.deliveryTime?.trim() || '-'}
          </span>
        ),
      },
      {
        id: 'salesOrder',
        header: 'Sales Order',
        accessorFn: (r) => r.salesOrderNo ?? r.document.salesOrderNo ?? '',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Sales Order' },
        cell: ({ row }) => {
          const soNo = row.original.salesOrderNo ?? row.original.document.salesOrderNo
          const soId = row.original.document.salesOrderId
          if (!soNo && !soId) return <span className="text-[13px] text-erp-muted">-</span>
          if (soId) {
            return (
              <TableLink to={resolveSalesOrderDetailPath(soId, true)}>
                <EnterpriseIdCell id={soNo || soId} />
              </TableLink>
            )
          }
          return <EnterpriseIdCell id={soNo || '-'} />
        },
      },
      {
        id: 'lastModified',
        header: 'Last Modified',
        accessorFn: (r) => r.lastModified ?? r.document.modifiedAt ?? r.document.createdAt ?? '',
        enableSorting: enableColumnSorting,
        meta: { columnLabel: 'Last Modified' },
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-[12px] text-erp-text">
            {formatDateTime(row.original.lastModified ?? row.original.document.modifiedAt ?? row.original.document.createdAt)}
          </span>
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
