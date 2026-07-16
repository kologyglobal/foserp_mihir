import { useMemo, useState } from 'react'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import { Copy, Eye, GitBranch, Pencil, Send } from 'lucide-react'
import { ErpDataGrid } from '../erp/ErpDataGrid'
import { TableLink } from '../ui/AppLink'
import { useMasterStore } from '../../store/masterStore'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import type { Quotation } from '../../types/sales'
import {
  EnterpriseIdCell,
  EnterpriseNumericCell,
  EnterpriseRecordCell,
  EnterpriseRowActionsMenu,
  entNumericMeta,
} from '../../design-system/enterprise'
import { StatusBadge } from '../../design-system/list-page'
import { BulkActionToolbar } from '../../design-system/list-page/BulkActionToolbar'
import { buildEnterpriseBulkActions } from '../../design-system/list-page/buildEnterpriseBulkActions'
import { buildAiRowActions } from '../../design-system/list-page/aiRowActions'
import { crmQuotationPath } from '../../utils/crmQuotationNavigation'

export interface SalesQuotationsTableProps {
  rows: Quotation[]
  onView: (row: Quotation) => void
  onEdit: (row: Quotation) => void
  onDuplicate?: (row: Quotation) => void
  onPreview?: (row: Quotation) => void
  onBulkExport?: (rows: Quotation[]) => void
  onBulkEmail?: (rows: Quotation[]) => void
  emptyMessage?: string
}

export function SalesQuotationsTable({
  rows,
  onView,
  onEdit,
  onDuplicate,
  onPreview,
  onBulkExport,
  onBulkEmail,
  emptyMessage = 'No quotations match your filters.',
}: SalesQuotationsTableProps) {
  const customers = useMasterStore((s) => s.customers)
  const products = useMasterStore((s) => s.products)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const selectedRows = useMemo(() => {
    const ids = Object.keys(rowSelection).filter((k) => rowSelection[k])
    return rows.filter((r) => ids.includes(r.id))
  }, [rowSelection, rows])

  const columns: ColumnDef<Quotation>[] = useMemo(
    () => [
      {
        accessorKey: 'quotationNo',
        header: 'Quotation',
        meta: { columnLabel: 'Quotation' },
        cell: ({ row }) => (
          <TableLink to={crmQuotationPath(row.original.id)}>
            <EnterpriseIdCell id={`${row.original.quotationNo} Rev ${row.original.revisionNo}`} />
          </TableLink>
        ),
      },
      {
        accessorKey: 'opportunityNo',
        header: 'Opportunity',
        meta: { columnLabel: 'Opportunity' },
        cell: ({ row }) => {
          const no = row.original.opportunityNo ?? row.original.inquiryNo
          if (!no) return '—'
          const path = row.original.opportunityId ? `/crm/opportunities/${row.original.opportunityId}` : undefined
          return path ? (
            <TableLink to={path}>
              <EnterpriseIdCell id={no} />
            </TableLink>
          ) : (
            <EnterpriseIdCell id={no} />
          )
        },
      },
      {
        id: 'company',
        header: 'Company',
        meta: { columnLabel: 'Company' },
        cell: ({ row }) => {
          const c = customers.find((x) => x.id === row.original.customerId)
          return (
            <EnterpriseRecordCell
              primary={c?.customerName ?? row.original.customerId}
              location={c?.city}
              industry={c?.industry}
              subtitle={c?.isCustomer ? 'Customer' : 'Prospect'}
            />
          )
        },
      },
      {
        id: 'product',
        header: 'Product',
        meta: { columnLabel: 'Product' },
        cell: ({ row }) => {
          const p = products.find((x) => x.id === row.original.productId)
          return (
            <EnterpriseRecordCell
              primary={p?.productName ?? row.original.productId}
              subtitle={p?.productFamily}
            />
          )
        },
      },
      {
        accessorKey: 'pricing.grandTotal',
        header: 'Total',
        meta: entNumericMeta('Total'),
        cell: ({ row }) => (
          <EnterpriseNumericCell value={formatCurrency(row.original.pricing.grandTotal)} className="font-semibold text-erp-primary" />
        ),
      },
      {
        accessorKey: 'validityDate',
        header: 'Valid Until',
        meta: { columnLabel: 'Valid Until' },
        cell: ({ row }) => formatDate(row.original.validityDate),
      },
      {
        accessorKey: 'customerApproval',
        header: 'Approval',
        meta: { columnLabel: 'Approval' },
        cell: ({ row }) => (
          <StatusBadge label={row.original.customerApproval} status={row.original.customerApproval} />
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: { columnLabel: 'Status' },
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1">
            {row.original.locked ? <GitBranch className="h-3.5 w-3.5 text-erp-muted" aria-label="Locked revision" /> : null}
            <StatusBadge label={row.original.status} status={row.original.status} />
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        meta: { align: 'center', columnLabel: 'Actions' },
        cell: ({ row }) => {
          const q = row.original
          const ai = buildAiRowActions({
            onAiSummary: onPreview ? () => onPreview(q) : undefined,
            onSuggestNext: () => onPreview?.(q),
            onDraftEmail: () => onBulkEmail?.([q]),
          })
          return (
            <EnterpriseRowActionsMenu
              actions={[
                { id: 'view', label: 'View', icon: Eye, onClick: () => onView(q) },
                { id: 'edit', label: 'Edit', icon: Pencil, onClick: () => onEdit(q) },
                { id: 'duplicate', label: 'Duplicate', icon: Copy, onClick: () => (onDuplicate ? onDuplicate(q) : onEdit(q)) },
                ...ai,
                { id: 'send', label: 'Send to Customer', icon: Send, onClick: () => onView(q) },
              ]}
            />
          )
        },
      },
    ],
    [customers, products, onView, onEdit, onDuplicate, onPreview, onBulkEmail],
  )

  return (
    <ErpDataGrid
      data={rows}
      columns={columns}
      recordLabel="Quotations"
      stickyFirstColumn
      showCompactSearch={false}
      showToolbarExport={false}
      exportFileName="quotations"
      emptyMessage={emptyMessage}
      selectable
      getRowId={(row) => row.id}
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      onRowQuickView={onPreview}
      bulkActions={
        <BulkActionToolbar
          count={selectedRows.length}
          entityLabel="selected"
          onClear={() => setRowSelection({})}
          actions={buildEnterpriseBulkActions(selectedRows, {
            onExport: onBulkExport,
            onEmail: onBulkEmail,
          })}
        />
      }
    />
  )
}
