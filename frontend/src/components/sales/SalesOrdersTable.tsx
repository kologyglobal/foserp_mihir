import { useMemo, useState } from 'react'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import { Copy, Eye, MoreHorizontal, Pencil, Printer, Send, Trash2 } from 'lucide-react'
import { ErpDataGrid } from '../erp/ErpDataGrid'
import { TableLink } from '../ui/AppLink'
import { useMasterStore } from '../../store/masterStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import type { SalesOrder } from '../../types/mrp'
import { resolveSalesOrderValue } from './SalesOrder360Sections'
import { getSalesOrderFulfillmentLabel, isSalesOrderOverdue } from '../../utils/salesDashboardMetrics'
import { resolveSalesOrderDetailPath } from '../../utils/crmSalesOrderNavigation'
import { cn } from '../../utils/cn'
import {
  EnterpriseIdCell,
  EnterpriseNumericCell,
  EnterpriseRecordCell,
  EnterpriseRowActionsMenu,
  entNumericMeta,
} from '../../design-system/enterprise'
import { StatusBadge } from '../../design-system/list-page'
import { salesOrderStatusLabel, salesOrderStatusToneKey } from '../../utils/salesOrderStatus'
import { BulkActionToolbar } from '../../design-system/list-page/BulkActionToolbar'
import { buildEnterpriseBulkActions } from '../../design-system/list-page/buildEnterpriseBulkActions'
import { buildAiRowActions } from '../../design-system/list-page/aiRowActions'
import { CrmListFilterBar, type CrmListFilterBarProps } from '../crm/CrmListFilterBar'
import { useDensityClass } from '../../design-system/enterprise'

export interface SalesOrdersTableProps {
  rows: SalesOrder[]
  crmMode?: boolean
  onView: (row: SalesOrder) => void
  onEdit: (row: SalesOrder) => void
  onPreview?: (row: SalesOrder) => void
  onBulkExport?: (rows: SalesOrder[]) => void
  onBulkEmail?: (rows: SalesOrder[]) => void
  onDelete?: (row: SalesOrder) => void
  onPrint?: (row: SalesOrder) => void
  onConvert?: (row: SalesOrder) => void
  onDuplicate?: (row: SalesOrder) => void
  emptyMessage?: string
  search?: string
  onSearchChange?: (value: string) => void
  filterSlot?: React.ReactNode
  emptyAction?: React.ReactNode
  hasActiveFilters?: boolean
  onClearFilters?: () => void
  showCompactSearch?: boolean
  registerFilter?: CrmListFilterBarProps
}

