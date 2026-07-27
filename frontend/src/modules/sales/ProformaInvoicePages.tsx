import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { type ColumnDef, type RowSelectionState } from '@tanstack/react-table'
import { Download, FileText, Plus, Printer, Save, Send, XCircle, FileSpreadsheet, Eye, Banknote, Receipt } from 'lucide-react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { SaveViewDialog } from '../../components/design-system/SaveViewDialog'
import { StatusDot } from '../../components/design-system/StatusDot'
import { EnterpriseRegisterTableShell } from '../../design-system/list-page/EnterpriseRegisterTableShell'
import { BulkActionToolbar } from '../../design-system/list-page/BulkActionToolbar'
import { buildEnterpriseBulkActions } from '../../design-system/list-page/buildEnterpriseBulkActions'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpDataGrid } from '../../components/erp/ErpDataGrid'
import { ErpCardSection, ErpFieldRow } from '../../components/erp/card-form'
import { CrmFilterDrawer } from '../../components/crm/CrmFilterDrawer'
import { CrmListFilterBar, CrmListSortSelect, type CrmListFilterBarProps } from '../../components/crm/CrmListFilterBar'
import { TableLink } from '../../components/ui/AppLink'
import { Toast } from '../../components/ui/Toast'
import { salesCustomer360Path } from '../../config/entity360Routes'
import { useProformaInvoiceStore } from '../../store/proformaInvoiceStore'
import { useCrmCommercialStore } from '../../store/crmCommercialStore'
import { useMasterStore } from '../../store/masterStore'
import { useSavedViews } from '../../hooks/useSavedViews'
import { useCrmFilterDrawer } from '../../hooks/useCrmFilterDrawer'
import { PROFORMA_REGISTER_PRESETS } from '../../config/savedViewPresets'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { buildProformaRegisterKpis } from '../../utils/salesModuleKpis'
import { gstSchemeLabel } from '../../utils/gstEngine'
import { exportRowsToCsv } from '../../utils/exportCsv'
import { cn } from '../../utils/cn'
import {
  EnterpriseIdCell,
  EnterpriseNumericCell,
  EnterpriseRowActionsMenu,
  entNumericMeta,
  useDensityClass,
} from '../../design-system/enterprise'
import type { ProformaInvoice, ProformaInvoiceSource, ProformaInvoiceStatus } from '../../types/proformaInvoice'
import { PROFORMA_STATUS_LABELS } from '../../types/proformaInvoice'
import { PROFORMA_PAYMENT_STATUS_LABELS } from '../../types/crmCommercial'
import type { CrmFilterField } from '../../types/crmListFilters'
import { ProformaInvoiceDocument } from '../../components/sales/ProformaInvoiceDocument'
import { buildProformaNewUrl } from '../../utils/proformaInvoicePrefill'
import { downloadProformaExcel, downloadProformaPdf, printProformaDocument } from '../../utils/proformaInvoiceExport'
import { notify } from '../../store/toastStore'
import { canCrmPermission } from '../../utils/permissions/crm'
import type { StatusDotTone } from '../../components/design-system/StatusDot'
import { salesModuleBreadcrumbs, salesChildBreadcrumbs } from '../../utils/salesNavigation'

type ProformaSortKey = 'proformaDate' | 'validUntil' | 'customer' | 'value' | 'status' | 'proformaNo' | 'createdAt'

const PROFORMA_FILTER_FIELDS: CrmFilterField[] = [
  {
    type: 'select',
    key: 'status',
    label: 'Status',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'issued', label: 'Issued' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
  },
  {
    type: 'select',
    key: 'source',
    label: 'Source',
    options: [
      { value: 'direct', label: 'Direct' },
      { value: 'sales_order', label: 'From SO' },
    ],
  },
  {
    type: 'select',
    key: 'expired',
    label: 'Validity',
    options: [
      { value: '1', label: 'Expired only' },
      { value: '0', label: 'Not expired' },
    ],
  },
  {
    type: 'date-range',
    label: 'Document Date',
    fromKey: 'dateFrom',
    toKey: 'dateTo',
  },
  {
    type: 'date-range',
    label: 'Valid Until',
    fromKey: 'validFrom',
    toKey: 'validTo',
  },
]

const PROFORMA_SORT_OPTIONS: { value: ProformaSortKey; label: string }[] = [
  { value: 'proformaDate', label: 'Sort: Document Date' },
  { value: 'validUntil', label: 'Sort: Valid Until' },
  { value: 'customer', label: 'Sort: Customer' },
  { value: 'value', label: 'Sort: Amount Incl. Tax' },
  { value: 'status', label: 'Sort: Status' },
  { value: 'proformaNo', label: 'Sort: Proforma No.' },
  { value: 'createdAt', label: 'Sort: Created' },
]

async function handleProformaPdfDownload(proforma: Parameters<typeof downloadProformaPdf>[0]) {
  notify.info('Preparing PDF…')
  const result = await downloadProformaPdf(proforma)
  if (result.ok) notify.success(`Downloaded ${result.fileName}`)
  else notify.error(result.error)
}

function proformaListBreadcrumbs() {
  return salesModuleBreadcrumbs('Proforma Invoices', '/sales/proforma-invoices')
}

