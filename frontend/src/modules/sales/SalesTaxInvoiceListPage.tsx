/**
 * Sales Tax Invoice register — enterprise list chrome aligned with Proforma Invoices.
 */
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  ArrowLeftRight,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Save,
  ShoppingCart,
  Wallet,
} from 'lucide-react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { SaveViewDialog } from '../../components/design-system/SaveViewDialog'
import { StatusDot } from '../../components/design-system/StatusDot'
import { EnterpriseRegisterTableShell } from '../../design-system/list-page/EnterpriseRegisterTableShell'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpDataGrid } from '../../components/erp/ErpDataGrid'
import { CrmFilterDrawer } from '../../components/crm/CrmFilterDrawer'
import { CrmListFilterBar, CrmListSortSelect } from '../../components/crm/CrmListFilterBar'
import { TableLink } from '../../components/ui/AppLink'
import { salesCustomer360Path } from '../../config/entity360Routes'
import { TAX_INVOICE_REGISTER_PRESETS } from '../../config/savedViewPresets'
import { useCrmCommercialStore } from '../../store/crmCommercialStore'
import { useMasterStore } from '../../store/masterStore'
import { useSavedViews } from '../../hooks/useSavedViews'
import { useCrmFilterDrawer } from '../../hooks/useCrmFilterDrawer'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { buildTaxInvoiceRegisterKpis } from '../../utils/salesModuleKpis'
import { exportRowsToCsv } from '../../utils/exportCsv'
import { canCrmPermission } from '../../utils/permissions/crm'
import { salesModuleBreadcrumbs } from '../../utils/salesNavigation'
import { cn } from '../../utils/cn'
import {
  EnterpriseIdCell,
  EnterpriseNumericCell,
  EnterpriseRowActionsMenu,
  entNumericMeta,
  useDensityClass,
} from '../../design-system/enterprise'
import type { CrmFilterField } from '../../types/crmListFilters'
import type { CrmCommercialSource, CrmTaxInvoice, CrmTaxInvoiceStatus } from '../../types/crmCommercial'
import {
  CRM_TAX_INVOICE_STATUS_LABELS,
  CRM_INVOICE_PAYMENT_STATUS_LABELS,
} from '../../types/crmCommercial'
import type { StatusDotTone } from '../../components/design-system/StatusDot'

type InvoiceSortKey =
  | 'invoiceDate'
  | 'dueDate'
  | 'customer'
  | 'amount'
  | 'balance'
  | 'status'
  | 'invoiceNo'
  | 'invoiceNoAsc'
  | 'invoiceNoDesc'

const INVOICE_FILTER_DEFAULTS = {
  search: '',
  status: '',
  paymentStatus: '',
  source: '',
  dateFrom: '',
  dateTo: '',
  dueFrom: '',
  dueTo: '',
}

const INVOICE_FILTER_FIELDS: CrmFilterField[] = [
  { type: 'section', label: 'Status & payment' },
  {
    type: 'select',
    key: 'status',
    label: 'Status',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'posted', label: 'Posted' },
      { value: 'partially_paid', label: 'Partially Paid' },
      { value: 'paid', label: 'Paid' },
      { value: 'cancelled', label: 'Cancelled' },
      { value: 'open', label: 'Open balance' },
      { value: 'overdue', label: 'Overdue' },
    ],
  },
  {
    type: 'select',
    key: 'paymentStatus',
    label: 'Payment status',
    options: [
      { value: 'unpaid', label: 'Unpaid' },
      { value: 'partially_paid', label: 'Partially Paid' },
      { value: 'paid', label: 'Paid' },
    ],
  },
  { type: 'section', label: 'Source' },
  {
    type: 'select',
    key: 'source',
    label: 'Source',
    options: [
      { value: 'sales_order', label: 'From SO' },
      { value: 'proforma', label: 'From Proforma' },
      { value: 'direct', label: 'Direct' },
      { value: 'customer', label: 'Customer' },
    ],
  },
  { type: 'section', label: 'Dates' },
  { type: 'date-range', label: 'Invoice date', fromKey: 'dateFrom', toKey: 'dateTo' },
  { type: 'date-range', label: 'Due date', fromKey: 'dueFrom', toKey: 'dueTo' },
]