export function SalesOrdersTable({
  rows,
  crmMode = false,
  onView,
  onEdit,
  onPreview,
  onBulkExport,
  onBulkEmail,
  onDelete,
  onPrint,
  onConvert,
  onDuplicate,
  emptyMessage,
  search = '',
  onSearchChange,
  filterSlot,
  emptyAction,
  hasActiveFilters,
  onClearFilters,
  showCompactSearch = false,
  registerFilter,
}: SalesOrdersTableProps) {
  const densityClass = useDensityClass()
  const customers = useMasterStore((s) => s.customers)
  const products = useMasterStore((s) => s.products)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const selectedRows = useMemo(() => {
    const ids = Object.keys(rowSelection).filter((k) => rowSelection[k])
    return rows.filter((r) => ids.includes(r.id))
  }, [rowSelection, rows])

  const columns: ColumnDef<SalesOrder>[] = useMemo(
    () => [
      {
        accessorKey: 'salesOrderNo',
        header: 'SO No',
        meta: { columnLabel: 'SO No' },
        cell: ({ row }) => (
          <TableLink to={resolveSalesOrderDetailPath(row.original.id, crmMode)}>
            <EnterpriseIdCell id={row.original.salesOrderNo} />
          </TableLink>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: { columnLabel: 'Status' },
        cell: ({ row }) => (
          <StatusBadge
            label={salesOrderStatusLabel(row.original.status)}
            status={salesOrderStatusToneKey(row.original.status)}
          />
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        meta: { columnLabel: 'Customer' },
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
          const p = products.find((p) => p.id === row.original.productId)
          return (
            <EnterpriseRecordCell
              primary={p?.productName ?? row.original.productId}
              subtitle={p?.productFamily}
            />
          )
        },
      },
      {
        accessorKey: 'qty',
        header: 'Qty',
        meta: entNumericMeta('Qty'),
        cell: ({ row }) => <EnterpriseNumericCell value={row.original.qty} />,
      },
      {
        accessorKey: 'requiredDate',
        header: 'Required',
        meta: { columnLabel: 'Required delivery' },
        cell: ({ row }) => {
          const overdue = isSalesOrderOverdue(row.original)
          return (
            <span className={cn(overdue && 'font-semibold text-erp-danger')}>
              {formatDate(row.original.requiredDate)}
            </span>
          )
        },
      },
      {
        id: 'fulfillment',
        header: 'Fulfillment',
        meta: { columnLabel: 'Fulfillment' },
        cell: ({ row }) => getSalesOrderFulfillmentLabel(row.original, workOrders),
      },
      {
        accessorKey: 'grandTotal',
        header: 'Value',
        meta: entNumericMeta('Order value'),
        cell: ({ row }) => {
          const v = resolveSalesOrderValue(
            row.original,
            products.find((p) => p.id === row.original.productId),
          )
          return <EnterpriseNumericCell value={v > 0 ? formatCurrency(v) : '—'} className="font-semibold text-erp-primary" />
        },
      },
      {
        accessorKey: 'orderDate',
        header: 'SO Date',
        meta: { columnLabel: 'SO Date' },
        cell: ({ row }) => formatDate(row.original.orderDate ?? row.original.createdAt),
      },
      {
        accessorKey: 'source',
        header: 'Source',
        meta: { columnLabel: 'Source' },
        cell: ({ row }) =>
          row.original.source === 'direct' && !row.original.quotationId
            ? 'Direct'
            : row.original.quotationId || row.original.source === 'quotation'
              ? 'Quotation'
              : '—',
      },
      {
        accessorKey: 'quotationNo',
        header: 'Quotation',
        meta: { columnLabel: 'Quotation' },
        cell: ({ row }) =>
          row.original.quotationNo
            ? (
              row.original.quotationId
                ? (
                  <TableLink to={`/crm/quotations/${row.original.quotationId}`}>
                    <EnterpriseIdCell id={`${row.original.quotationNo} Rev ${row.original.quotationRevisionNo ?? 1}`} />
                  </TableLink>
                )
                : `${row.original.quotationNo} Rev ${row.original.quotationRevisionNo ?? 1}`
              )
            : '—',
      },
      {
        id: 'wo',
        header: 'WO',
        meta: entNumericMeta('Work orders'),
        cell: ({ row }) => (
          <EnterpriseNumericCell value={workOrders.filter((w) => w.salesOrderId === row.original.id).length} />
        ),
      },
      {
        id: 'actions',
        header: '',
        meta: { align: 'center', columnLabel: 'Actions' },
        cell: ({ row }) => {
          const so = row.original
          const ai = buildAiRowActions({
            onAiSummary: onPreview ? () => onPreview(so) : undefined,
            onSuggestNext: () => onPreview?.(so),
          })
          return (
            <EnterpriseRowActionsMenu
              actions={[
                { id: 'view', label: 'View', icon: Eye, onClick: () => onView(so) },
                {
                  id: 'edit',
                  label: 'Edit',
                  icon: Pencil,
                  onClick: () => onEdit(so),
                  disabled: so.status !== 'open',
                },
                {
                  id: 'delete',
                  label: 'Delete',
                  icon: Trash2,
                  onClick: () => onDelete?.(so),
                  disabled: so.status !== 'open' || !onDelete,
                },
                { id: 'duplicate', label: 'Duplicate', icon: Copy, onClick: () => onDuplicate?.(so) },
                { id: 'print', label: 'Print', icon: Printer, onClick: () => onPrint?.(so) },
                {
                  id: 'convert',
                  label: so.status === 'open' ? 'Confirm Order' : 'Convert to Production',
                  icon: Send,
                  onClick: () => onConvert?.(so),
                },
                ...ai,
                { id: 'more', label: 'More Actions', icon: MoreHorizontal, onClick: () => onPreview?.(so) },
              ]}
            />
          )
        },
      },
    ],
    [customers, products, workOrders, crmMode, onView, onEdit, onPreview, onDelete, onPrint, onConvert, onDuplicate],
  )

  const resolvedEmptyMessage = emptyMessage ?? (hasActiveFilters ? 'No sales orders match current filters.' : 'No sales orders found.')

  return (
    <ErpDataGrid
      className={cn('erp-sales-orders-table', densityClass)}
      data={rows}
      columns={columns}
      recordLabel="Sales Orders"
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search SO, customer, product, PO…"
      stickyFirstColumn
      showCompactSearch={showCompactSearch}
      showToolbarExport={false}
      exportFileName="sales-orders"
      emptyMessage={resolvedEmptyMessage}
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
      registerBar={
        registerFilter ? (
          <CrmListFilterBar {...registerFilter} className="crm-list-filter-bar--embedded" />
        ) : undefined
      }
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