function proformaDetailBreadcrumbs(title: string) {
  return salesChildBreadcrumbs('Proforma Invoices', '/sales/proforma-invoices', title)
}

function proformaStatusTone(status: ProformaInvoiceStatus): StatusDotTone {
  if (status === 'issued') return 'success'
  if (status === 'cancelled') return 'danger'
  return 'neutral'
}

function proformaSourceLabel(source: ProformaInvoiceSource): string {
  return source === 'sales_order' ? 'From SO' : 'Direct'
}

function isProformaExpired(pi: ProformaInvoice): boolean {
  if (pi.status !== 'issued') return false
  return pi.validUntil.slice(0, 10) < new Date().toISOString().slice(0, 10)
}

function proformaTotalQty(pi: ProformaInvoice): number {
  return pi.lines.reduce((sum, line) => sum + line.qty, 0)
}

function truncateCell(value: string | null | undefined, max = 28): string {
  const text = (value ?? '').trim()
  if (!text) return '—'
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function sortProformas(list: ProformaInvoice[], sortBy: ProformaSortKey): ProformaInvoice[] {
  const next = [...list]
  next.sort((a, b) => {
    switch (sortBy) {
      case 'customer':
        return a.customerName.localeCompare(b.customerName) || b.proformaNo.localeCompare(a.proformaNo)
      case 'value':
        return b.gst.grandTotal - a.gst.grandTotal
      case 'status':
        return a.status.localeCompare(b.status) || b.proformaDate.localeCompare(a.proformaDate)
      case 'proformaNo':
        return b.proformaNo.localeCompare(a.proformaNo)
      case 'validUntil':
        return b.validUntil.localeCompare(a.validUntil) || b.proformaNo.localeCompare(a.proformaNo)
      case 'createdAt':
        return b.createdAt.localeCompare(a.createdAt)
      case 'proformaDate':
      default:
        return b.proformaDate.localeCompare(a.proformaDate) || b.proformaNo.localeCompare(a.proformaNo)
    }
  })
  return next
}

function ProformaInvoiceTable({
  data,
  getCustomer,
  search,
  onSearchChange,
  showCompactSearch = false,
  hasActiveFilters,
  onClearFilters,
  registerFilter,
  emptyAction,
  onRowView,
  onRowPrint,
  onCreateInvoice,
  onReceivePayment,
  canCreateInvoice = false,
  canReceivePayment = false,
  getProformaReceivedAmount,
  onBulkExport,
}: {
  data: ProformaInvoice[]
  getCustomer: ReturnType<typeof useMasterStore.getState>['getCustomer']
  search: string
  onSearchChange: (value: string) => void
  showCompactSearch?: boolean
  hasActiveFilters?: boolean
  onClearFilters?: () => void
  registerFilter?: CrmListFilterBarProps
  emptyAction?: React.ReactNode
  onRowView?: (row: ProformaInvoice) => void
  onRowPrint?: (row: ProformaInvoice) => void
  onCreateInvoice?: (row: ProformaInvoice) => void
  onReceivePayment?: (row: ProformaInvoice) => void
  canCreateInvoice?: boolean
  canReceivePayment?: boolean
  getProformaReceivedAmount?: (proformaId: string) => number
  onBulkExport?: (rows: ProformaInvoice[]) => void
}) {
  const densityClass = useDensityClass()
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const columns = useMemo<ColumnDef<ProformaInvoice, unknown>[]>(
    () => [
      {
        accessorKey: 'proformaNo',
        header: 'No.',
        meta: { columnLabel: 'Proforma No.' },
        enableSorting: false,
        cell: ({ row }) => (
          <TableLink to={`/sales/proforma-invoices/${row.original.id}`}>
            <EnterpriseIdCell id={row.original.proformaNo} />
          </TableLink>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: { columnLabel: 'Status' },
        enableSorting: false,
        cell: ({ row }) => (
          <StatusDot
            label={PROFORMA_STATUS_LABELS[row.original.status]}
            tone={proformaStatusTone(row.original.status)}
          />
        ),
      },
      {
        accessorKey: 'customerName',
        header: 'Customer Name',
        meta: { columnLabel: 'Customer' },
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-[200px] truncate" title={row.original.customerName}>
            <TableLink to={salesCustomer360Path(row.original.customerId)}>
              {row.original.customerName}
            </TableLink>
          </span>
        ),
      },
      {
        id: 'customerNo',
        header: 'Customer No.',
        meta: { columnLabel: 'Customer No.' },
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-erp-muted">
            {getCustomer(row.original.customerId)?.customerCode ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'proformaDate',
        header: 'Document Date',
        meta: { columnLabel: 'Document Date' },
        enableSorting: false,
        cell: ({ row }) => formatDate(row.original.proformaDate),
      },
      {
        accessorKey: 'validUntil',
        header: 'Valid Until',
        meta: { columnLabel: 'Valid Until' },
        enableSorting: false,
        cell: ({ row }) => {
          const expired = isProformaExpired(row.original)
          return (
            <span className={cn(expired && 'font-semibold text-erp-danger')} title={expired ? 'Validity expired' : undefined}>
              {formatDate(row.original.validUntil)}
            </span>
          )
        },
      },
      {
        id: 'salesOrderNo',
        header: 'SO No.',
        meta: { columnLabel: 'Sales Order' },
        enableSorting: false,
        cell: ({ row }) =>
          row.original.salesOrderNo && row.original.salesOrderId
            ? <TableLink to={`/sales/orders/${row.original.salesOrderId}`}>{row.original.salesOrderNo}</TableLink>
            : '—',
      },
      {
        id: 'quotationNo',
        header: 'Quotation No.',
        meta: { columnLabel: 'Quotation' },
        enableSorting: false,
        cell: ({ row }) =>
          row.original.quotationNo && row.original.quotationId
            ? <TableLink to={`/crm/quotations/${row.original.quotationId}`}>{row.original.quotationNo}</TableLink>
            : '—',
      },
      {
        accessorKey: 'customerPoNumber',
        header: 'Customer PO',
        meta: { columnLabel: 'Customer PO' },
        enableSorting: false,
        cell: ({ row }) => row.original.customerPoNumber ?? '—',
      },
      {
        accessorKey: 'placeOfSupply',
        header: 'Place of Supply',
        meta: { columnLabel: 'Place of Supply' },
        enableSorting: false,
        cell: ({ row }) => truncateCell(row.original.placeOfSupply, 22),
      },
      {
        accessorKey: 'customerGstin',
        header: 'Customer GSTIN',
        meta: { columnLabel: 'GSTIN' },
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-erp-muted">{row.original.customerGstin || '—'}</span>
        ),
      },
      {
        id: 'lines',
        header: 'Lines',
        meta: entNumericMeta('Lines'),
        enableSorting: false,
        cell: ({ row }) => <EnterpriseNumericCell value={row.original.lines.length} />,
      },
      {
        id: 'totalQty',
        header: 'Total Qty',
        meta: entNumericMeta('Total Qty'),
        enableSorting: false,
        cell: ({ row }) => <EnterpriseNumericCell value={formatNumber(proformaTotalQty(row.original))} />,
      },
      {
        id: 'taxableAmount',
        header: 'Amount Excl. Tax',
        meta: entNumericMeta('Amount Excl. Tax'),
        enableSorting: false,
        cell: ({ row }) => <EnterpriseNumericCell value={formatCurrency(row.original.gst.taxableAmount)} />,
      },
      {
        id: 'gstAmount',
        header: 'GST Amount',
        meta: entNumericMeta('GST Amount'),
        enableSorting: false,
        cell: ({ row }) => <EnterpriseNumericCell value={formatCurrency(row.original.gst.totalTax)} />,
      },
      {
        id: 'grandTotal',
        header: 'Amount Incl. Tax',
        meta: entNumericMeta('Amount Incl. Tax'),
        enableSorting: false,
        cell: ({ row }) => (
          <EnterpriseNumericCell value={formatCurrency(row.original.gst.grandTotal)} className="font-semibold" />
        ),
      },
      {
        id: 'gstScheme',
        header: 'GST Scheme',
        meta: { columnLabel: 'GST Scheme' },
        enableSorting: false,
        cell: ({ row }) => gstSchemeLabel(row.original.gst.scheme),
      },
      {
        accessorKey: 'paymentTerms',
        header: 'Payment Terms',
        meta: { columnLabel: 'Payment Terms' },
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-[180px] truncate" title={row.original.paymentTerms}>
            {truncateCell(row.original.paymentTerms, 36)}
          </span>
        ),
      },
      {
        accessorKey: 'deliveryTerms',
        header: 'Delivery Terms',
        meta: { columnLabel: 'Delivery Terms' },
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-[180px] truncate" title={row.original.deliveryTerms}>
            {truncateCell(row.original.deliveryTerms, 36)}
          </span>
        ),
      },
      {
        id: 'source',
        header: 'Source',
        meta: { columnLabel: 'Source' },
        enableSorting: false,
        cell: ({ row }) => proformaSourceLabel(row.original.source),
      },
      {
        accessorKey: 'issuedAt',
        header: 'Issued Date',
        meta: { columnLabel: 'Issued Date' },
        enableSorting: false,
        cell: ({ row }) => (row.original.issuedAt ? formatDate(row.original.issuedAt.slice(0, 10)) : '—'),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        meta: { columnLabel: 'Created' },
        enableSorting: false,
        cell: ({ row }) => formatDate(row.original.createdAt.slice(0, 10)),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        meta: { columnLabel: 'Actions' },
        cell: ({ row }) => {
          const pi = row.original
          const issued = pi.status === 'issued'
          const received = getProformaReceivedAmount?.(pi.id) ?? 0
          const balance = Math.max(0, pi.gst.grandTotal - received)
          const showCreateInvoice = issued && canCreateInvoice
          const showReceivePayment = issued && canReceivePayment && balance > 0.009
          return (
            <EnterpriseRowActionsMenu
              actions={[
                {
                  id: 'view',
                  label: 'View',
                  icon: Eye,
                  onClick: () => onRowView?.(pi),
                },
                ...(showCreateInvoice
                  ? [{
                      id: 'create-invoice',
                      label: 'Create Tax Invoice',
                      icon: Receipt,
                      onClick: () => onCreateInvoice?.(pi),
                    }]
                  : []),
                ...(showReceivePayment
                  ? [{
                      id: 'receive-payment',
                      label: 'Receive Payment',
                      icon: Banknote,
                      onClick: () => onReceivePayment?.(pi),
                    }]
                  : []),
                {
                  id: 'print',
                  label: 'Print / PDF',
                  icon: Printer,
                  onClick: () => onRowPrint?.(pi),
                },
              ]}
            />
          )
        },
      },
    ],
    [
      getCustomer,
      onRowView,
      onRowPrint,
      onCreateInvoice,
      onReceivePayment,
      canCreateInvoice,
      canReceivePayment,
      getProformaReceivedAmount,
    ],
  )

  const selectedRows = useMemo(
    () => data.filter((row) => rowSelection[row.id]),
    [data, rowSelection],
  )

  const emptyMessage = hasActiveFilters
    ? 'No proforma invoices match current filters.'
    : 'No proforma invoices yet. Create one direct or from a sales order.'

  return (
    <ErpDataGrid
      className={cn('erp-proforma-invoices-table', densityClass)}
      data={data}
      columns={columns}
      recordLabel="Proforma Invoices"
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search no., customer, SO, quotation, PO, GSTIN…"
      stickyFirstColumn
      showCompactSearch={showCompactSearch}
      showToolbarExport={false}
      enableColumnSorting={false}
      exportFileName="proforma-invoices"
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
      registerBar={
        registerFilter ? (
          <CrmListFilterBar {...registerFilter} className="crm-list-filter-bar--embedded" />
        ) : undefined
      }
      selectable
      getRowId={(row) => row.id}
      rowSelection={rowSelection}
      onRowSelectionChange={setRowSelection}
      onRowQuickView={onRowView}
      bulkActions={
        <BulkActionToolbar
          count={selectedRows.length}
          entityLabel="selected"
          onClear={() => setRowSelection({})}
          actions={buildEnterpriseBulkActions(selectedRows, {
            onExport: onBulkExport,
          })}
        />
      }
    />
  )
}