const INVOICE_SORT_OPTIONS: { value: InvoiceSortKey; label: string }[] = [
  { value: 'invoiceDate', label: 'Sort: Invoice Date' },
  { value: 'dueDate', label: 'Sort: Due Date' },
  { value: 'customer', label: 'Sort: Customer' },
  { value: 'amount', label: 'Sort: Amount' },
  { value: 'balance', label: 'Sort: Balance Due' },
  { value: 'status', label: 'Sort: Status' },
  { value: 'invoiceNoAsc', label: 'Sort: Invoice No. (A→Z)' },
  { value: 'invoiceNoDesc', label: 'Sort: Invoice No. (Z→A)' },
]

function invoiceTone(status: CrmTaxInvoiceStatus): StatusDotTone {
  if (status === 'paid') return 'success'
  if (status === 'partially_paid' || status === 'posted') return 'warning'
  if (status === 'cancelled') return 'danger'
  return 'neutral'
}

function paymentTone(status: CrmTaxInvoice['paymentStatus']): StatusDotTone {
  if (status === 'paid') return 'success'
  if (status === 'partially_paid') return 'warning'
  return 'danger'
}

function sourceLabel(source: CrmCommercialSource): string {
  if (source === 'sales_order') return 'From SO'
  if (source === 'proforma') return 'From Proforma'
  if (source === 'customer') return 'Customer'
  return 'Direct'
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function isInvoiceOverdue(inv: CrmTaxInvoice): boolean {
  if (inv.status === 'cancelled' || inv.status === 'paid' || inv.status === 'draft') return false
  if (inv.balanceDue <= 0.009) return false
  return inv.dueDate.slice(0, 10) < todayIso()
}

function isOpenBalance(inv: CrmTaxInvoice): boolean {
  if (inv.status === 'cancelled' || inv.status === 'draft') return false
  return inv.balanceDue > 0.009
}

function sortInvoices(list: CrmTaxInvoice[], sortBy: InvoiceSortKey): CrmTaxInvoice[] {
  const next = [...list]
  next.sort((a, b) => {
    switch (sortBy) {
      case 'customer':
        return a.customerName.localeCompare(b.customerName) || b.invoiceNo.localeCompare(a.invoiceNo)
      case 'amount':
        return b.gst.grandTotal - a.gst.grandTotal
      case 'balance':
        return b.balanceDue - a.balanceDue
      case 'status':
        return a.status.localeCompare(b.status) || b.invoiceDate.localeCompare(a.invoiceDate)
      case 'invoiceNo':
      case 'invoiceNoAsc':
        return a.invoiceNo.localeCompare(b.invoiceNo, undefined, { numeric: true })
      case 'invoiceNoDesc':
        return b.invoiceNo.localeCompare(a.invoiceNo, undefined, { numeric: true })
      case 'dueDate':
        return a.dueDate.localeCompare(b.dueDate) || b.invoiceNo.localeCompare(a.invoiceNo)
      case 'invoiceDate':
      default:
        return b.invoiceDate.localeCompare(a.invoiceDate) || b.invoiceNo.localeCompare(a.invoiceNo)
    }
  })
  return next
}

export function SalesTaxInvoiceListPage() {
  const navigate = useNavigate()
  const invoices = useCrmCommercialStore((s) => s.invoices)
  const getCustomer = useMasterStore((s) => s.getCustomer)
  const densityClass = useDensityClass()
  const canCreate = canCrmPermission('crm.commercial.invoice.create')
  const canEdit = canCreate

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dueFrom, setDueFrom] = useState('')
  const [dueTo, setDueTo] = useState('')
  const [sortBy, setSortBy] = useState<InvoiceSortKey>('invoiceDate')

  const filtersRecord = useMemo(
    () => ({
      search,
      status: statusFilter,
      paymentStatus: paymentStatusFilter,
      source: sourceFilter,
      dateFrom,
      dateTo,
      dueFrom,
      dueTo,
      sortBy,
    }),
    [search, statusFilter, paymentStatusFilter, sourceFilter, dateFrom, dateTo, dueFrom, dueTo, sortBy],
  )

  const applyFilters = useCallback((saved: Record<string, string>) => {
    setSearch(saved.search ?? '')
    setStatusFilter(saved.status ?? '')
    setPaymentStatusFilter(saved.paymentStatus ?? '')
    setSourceFilter(saved.source ?? '')
    setDateFrom(saved.dateFrom ?? '')
    setDateTo(saved.dateTo ?? '')
    setDueFrom(saved.dueFrom ?? '')
    setDueTo(saved.dueTo ?? '')
    const sb = saved.sortBy as InvoiceSortKey
    if (INVOICE_SORT_OPTIONS.some((o) => o.value === sb)) setSortBy(sb)
  }, [])

  const savedViews = useSavedViews({
    pageId: '/sales/invoices',
    filters: filtersRecord,
    onApply: applyFilters,
    systemPresets: TAX_INVOICE_REGISTER_PRESETS,
  })

  const filterDrawer = useCrmFilterDrawer({
    values: {
      search,
      status: statusFilter,
      paymentStatus: paymentStatusFilter,
      source: sourceFilter,
      dateFrom,
      dateTo,
      dueFrom,
      dueTo,
    },
    onChange: (next) => {
      if (typeof next.search === 'string') setSearch(next.search)
      if (typeof next.status === 'string') setStatusFilter(next.status)
      if (typeof next.paymentStatus === 'string') setPaymentStatusFilter(next.paymentStatus)
      if (typeof next.source === 'string') setSourceFilter(next.source)
      if (typeof next.dateFrom === 'string') setDateFrom(next.dateFrom)
      if (typeof next.dateTo === 'string') setDateTo(next.dateTo)
      if (typeof next.dueFrom === 'string') setDueFrom(next.dueFrom)
      if (typeof next.dueTo === 'string') setDueTo(next.dueTo)
    },
    fields: INVOICE_FILTER_FIELDS,
    defaults: INVOICE_FILTER_DEFAULTS,
    chipLabelResolver: (key, value) => {
      if (key === 'status') {
        if (value === 'open') return 'Open balance'
        if (value === 'overdue') return 'Overdue'
        return CRM_TAX_INVOICE_STATUS_LABELS[value as CrmTaxInvoiceStatus] ?? value
      }
      if (key === 'paymentStatus') {
        return CRM_INVOICE_PAYMENT_STATUS_LABELS[value as CrmTaxInvoice['paymentStatus']] ?? value
      }
      if (key === 'source') return sourceLabel(value as CrmCommercialSource)
      return undefined
    },
  })

  const clearFilters = useCallback(() => {
    filterDrawer.clearAll()
    setSortBy('invoiceDate')
  }, [filterDrawer])

  const filtered = useMemo(() => {
    let list = [...invoices]
    if (statusFilter === 'open') list = list.filter(isOpenBalance)
    else if (statusFilter === 'overdue') list = list.filter(isInvoiceOverdue)
    else if (statusFilter) list = list.filter((i) => i.status === statusFilter)
    if (paymentStatusFilter) list = list.filter((i) => i.paymentStatus === paymentStatusFilter)
    if (sourceFilter) list = list.filter((i) => i.source === sourceFilter)
    if (dateFrom) list = list.filter((i) => i.invoiceDate.slice(0, 10) >= dateFrom)
    if (dateTo) list = list.filter((i) => i.invoiceDate.slice(0, 10) <= dateTo)
    if (dueFrom) list = list.filter((i) => i.dueDate.slice(0, 10) >= dueFrom)
    if (dueTo) list = list.filter((i) => i.dueDate.slice(0, 10) <= dueTo)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((i) => {
        const customerCode = getCustomer(i.customerId)?.customerCode ?? ''
        return (
          i.invoiceNo.toLowerCase().includes(q)
          || i.customerName.toLowerCase().includes(q)
          || customerCode.toLowerCase().includes(q)
          || (i.salesOrderNo ?? '').toLowerCase().includes(q)
          || (i.proformaNo ?? '').toLowerCase().includes(q)
          || (i.quotationNo ?? '').toLowerCase().includes(q)
          || (i.customerPoNumber ?? '').toLowerCase().includes(q)
          || (i.customerGstin ?? '').toLowerCase().includes(q)
        )
      })
    }
    return sortInvoices(list, sortBy)
  }, [
    invoices,
    search,
    statusFilter,
    paymentStatusFilter,
    sourceFilter,
    dateFrom,
    dateTo,
    dueFrom,
    dueTo,
    sortBy,
    getCustomer,
  ])

  const hasActiveFilters = Boolean(
    search.trim()
      || statusFilter
      || paymentStatusFilter
      || sourceFilter
      || dateFrom
      || dateTo
      || dueFrom
      || dueTo,
  )

  const draftCount = invoices.filter((i) => i.status === 'draft').length
  const openBalanceCount = invoices.filter(isOpenBalance).length
  const overdueCount = invoices.filter(isInvoiceOverdue).length
  const openValue = invoices.filter(isOpenBalance).reduce((s, i) => s + i.balanceDue, 0)

  const kpiStrip = useMemo(
    () =>
      buildTaxInvoiceRegisterKpis(
        {
          total: invoices.length,
          draft: draftCount,
          openBalance: openBalanceCount,
          overdue: overdueCount,
          openValue,
        },
        statusFilter,
        setStatusFilter,
      ),
    [invoices.length, draftCount, openBalanceCount, overdueCount, openValue, statusFilter],
  )

  function exportInvoices(rows: CrmTaxInvoice[] = filtered) {
    exportRowsToCsv(
      'tax-invoices',
      [
        'Invoice No',
        'Status',
        'Payment Status',
        'Customer',
        'Customer No',
        'Invoice Date',
        'Due Date',
        'SO No',
        'Proforma No',
        'Source',
        'Taxable',
        'GST',
        'Grand Total',
        'Amount Paid',
        'Balance Due',
      ],
      rows.map((i) => [
        i.invoiceNo,
        CRM_TAX_INVOICE_STATUS_LABELS[i.status],
        CRM_INVOICE_PAYMENT_STATUS_LABELS[i.paymentStatus],
        i.customerName,
        getCustomer(i.customerId)?.customerCode ?? '',
        i.invoiceDate,
        i.dueDate,
        i.salesOrderNo ?? '',
        i.proformaNo ?? '',
        sourceLabel(i.source),
        i.gst.taxableAmount,
        i.gst.totalTax,
        i.gst.grandTotal,
        i.amountPaid,
        i.balanceDue,
      ]),
    )
  }

  const columns = useMemo<ColumnDef<CrmTaxInvoice, unknown>[]>(
    () => [
      {
        accessorKey: 'invoiceNo',
        header: 'No.',
        meta: { columnLabel: 'Invoice No.' },
        enableSorting: false,
        cell: ({ row }) => (
          <TableLink to={`/sales/invoices/${row.original.id}`}>
            <EnterpriseIdCell id={row.original.invoiceNo} />
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
            label={CRM_TAX_INVOICE_STATUS_LABELS[row.original.status]}
            tone={invoiceTone(row.original.status)}
          />
        ),
      },
      {
        accessorKey: 'paymentStatus',
        header: 'Payment',
        meta: { columnLabel: 'Payment Status' },
        enableSorting: false,
        cell: ({ row }) => (
          <StatusDot
            label={CRM_INVOICE_PAYMENT_STATUS_LABELS[row.original.paymentStatus]}
            tone={paymentTone(row.original.paymentStatus)}
          />
        ),
      },
      {
        id: 'accounting',
        header: 'Accounting',
        meta: { columnLabel: 'Accounting' },
        enableSorting: false,
        cell: ({ row }) => {
          const status = row.original.accountingStatus ?? 'none'
          if (status === 'converted' && row.original.salesInvoiceId) {
            return (
              <TableLink to={`/accounting/money-in/invoices/${row.original.salesInvoiceId}`}>
                {row.original.salesInvoiceNumber || 'Money In'}
              </TableLink>
            )
          }
          if (status === 'pending_review') {
            return <StatusDot label="Pending Accounting" tone="warning" />
          }
          return <span className="text-erp-muted">—</span>
        },
      },
      {
        accessorKey: 'customerName',
        header: 'Customer',
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
        accessorKey: 'invoiceDate',
        header: 'Invoice Date',
        meta: { columnLabel: 'Invoice Date' },
        enableSorting: false,
        cell: ({ row }) => formatDate(row.original.invoiceDate),
      },
      {
        accessorKey: 'dueDate',
        header: 'Due Date',
        meta: { columnLabel: 'Due Date' },
        enableSorting: false,
        cell: ({ row }) => {
          const overdue = isInvoiceOverdue(row.original)
          return (
            <span className={cn(overdue && 'font-semibold text-erp-danger')} title={overdue ? 'Overdue' : undefined}>
              {formatDate(row.original.dueDate)}
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
          row.original.salesOrderNo && row.original.salesOrderId ? (
            <TableLink to={`/sales/orders/${row.original.salesOrderId}`}>{row.original.salesOrderNo}</TableLink>
          ) : (
            '—'
          ),
      },
      {
        id: 'proformaNo',
        header: 'Proforma',
        meta: { columnLabel: 'Proforma' },
        enableSorting: false,
        cell: ({ row }) =>
          row.original.proformaNo && row.original.proformaInvoiceId ? (
            <TableLink to={`/sales/proforma-invoices/${row.original.proformaInvoiceId}`}>
              {row.original.proformaNo}
            </TableLink>
          ) : (
            '—'
          ),
      },
      {
        id: 'source',
        header: 'Source',
        meta: { columnLabel: 'Source' },
        enableSorting: false,
        cell: ({ row }) => sourceLabel(row.original.source),
      },
      {
        id: 'grandTotal',
        header: 'Amount',
        meta: entNumericMeta('Amount Incl. Tax'),
        enableSorting: false,
        cell: ({ row }) => (
          <EnterpriseNumericCell value={formatCurrency(row.original.gst.grandTotal)} className="font-semibold" />
        ),
      },
      {
        id: 'balanceDue',
        header: 'Balance',
        meta: entNumericMeta('Balance Due'),
        enableSorting: false,
        cell: ({ row }) => {
          const overdue = isInvoiceOverdue(row.original)
          return (
            <EnterpriseNumericCell
              value={formatCurrency(row.original.balanceDue)}
              className={cn(overdue && 'font-semibold text-erp-danger')}
            />
          )
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        meta: { columnLabel: 'Actions' },
        cell: ({ row }) => (
          <EnterpriseRowActionsMenu
            actions={[
              {
                id: 'view',
                label: 'View',
                icon: Eye,
                onClick: () => navigate(`/sales/invoices/${row.original.id}`),
              },
              ...(canEdit && row.original.status === 'draft'
                ? [{
                    id: 'edit',
                    label: 'Edit',
                    icon: Pencil,
                    onClick: () => navigate(`/sales/invoices/${row.original.id}/edit`),
                  }]
                : []),
              ...(isOpenBalance(row.original)
                ? [{
                    id: 'alloc',
                    label: 'Allocate payment',
                    icon: Wallet,
                    onClick: () =>
                      navigate(`/sales/payment-allocation?customerId=${row.original.customerId}`),
                  }]
                : []),
            ]}
          />
        ),
      },
    ],
    [canEdit, getCustomer, navigate],
  )

  return (
    <>
      <OperationalPageShell
        variant="dynamics"
        badge="Sales"
        title="Tax Invoices"
        description="GST tax invoices — draft, post, and track collections against sales orders and proformas"
        breadcrumbs={salesModuleBreadcrumbs('Tax Invoices', '/sales/invoices')}
        autoBreadcrumbs={false}
        favoritePath="/sales/invoices"
        commandBar={(
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={
              canCreate
                ? { id: 'new', label: 'Create Invoice', icon: Plus, onClick: () => navigate('/sales/invoices/new') }
                : undefined
            }
            secondaryActions={[
              { id: 'export', label: 'Export', icon: Download, onClick: () => exportInvoices() },
              {
                id: 'alloc',
                label: 'Payment Allocation',
                icon: ArrowLeftRight,
                onClick: () => navigate('/sales/payment-allocation'),
              },
            ]}
            moreActions={[
              { id: 'orders', label: 'Sales Orders', icon: ShoppingCart, onClick: () => navigate('/sales/orders') },
              { id: 'proforma', label: 'Proforma', icon: FileText, onClick: () => navigate('/sales/proforma-invoices') },
              { id: 'save-view', label: 'Save View', icon: Save, onClick: savedViews.openSaveDialog },
            ]}
          />
        )}
        kpiStrip={kpiStrip}
      >
        <EnterpriseRegisterTableShell>
          <ErpDataGrid
            className={cn('erp-tax-invoices-table', densityClass)}
            data={filtered}
            columns={columns}
            recordLabel="Tax Invoices"
            stickyFirstColumn
            showCompactSearch={false}
            showToolbarExport={false}
            enableColumnSorting={false}
            sortResetToken={sortBy}
            emptyMessage={
              hasActiveFilters
                ? 'No invoices match the current filters.'
                : 'No tax invoices yet. Create one from a sales order, proforma, or customer.'
            }
            emptyAction={
              filtered.length === 0 ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {canCreate ? (
                    <button
                      type="button"
                      className="erp-btn erp-btn--primary text-[13px]"
                      onClick={() => navigate('/sales/invoices/new')}
                    >
                      Create Invoice
                    </button>
                  ) : null}
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
            getRowId={(row) => row.id}
            onRowView={(row) => navigate(`/sales/invoices/${row.id}`)}
            registerBar={(
              <CrmListFilterBar
                className="crm-list-filter-bar--embedded"
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search invoice, customer, SO, proforma, PO, GSTIN…"
                activeFilterCount={filterDrawer.activeCount}
                onOpenFilters={filterDrawer.openDrawer}
                chips={filterDrawer.chips}
                onRemoveChip={filterDrawer.removeChip}
                onClearAll={clearFilters}
                savedView={savedViews.activeView}
                onSavedViewChange={savedViews.selectView}
                savedViews={savedViews.viewNames}
                onSaveView={savedViews.openSaveDialog}
                sort={(
                  <CrmListSortSelect
                    value={sortBy}
                    onChange={(v) => setSortBy(v as InvoiceSortKey)}
                    aria-label="Sort tax invoices"
                    options={INVOICE_SORT_OPTIONS}
                  />
                )}
              />
            )}
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
        fields={INVOICE_FILTER_FIELDS}
        values={filterDrawer.draft}
        onChange={(next) => filterDrawer.setDraft({ ...filterDrawer.draft, ...next })}
        onApply={filterDrawer.applyFilters}
        onReset={filterDrawer.resetDraft}
        title="Filter tax invoices"
      />
    </>
  )
}
