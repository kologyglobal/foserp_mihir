import { useMemo, useState } from 'react'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import { Copy, Eye, FileText, Pencil, Printer, Send, Trash2, Calendar } from 'lucide-react'
import { ErpDataGrid } from '../erp/ErpDataGrid'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { formatDate } from '../../utils/dates/format'
import { quotationStatusLabel } from './QuotationCrmCard'
import type { QuotationListItem } from './QuotationCrmCard'
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

export interface CrmQuotationsTableProps {
  rows: QuotationListItem[]
  onView: (item: QuotationListItem) => void
  onEdit: (item: QuotationListItem) => void
  onDuplicate?: (item: QuotationListItem) => void
  onPreview?: (item: QuotationListItem) => void
  onScheduleActivity?: (item: QuotationListItem) => void
  onCreateSalesOrder?: (item: QuotationListItem) => void
  onPrint?: (item: QuotationListItem) => void
  onSubmitApproval?: (item: QuotationListItem) => void
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
  onPreview,
  onScheduleActivity,
  onCreateSalesOrder,
  onPrint,
  onSubmitApproval,
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
        accessorFn: (r) => r.document.status,
        cell: ({ row }) => (
          <StatusBadge
            label={quotationStatusLabel(row.original.document.status)}
            status={row.original.document.status}
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
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <EnterpriseRowActionsMenu
                actions={[
                  { id: 'view', label: 'View', icon: Eye, onClick: () => onView(item) },
                  { id: 'edit', label: 'Edit', icon: Pencil, onClick: () => onEdit(item), disabled: !canEdit },
                  { id: 'duplicate', label: 'Duplicate', icon: Copy, onClick: () => (onDuplicate ? onDuplicate(item) : onEdit(item)), disabled: !canEdit },
                  { id: 'delete', label: 'Delete', icon: Trash2, onClick: () => onBulkDelete?.([item]), danger: true, disabled: !canDelete },
                  { id: 'sep-workflow', separator: true, label: '' },
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
                    id: 'approval',
                    label: 'Submit for Approval',
                    icon: FileText,
                    onClick: () => onSubmitApproval?.(item),
                    disabled: !onSubmitApproval || d.status !== 'draft',
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
    [onView, onEdit, onDuplicate, onPreview, onScheduleActivity, onCreateSalesOrder, onPrint, onSubmitApproval, onBulkDelete, canEdit, canDelete, enableColumnSorting],
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
            onDelete: onBulkDelete,
            onInactive: onBulkInactive,
            onActive: onBulkActive,
            canAssign: canEdit,
            canDelete,
            canSetStatus: canEdit,
          })}
        />
      }
    />
  )
}