export function ProformaInvoiceListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const proformas = useProformaInvoiceStore((s) => s.proformaInvoices)
  const getCustomer = useMasterStore((s) => s.getCustomer)
  const receipts = useCrmCommercialStore((s) => s.receipts)
  const canCreateInvoice = canCrmPermission('crm.commercial.invoice.create')
  const canReceivePayment = canCrmPermission('crm.commercial.receipt.create')
  const receivedAmountByProformaId = useMemo(() => {
    const map = new Map<string, number>()
    for (const receipt of receipts) {
      if (!receipt.proformaInvoiceId) continue
      map.set(receipt.proformaInvoiceId, (map.get(receipt.proformaInvoiceId) ?? 0) + receipt.amount)
    }
    return map
  }, [receipts])
  const getProformaReceivedAmount = useCallback(
    (proformaId: string) => receivedAmountByProformaId.get(proformaId) ?? 0,
    [receivedAmountByProformaId],
  )

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProformaInvoiceStatus | ''>('')
  const [sourceFilter, setSourceFilter] = useState<ProformaInvoiceSource | ''>('')
  const [expiredFilter, setExpiredFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [sortBy, setSortBy] = useState<ProformaSortKey>('proformaDate')
  const [urlSeeded, setUrlSeeded] = useState(false)

  useEffect(() => {
    if (urlSeeded) return
    const status = searchParams.get('status') ?? ''
    const source = searchParams.get('source') ?? ''
    const expired = searchParams.get('expired') ?? ''
    if (status === 'draft' || status === 'issued' || status === 'cancelled') setStatusFilter(status)
    if (source === 'direct' || source === 'sales_order') setSourceFilter(source)
    if (expired === '1' || expired === '0') setExpiredFilter(expired)
    setUrlSeeded(true)
  }, [searchParams, urlSeeded])

  useEffect(() => {
    if (!urlSeeded) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        const sync = (key: string, value: string) => {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        sync('status', statusFilter)
        sync('source', sourceFilter)
        sync('expired', expiredFilter)
        return next
      },
      { replace: true },
    )
  }, [statusFilter, sourceFilter, expiredFilter, urlSeeded, setSearchParams])

  const filtersRecord = useMemo(
    () => ({
      search,
      status: statusFilter,
      source: sourceFilter,
      expired: expiredFilter,
      dateFrom,
      dateTo,
      validFrom,
      validTo,
      sortBy,
    }),
    [search, statusFilter, sourceFilter, expiredFilter, dateFrom, dateTo, validFrom, validTo, sortBy],
  )

  const applyFilters = useCallback((saved: Record<string, string>) => {
    setSearch(saved.search ?? '')
    setStatusFilter((saved.status as ProformaInvoiceStatus | '') || '')
    setSourceFilter((saved.source as ProformaInvoiceSource | '') || '')
    setExpiredFilter(saved.expired ?? '')
    setDateFrom(saved.dateFrom ?? '')
    setDateTo(saved.dateTo ?? '')
    setValidFrom(saved.validFrom ?? '')
    setValidTo(saved.validTo ?? '')
    const sb = saved.sortBy as ProformaSortKey
    if (PROFORMA_SORT_OPTIONS.some((o) => o.value === sb)) setSortBy(sb)
  }, [])

  const savedViews = useSavedViews({
    pageId: '/sales/proforma-invoices',
    filters: filtersRecord,
    onApply: applyFilters,
    systemPresets: PROFORMA_REGISTER_PRESETS,
  })

  const filterDrawer = useCrmFilterDrawer({
    values: {
      search,
      status: statusFilter,
      source: sourceFilter,
      expired: expiredFilter,
      dateFrom,
      dateTo,
      validFrom,
      validTo,
    },
    onChange: (next) => {
      if (typeof next.search === 'string') setSearch(next.search)
      if (typeof next.status === 'string') setStatusFilter(next.status as ProformaInvoiceStatus | '')
      if (typeof next.source === 'string') setSourceFilter(next.source as ProformaInvoiceSource | '')
      if (typeof next.expired === 'string') setExpiredFilter(next.expired)
      if (typeof next.dateFrom === 'string') setDateFrom(next.dateFrom)
      if (typeof next.dateTo === 'string') setDateTo(next.dateTo)
      if (typeof next.validFrom === 'string') setValidFrom(next.validFrom)
      if (typeof next.validTo === 'string') setValidTo(next.validTo)
    },
    fields: PROFORMA_FILTER_FIELDS,
    defaults: {
      search: '',
      status: '',
      source: '',
      expired: '',
      dateFrom: '',
      dateTo: '',
      validFrom: '',
      validTo: '',
    },
    chipLabelResolver: (key, value) => {
      if (key === 'status') return PROFORMA_STATUS_LABELS[value as ProformaInvoiceStatus] ?? value
      if (key === 'source') return value === 'sales_order' ? 'From SO' : 'Direct'
      if (key === 'expired') return value === '1' ? 'Expired' : 'Not expired'
      return undefined
    },
  })

  const clearFilters = useCallback(() => {
    filterDrawer.clearAll()
    setSortBy('proformaDate')
  }, [filterDrawer])

  const filtered = useMemo(() => {
    let list = [...proformas]
    if (statusFilter) list = list.filter((p) => p.status === statusFilter)
    if (sourceFilter) list = list.filter((p) => p.source === sourceFilter)
    if (expiredFilter === '1') list = list.filter((p) => isProformaExpired(p))
    if (expiredFilter === '0') list = list.filter((p) => !isProformaExpired(p))
    if (dateFrom) list = list.filter((p) => p.proformaDate.slice(0, 10) >= dateFrom)
    if (dateTo) list = list.filter((p) => p.proformaDate.slice(0, 10) <= dateTo)
    if (validFrom) list = list.filter((p) => p.validUntil.slice(0, 10) >= validFrom)
    if (validTo) list = list.filter((p) => p.validUntil.slice(0, 10) <= validTo)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((p) => {
        const customerCode = getCustomer(p.customerId)?.customerCode ?? ''
        return (
          p.proformaNo.toLowerCase().includes(q) ||
          p.customerName.toLowerCase().includes(q) ||
          customerCode.toLowerCase().includes(q) ||
          (p.salesOrderNo ?? '').toLowerCase().includes(q) ||
          (p.quotationNo ?? '').toLowerCase().includes(q) ||
          (p.customerPoNumber ?? '').toLowerCase().includes(q) ||
          (p.customerGstin ?? '').toLowerCase().includes(q) ||
          p.placeOfSupply.toLowerCase().includes(q)
        )
      })
    }
    return sortProformas(list, sortBy)
  }, [
    proformas,
    search,
    statusFilter,
    sourceFilter,
    expiredFilter,
    dateFrom,
    dateTo,
    validFrom,
    validTo,
    sortBy,
    getCustomer,
  ])

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        search.trim() ||
          statusFilter ||
          sourceFilter ||
          expiredFilter ||
          dateFrom ||
          dateTo ||
          validFrom ||
          validTo,
      ),
    [search, statusFilter, sourceFilter, expiredFilter, dateFrom, dateTo, validFrom, validTo],
  )

  const draftCount = proformas.filter((p) => p.status === 'draft').length
  const issuedCount = proformas.filter((p) => p.status === 'issued').length
  const expiredCount = proformas.filter((p) => isProformaExpired(p)).length
  const totalValue = proformas.filter((p) => p.status !== 'cancelled').reduce((s, p) => s + p.gst.grandTotal, 0)

  const proformaInsights = useMemo(
    () =>
      buildProformaRegisterKpis(
        { total: proformas.length, draft: draftCount, issued: issuedCount, expired: expiredCount, totalValue },
        statusFilter,
        (s) => setStatusFilter(s as ProformaInvoiceStatus | ''),
      ),
    [proformas.length, draftCount, issuedCount, expiredCount, totalValue, statusFilter],
  )

  function exportProformas(rows: ProformaInvoice[] = filtered) {
    exportRowsToCsv(
      'proforma-invoices',
      [
        'Proforma No',
        'Status',
        'Customer',
        'Customer No',
        'Document Date',
        'Valid Until',
        'SO No',
        'Quotation No',
        'Customer PO',
        'Source',
        'Taxable',
        'GST',
        'Grand Total',
      ],
      rows.map((p) => [
        p.proformaNo,
        PROFORMA_STATUS_LABELS[p.status],
        p.customerName,
        getCustomer(p.customerId)?.customerCode ?? '',
        p.proformaDate,
        p.validUntil,
        p.salesOrderNo ?? '',
        p.quotationNo ?? '',
        p.customerPoNumber ?? '',
        proformaSourceLabel(p.source),
        p.gst.taxableAmount,
        p.gst.totalTax,
        p.gst.grandTotal,
      ]),
    )
  }

  return (
    <>
      <OperationalPageShell
        variant="dynamics"
        badge="Sales"
        title="Proforma Invoices"
        description="Advance billing documents — create direct or from confirmed sales orders"
        breadcrumbs={proformaListBreadcrumbs()}
        autoBreadcrumbs={false}
        favoritePath="/sales/proforma-invoices"
        commandBar={(
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={{ id: 'new', label: 'New Proforma', icon: Plus, onClick: () => navigate('/sales/proforma-invoices/new') }}
            secondaryActions={[
              { id: 'export', label: 'Export', icon: Download, onClick: () => exportProformas() },
              { id: 'orders', label: 'Sales Orders', icon: FileText, onClick: () => navigate('/sales/orders') },
            ]}
            moreActions={[
              { id: 'save-view', label: 'Save View', icon: Save, onClick: savedViews.openSaveDialog },
            ]}
          />
        )}
        kpiStrip={proformaInsights}
      >
        <EnterpriseRegisterTableShell>
          <ProformaInvoiceTable
            data={filtered}
            getCustomer={getCustomer}
            search={search}
            onSearchChange={setSearch}
            showCompactSearch={false}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            registerFilter={{
              search,
              onSearchChange: setSearch,
              searchPlaceholder: 'Search no., customer, SO, quotation, PO, GSTIN…',
              activeFilterCount: filterDrawer.activeCount,
              onOpenFilters: filterDrawer.openDrawer,
              chips: filterDrawer.chips,
              onRemoveChip: filterDrawer.removeChip,
              onClearAll: clearFilters,
              savedView: savedViews.activeView,
              onSavedViewChange: savedViews.selectView,
              savedViews: savedViews.viewNames,
              onSaveView: savedViews.openSaveDialog,
              sort: (
                <CrmListSortSelect
                  value={sortBy}
                  onChange={(v) => setSortBy(v as ProformaSortKey)}
                  aria-label="Sort proforma invoices"
                  options={PROFORMA_SORT_OPTIONS}
                />
              ),
            }}
            emptyAction={
              filtered.length === 0 ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    className="erp-btn erp-btn--primary text-[13px]"
                    onClick={() => navigate('/sales/proforma-invoices/new')}
                  >
                    New Proforma
                  </button>
                  {hasActiveFilters ? (
                    <button type="button" className="erp-btn erp-btn--secondary text-[13px]" onClick={clearFilters}>
                      Clear Filters
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="erp-btn erp-btn--secondary text-[13px]"
                      onClick={() => navigate('/sales/orders')}
                    >
                      From Sales Order
                    </button>
                  )}
                </div>
              ) : undefined
            }
            onRowView={(row) => navigate(`/sales/proforma-invoices/${row.id}`)}
            onRowPrint={(row) => navigate(`/sales/proforma-invoices/${row.id}/print`)}
            onCreateInvoice={(row) => navigate(`/sales/invoices/new?proformaId=${row.id}`)}
            onReceivePayment={(row) => navigate(`/sales/proforma-invoices/${row.id}/receive-payment`)}
            canCreateInvoice={canCreateInvoice}
            canReceivePayment={canReceivePayment}
            getProformaReceivedAmount={getProformaReceivedAmount}
            onBulkExport={exportProformas}
          />
        </EnterpriseRegisterTableShell>
      </OperationalPageShell>

      <SaveViewDialog
        open={savedViews.saveDialogOpen}
        defaultName={savedViews.activeView === 'My View' ? '' : savedViews.activeView}
        onClose={savedViews.closeSaveDialog}
        onSave={savedViews.saveCurrentView}
      />
      <CrmFilterDrawer
        open={filterDrawer.open}
        onClose={filterDrawer.closeDrawer}
        fields={PROFORMA_FILTER_FIELDS}
        values={filterDrawer.draft}
        onChange={(next) => filterDrawer.setDraft({ ...filterDrawer.draft, ...next })}
        onApply={filterDrawer.applyFilters}
        onReset={filterDrawer.resetDraft}
      />
    </>
  )
}

export function ProformaInvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const proforma = useProformaInvoiceStore((s) => (id ? s.getProforma(id) : undefined))
  const issue = useProformaInvoiceStore((s) => s.issue)
  const cancel = useProformaInvoiceStore((s) => s.cancel)
  const allReceipts = useCrmCommercialStore((s) => s.receipts)
  const paymentHistory = useMemo(
    () => (id ? allReceipts.filter((r) => r.proformaInvoiceId === id) : []),
    [allReceipts, id],
  )
  const paymentSummary = useMemo(() => {
    if (!proforma) return null
    const amountReceived = paymentHistory.reduce((s, r) => s + r.amount, 0)
    const totalAmount = proforma.gst.grandTotal
    return {
      totalAmount,
      amountReceived,
      balanceAmount: Math.max(0, totalAmount - amountReceived),
      paymentStatus:
        amountReceived <= 0.009
          ? ('unpaid' as const)
          : amountReceived + 0.009 >= totalAmount
            ? ('fully_paid' as const)
            : ('partially_paid' as const),
    }
  }, [proforma, paymentHistory])
  const [toast, setToast] = useState<string | null>(null)

  if (!proforma) {
    return (
      <OperationalPageShell title="Proforma not found" breadcrumbs={proformaDetailBreadcrumbs('Not Found')}>
        <Link to="/sales/proforma-invoices" className="text-sm font-semibold text-erp-primary">Back to register</Link>
      </OperationalPageShell>
    )
  }

  function act(label: string, fn: () => { ok: boolean; error?: string }) {
    const r = fn()
    setToast(r.ok ? label : (r.error ?? 'Action failed'))
  }

  const canReceive =
    proforma.status === 'issued'
    && (paymentSummary?.balanceAmount ?? proforma.gst.grandTotal) > 0.009
    && canCrmPermission('crm.commercial.receipt.create')
  const canCreateInvoice = proforma.status === 'issued' && canCrmPermission('crm.commercial.invoice.create')

  return (
    <>
      <Toast message={toast} />
      <OperationalPageShell
        variant="dynamics"
        badge="Sales"
        title={proforma.proformaNo}
        description={`${proforma.customerName} · ${PROFORMA_STATUS_LABELS[proforma.status]}`}
        breadcrumbs={proformaDetailBreadcrumbs(proforma.proformaNo)}
        favoritePath={`/sales/proforma-invoices/${proforma.id}`}
        commandBar={(
          <ErpCommandBar
            sticky={false}
            primaryAction={
              proforma.status === 'draft'
                ? { id: 'issue', label: 'Issue Proforma', icon: Send, onClick: () => act('Proforma issued', () => issue(proforma.id)) }
                : canReceive
                  ? {
                      id: 'receive',
                      label: 'Receive Payment',
                      icon: Banknote,
                      onClick: () => navigate(`/sales/proforma-invoices/${proforma.id}/receive-payment`),
                    }
                  : { id: 'print', label: 'Print', icon: Printer, onClick: () => navigate(`/sales/proforma-invoices/${proforma.id}/print`) }
            }
            secondaryActions={[
              ...(canCreateInvoice
                ? [{
                    id: 'invoice',
                    label: 'Create Invoice',
                    icon: Receipt,
                    onClick: () => navigate(`/sales/invoices/new?proformaId=${proforma.id}`),
                  }]
                : []),
              { id: 'print', label: 'Print', icon: Printer, onClick: () => navigate(`/sales/proforma-invoices/${proforma.id}/print`) },
              { id: 'pdf', label: 'Download PDF', icon: Download, onClick: () => void handleProformaPdfDownload(proforma) },
              { id: 'excel', label: 'Export Excel', icon: FileSpreadsheet, onClick: () => downloadProformaExcel(proforma) },
              ...(proforma.status !== 'cancelled'
                ? [{ id: 'cancel', label: 'Cancel', icon: XCircle, onClick: () => act('Proforma cancelled', () => cancel(proforma.id)) }]
                : []),
              ...(proforma.salesOrderId
                ? [{ id: 'so', label: 'Sales Order', icon: FileText, onClick: () => navigate(`/sales/orders/${proforma.salesOrderId}`) }]
                : []),
            ]}
          />
        )}
        insights={[
          { label: 'Status', value: PROFORMA_STATUS_LABELS[proforma.status], accent: proforma.status === 'issued' ? 'green' : 'amber' },
          { label: 'Grand Total', value: formatCurrency(proforma.gst.grandTotal), accent: 'blue' },
          {
            label: 'Payment',
            value: paymentSummary ? PROFORMA_PAYMENT_STATUS_LABELS[paymentSummary.paymentStatus] : '—',
            accent: paymentSummary?.paymentStatus === 'fully_paid' ? 'green' : 'amber',
          },
          { label: 'Balance', value: paymentSummary ? formatCurrency(paymentSummary.balanceAmount) : formatCurrency(proforma.gst.grandTotal), accent: 'slate' },
        ]}
      >
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <ProformaInvoiceDocument proforma={proforma} />
            {proforma.status === 'issued' ? (
              <ErpCardSection title="Payment history">
                <div className="col-span-2 space-y-2">
                  {paymentHistory.length === 0 ? (
                    <p className="text-[13px] text-erp-muted">No payments received yet.</p>
                  ) : (
                    paymentHistory.map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-erp-border px-3 py-2 text-[13px]">
                        <div>
                          <TableLink to={`/sales/receipts/${r.id}`}>{r.receiptNo}</TableLink>
                          <span className="ml-2 text-erp-muted">
                            {formatDate(r.receiptDate)} · {r.paymentMode.toUpperCase()}
                            {r.transactionRef ? ` · ${r.transactionRef}` : ''}
                          </span>
                        </div>
                        <span className="font-semibold">{formatCurrency(r.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </ErpCardSection>
            ) : null}
          </div>
          <aside className="space-y-4">
            {paymentSummary ? (
              <ErpCardSection title="Payment summary" columns={1}>
                <ErpFieldRow label="Proforma Amount" readOnly>{formatCurrency(paymentSummary.totalAmount)}</ErpFieldRow>
                <ErpFieldRow label="Amount Received" readOnly>{formatCurrency(paymentSummary.amountReceived)}</ErpFieldRow>
                <ErpFieldRow label="Balance Amount" readOnly>{formatCurrency(paymentSummary.balanceAmount)}</ErpFieldRow>
                <ErpFieldRow label="Payment Status" readOnly>
                  {PROFORMA_PAYMENT_STATUS_LABELS[paymentSummary.paymentStatus]}
                </ErpFieldRow>
              </ErpCardSection>
            ) : null}
            <ErpCardSection title="Document links" columns={1}>
              {proforma.salesOrderId ? (
                <ErpFieldRow label="Sales Order">
                  <TableLink to={`/sales/orders/${proforma.salesOrderId}`}>{proforma.salesOrderNo}</TableLink>
                </ErpFieldRow>
              ) : null}
              {proforma.quotationId ? (
                <ErpFieldRow label="Quotation">
                  <TableLink to={`/crm/quotations/${proforma.quotationId}`}>{proforma.quotationNo ?? proforma.quotationId}</TableLink>
                </ErpFieldRow>
              ) : null}
              <ErpFieldRow label="Customer">
                <TableLink to={salesCustomer360Path(proforma.customerId)}>{proforma.customerName}</TableLink>
              </ErpFieldRow>
            </ErpCardSection>
            <ErpCardSection title="Export" columns={1}>
              <div className="flex flex-wrap gap-2">
                <ErpButton variant="secondary" icon={Printer} onClick={() => navigate(`/sales/proforma-invoices/${proforma.id}/print`)}>
                  Print
                </ErpButton>
                <ErpButton variant="secondary" icon={Download} onClick={() => void handleProformaPdfDownload(proforma)}>
                  Download PDF
                </ErpButton>
                <ErpButton variant="secondary" icon={FileSpreadsheet} onClick={() => downloadProformaExcel(proforma)}>
                  Export Excel
                </ErpButton>
              </div>
            </ErpCardSection>
            <ErpCardSection title="Commercial" columns={1}>
              <ErpFieldRow label="Payment Terms" readOnly>{proforma.paymentTerms}</ErpFieldRow>
              <ErpFieldRow label="Delivery Terms" readOnly>{proforma.deliveryTerms}</ErpFieldRow>
              {proforma.customerPoNumber ? <ErpFieldRow label="Customer PO" readOnly>{proforma.customerPoNumber}</ErpFieldRow> : null}
            </ErpCardSection>
            {proforma.salesOrderId && proforma.status === 'draft' ? (
              <div className="rounded-lg border border-erp-border bg-erp-surface-alt/50 p-4 text-[12px] text-erp-muted">
                Need another proforma? Cancel this draft first, or create from a different sales order.
              </div>
            ) : null}
            {!proforma.salesOrderId ? (
              <ErpButton variant="secondary" className="w-full" onClick={() => navigate('/sales/proforma-invoices/new')}>
                Create another direct PI
              </ErpButton>
            ) : null}
          </aside>
        </div>
      </OperationalPageShell>
    </>
  )
}

export function ProformaInvoicePrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const proforma = useProformaInvoiceStore((s) => (id ? s.getProforma(id) : undefined))
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (!proforma) return
    if (searchParams.get('download') !== '1' && searchParams.get('autodownload') !== '1') return
    const timer = window.setTimeout(() => {
      void handleProformaPdfDownload(proforma)
    }, 450)
    return () => window.clearTimeout(timer)
  }, [proforma, searchParams])

  if (!proforma) {
    return (
      <OperationalPageShell title="Proforma not found" breadcrumbs={proformaDetailBreadcrumbs('Print')}>
        <Link to="/sales/proforma-invoices" className="text-sm font-semibold text-erp-primary">Back</Link>
      </OperationalPageShell>
    )
  }

  return (
    <div className="pi-print-page erp-page">
      <div className="pi-print-toolbar no-print">
        <div>
          <p className="pi-print-toolbar__title">{proforma.proformaNo}</p>
          <p className="pi-print-toolbar__subtitle">Proforma invoice — professional preview &amp; print</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ErpButton
            type="button"
            variant="primary"
            icon={Printer}
            onClick={() => printProformaDocument({ fileName: `${proforma.proformaNo}.pdf` })}
          >
            Print
          </ErpButton>
          <ErpButton type="button" variant="secondary" icon={Download} onClick={() => void handleProformaPdfDownload(proforma)}>
            Download PDF
          </ErpButton>
          <ErpButton type="button" variant="secondary" icon={FileSpreadsheet} onClick={() => downloadProformaExcel(proforma)}>
            Export Excel
          </ErpButton>
          <ErpButton type="button" variant="ghost" icon={FileText} onClick={() => navigate(`/sales/proforma-invoices/${proforma.id}`)}>
            Back to Proforma
          </ErpButton>
        </div>
      </div>
      <div className="pi-print-stage">
        <ProformaInvoiceDocument proforma={proforma} />
      </div>
    </div>
  )
}

export { buildProformaNewUrl }
