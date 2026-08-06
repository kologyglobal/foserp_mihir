/**
 * Money In invoices register — enterprise list chrome aligned with Sales Tax Invoices.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  AlertTriangle,
  Clock,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Wallet,
} from 'lucide-react'
import { SaveViewDialog } from '@/components/design-system/SaveViewDialog'
import { StatusDot } from '@/components/design-system/StatusDot'
import type { StatusDotTone } from '@/components/design-system/StatusDot'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpDataGrid } from '@/components/erp/ErpDataGrid'
import { CrmFilterDrawer } from '@/components/crm/CrmFilterDrawer'
import { CrmListFilterBar, CrmListSortSelect } from '@/components/crm/CrmListFilterBar'
import { TableLink } from '@/components/ui/AppLink'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  EnterpriseIdCell,
  EnterpriseNumericCell,
  EnterpriseRowActionsMenu,
  entNumericMeta,
  KPI_ICON_PRESETS,
  useDensityClass,
} from '@/design-system/enterprise'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { MONEY_IN_INVOICE_REGISTER_PRESETS } from '@/config/savedViewPresets'
import { useSavedViews } from '@/hooks/useSavedViews'
import { useCrmFilterDrawer } from '@/hooks/useCrmFilterDrawer'
import { listSalesInvoices } from '@/services/bridges/receivablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type {
  SalesInvoiceDto,
  SalesInvoiceSettlementStatus,
  SalesInvoiceStatus,
} from '@/types/moneyIn'
import type { CrmFilterField } from '@/types/crmListFilters'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { exportRowsToCsv } from '@/utils/exportCsv'
import { mergeAllowedAction, useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import {
  partyMasterRoute,
  sourceDocumentRoute,
  sourceTypeLabel,
} from '@/modules/accounting/shared/invoices'
import { cn } from '@/utils/cn'
import {
  invoiceDisplayNumber,
  moneyInStatusTone,
  MONEY_IN_STATUS_LABELS,
  parseDecimal,
  resolveSettlementStatus,
  SETTLEMENT_STATUS_LABELS,
  settlementStatusTone,
} from '../moneyInUi'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

type InvoiceViewTab = 'all' | 'draft' | 'ready' | 'open' | 'overdue' | 'paid' | 'cancelled'
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
  | 'overdue'

/** Legacy `?status=` deep links (from the old status dropdown) map onto view tabs. */
const STATUS_TO_TAB: Partial<Record<SalesInvoiceStatus, InvoiceViewTab>> = {
  DRAFT: 'draft',
  READY_TO_POST: 'ready',
  POSTED: 'open',
  CANCELLED: 'cancelled',
}

const INVOICE_FILTER_DEFAULTS = {
  search: '',
  status: '',
  settlement: '',
  source: '',
  dateFrom: '',
  dateTo: '',
  dueFrom: '',
  dueTo: '',
}

const INVOICE_FILTER_FIELDS: CrmFilterField[] = [
  { type: 'section', label: 'Status & settlement' },
  {
    type: 'select',
    key: 'status',
    label: 'Status',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'ready', label: 'Ready to Post' },
      { value: 'open', label: 'Open' },
      { value: 'overdue', label: 'Overdue' },
      { value: 'paid', label: 'Paid' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
  },
  {
    type: 'select',
    key: 'settlement',
    label: 'Settlement',
    options: [
      { value: 'UNPAID', label: 'Unpaid' },
      { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
      { value: 'PAID', label: 'Paid' },
      { value: 'OVERDUE', label: 'Overdue' },
    ],
  },
  { type: 'section', label: 'Source' },
  {
    type: 'select',
    key: 'source',
    label: 'Source',
    options: [
      { value: 'DIRECT', label: 'Direct' },
      { value: 'SALES_ORDER', label: 'Sales Order' },
      { value: 'PROFORMA_INVOICE', label: 'Proforma Invoice' },
      { value: 'CRM_TAX_INVOICE', label: 'CRM Tax Invoice' },
      { value: 'OUTBOUND_DISPATCH', label: 'Outbound Dispatch' },
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
  { value: 'overdue', label: 'Sort: Overdue Days' },
  { value: 'status', label: 'Sort: Status' },
  { value: 'invoiceNoAsc', label: 'Sort: Invoice No. (A→Z)' },
  { value: 'invoiceNoDesc', label: 'Sort: Invoice No. (Z→A)' },
]

interface InvoiceRegisterRow {
  invoice: SalesInvoiceDto
  outstanding: number
  total: number
  isOpen: boolean
  isPaid: boolean
  overdueDays: number
  ageingBucket: string
  settlement: SalesInvoiceSettlementStatus | null
  displayNo: string
  statusLabel: string
}

function daysBetween(fromIso: string, to: Date): number {
  const from = new Date(fromIso)
  if (Number.isNaN(from.getTime())) return 0
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

function ageingBucketLabel(overdueDays: number): string {
  if (overdueDays <= 0) return 'Not Due'
  if (overdueDays <= 30) return '1-30 Days'
  if (overdueDays <= 60) return '31-60 Days'
  if (overdueDays <= 90) return '61-90 Days'
  if (overdueDays <= 180) return '91-180 Days'
  return 'Above 180 Days'
}

function toRegisterRow(invoice: SalesInvoiceDto, today: Date): InvoiceRegisterRow {
  const outstanding = parseDecimal(invoice.outstandingAmount)
  const total = parseDecimal(invoice.totalAmount)
  const isPosted = invoice.status === 'POSTED'
  const isOpen = isPosted && outstanding > 0
  const isPaid = isPosted && outstanding <= 0
  const overdueDays = isOpen && invoice.dueDate ? Math.max(0, daysBetween(invoice.dueDate, today)) : 0
  const statusLabel =
    invoice.status === 'POSTED'
      ? isOpen
        ? 'Open'
        : 'Paid'
      : MONEY_IN_STATUS_LABELS[invoice.status]
  return {
    invoice,
    outstanding,
    total,
    isOpen,
    isPaid,
    overdueDays,
    ageingBucket: isOpen ? ageingBucketLabel(overdueDays) : 'Not Due',
    settlement: resolveSettlementStatus(invoice),
    displayNo: invoiceDisplayNumber(invoice),
    statusLabel,
  }
}

function matchesStatusTab(row: InvoiceRegisterRow, tab: InvoiceViewTab | ''): boolean {
  if (!tab || tab === 'all') return true
  switch (tab) {
    case 'draft':
      return row.invoice.status === 'DRAFT'
    case 'ready':
      return row.invoice.status === 'READY_TO_POST'
    case 'open':
      return row.isOpen
    case 'overdue':
      return row.overdueDays > 0
    case 'paid':
      return row.isPaid
    case 'cancelled':
      return row.invoice.status === 'CANCELLED' || row.invoice.status === 'REVERSED'
    default:
      return true
  }
}

function chipToneFromErp(tone: string): StatusDotTone {
  if (tone === 'critical') return 'danger'
  if (tone === 'success' || tone === 'warning' || tone === 'info' || tone === 'neutral') return tone
  return 'neutral'
}

function statusDotTone(row: InvoiceRegisterRow): StatusDotTone {
  if (row.invoice.status === 'POSTED' && row.isPaid) return 'success'
  if (row.invoice.status === 'POSTED' && row.isOpen) return row.overdueDays > 0 ? 'danger' : 'warning'
  return chipToneFromErp(moneyInStatusTone(row.invoice.status))
}

function sortRows(list: InvoiceRegisterRow[], sortBy: InvoiceSortKey): InvoiceRegisterRow[] {
  const next = [...list]
  next.sort((a, b) => {
    switch (sortBy) {
      case 'customer':
        return (
          a.invoice.customerNameSnapshot.localeCompare(b.invoice.customerNameSnapshot)
          || b.displayNo.localeCompare(a.displayNo)
        )
      case 'amount':
        return b.total - a.total
      case 'balance':
        return b.outstanding - a.outstanding
      case 'overdue':
        return b.overdueDays - a.overdueDays
      case 'status':
        return a.statusLabel.localeCompare(b.statusLabel) || b.invoice.invoiceDate.localeCompare(a.invoice.invoiceDate)
      case 'invoiceNo':
      case 'invoiceNoAsc':
        return a.displayNo.localeCompare(b.displayNo, undefined, { numeric: true })
      case 'invoiceNoDesc':
        return b.displayNo.localeCompare(a.displayNo, undefined, { numeric: true })
      case 'dueDate':
        return (a.invoice.dueDate ?? '').localeCompare(b.invoice.dueDate ?? '') || b.displayNo.localeCompare(a.displayNo)
      case 'invoiceDate':
      default:
        return b.invoice.invoiceDate.localeCompare(a.invoice.invoiceDate) || b.displayNo.localeCompare(a.displayNo)
    }
  })
  return next
}

function parseInitialStatus(searchParams: URLSearchParams): string {
  const fromTab = searchParams.get('view') as InvoiceViewTab | null
  if (fromTab && fromTab !== 'all' && ['draft', 'ready', 'open', 'overdue', 'paid', 'cancelled'].includes(fromTab)) {
    return fromTab
  }
  const fromStatus = searchParams.get('status') as SalesInvoiceStatus | null
  if (fromStatus && STATUS_TO_TAB[fromStatus]) return STATUS_TO_TAB[fromStatus]!
  return ''
}

export function InvoiceListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const perms = useMoneyInPermissions()
  const densityClass = useDensityClass()
  const canCreate = mergeAllowedAction(perms.canCreateInvoice)
  const canEdit = perms.canEditInvoice

  const [rows, setRows] = useState<SalesInvoiceDto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(() => parseInitialStatus(searchParams))
  const [settlementFilter, setSettlementFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dueFrom, setDueFrom] = useState('')
  const [dueTo, setDueTo] = useState('')
  const [sortBy, setSortBy] = useState<InvoiceSortKey>('invoiceDate')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listSalesInvoices({
        legalEntityId: resolveLegalEntityId(),
      })
      setRows(data)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canViewInvoice) void load()
  }, [load, perms.canViewInvoice])

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (statusFilter) params.set('view', statusFilter)
        else params.delete('view')
        params.delete('status')
        return params
      },
      { replace: true },
    )
  }, [statusFilter, setSearchParams])

  const filtersRecord = useMemo(
    () => ({
      search,
      status: statusFilter,
      settlement: settlementFilter,
      source: sourceFilter,
      dateFrom,
      dateTo,
      dueFrom,
      dueTo,
      sortBy,
    }),
    [search, statusFilter, settlementFilter, sourceFilter, dateFrom, dateTo, dueFrom, dueTo, sortBy],
  )

  const applyFilters = useCallback((saved: Record<string, string>) => {
    setSearch(saved.search ?? '')
    setStatusFilter(saved.status ?? '')
    setSettlementFilter(saved.settlement ?? '')
    setSourceFilter(saved.source ?? '')
    setDateFrom(saved.dateFrom ?? '')
    setDateTo(saved.dateTo ?? '')
    setDueFrom(saved.dueFrom ?? '')
    setDueTo(saved.dueTo ?? '')
    const sb = saved.sortBy as InvoiceSortKey
    if (INVOICE_SORT_OPTIONS.some((o) => o.value === sb)) setSortBy(sb)
  }, [])

  const savedViews = useSavedViews({
    pageId: '/accounting/money-in/invoices',
    filters: filtersRecord,
    onApply: applyFilters,
    systemPresets: MONEY_IN_INVOICE_REGISTER_PRESETS,
  })

  const filterDrawer = useCrmFilterDrawer({
    values: {
      search,
      status: statusFilter,
      settlement: settlementFilter,
      source: sourceFilter,
      dateFrom,
      dateTo,
      dueFrom,
      dueTo,
    },
    onChange: (next) => {
      if (typeof next.search === 'string') setSearch(next.search)
      if (typeof next.status === 'string') setStatusFilter(next.status)
      if (typeof next.settlement === 'string') setSettlementFilter(next.settlement)
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
        const labels: Record<string, string> = {
          draft: 'Draft',
          ready: 'Ready to Post',
          open: 'Open',
          overdue: 'Overdue',
          paid: 'Paid',
          cancelled: 'Cancelled',
        }
        return labels[value] ?? value
      }
      if (key === 'settlement') {
        return SETTLEMENT_STATUS_LABELS[value as SalesInvoiceSettlementStatus] ?? value
      }
      if (key === 'source') return sourceTypeLabel(value)
      return undefined
    },
  })

  const clearFilters = useCallback(() => {
    filterDrawer.clearAll()
    setSortBy('invoiceDate')
  }, [filterDrawer])

  const registerRows = useMemo(() => {
    const today = new Date()
    return rows.map((inv) => toRegisterRow(inv, today))
  }, [rows])

  const filtered = useMemo(() => {
    let list = [...registerRows]
    list = list.filter((r) => matchesStatusTab(r, statusFilter as InvoiceViewTab | ''))
    if (settlementFilter) {
      list = list.filter((r) => r.settlement === settlementFilter)
    }
    if (sourceFilter) {
      list = list.filter((r) => r.invoice.sourceType === sourceFilter)
    }
    if (dateFrom) list = list.filter((r) => r.invoice.invoiceDate.slice(0, 10) >= dateFrom)
    if (dateTo) list = list.filter((r) => r.invoice.invoiceDate.slice(0, 10) <= dateTo)
    if (dueFrom) list = list.filter((r) => (r.invoice.dueDate ?? '').slice(0, 10) >= dueFrom)
    if (dueTo) list = list.filter((r) => (r.invoice.dueDate ?? '').slice(0, 10) <= dueTo)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((r) => {
        const inv = r.invoice
        return (
          r.displayNo.toLowerCase().includes(q)
          || inv.customerNameSnapshot.toLowerCase().includes(q)
          || (inv.customerCodeSnapshot ?? '').toLowerCase().includes(q)
          || (inv.customerGstinSnapshot ?? '').toLowerCase().includes(q)
          || (inv.customerPoNumber ?? '').toLowerCase().includes(q)
          || (inv.referenceNumber ?? '').toLowerCase().includes(q)
          || sourceTypeLabel(inv.sourceType).toLowerCase().includes(q)
        )
      })
    }
    return sortRows(list, sortBy)
  }, [
    registerRows,
    statusFilter,
    settlementFilter,
    sourceFilter,
    dateFrom,
    dateTo,
    dueFrom,
    dueTo,
    search,
    sortBy,
  ])

  const hasActiveFilters = Boolean(
    search.trim()
      || statusFilter
      || settlementFilter
      || sourceFilter
      || dateFrom
      || dateTo
      || dueFrom
      || dueTo,
  )

  const draftCount = registerRows.filter((r) => r.invoice.status === 'DRAFT').length
  const readyCount = registerRows.filter((r) => r.invoice.status === 'READY_TO_POST').length
  const openCount = registerRows.filter((r) => r.isOpen).length
  const overdueCount = registerRows.filter((r) => r.overdueDays > 0).length
  const openValue = registerRows.reduce((s, r) => s + (r.isOpen ? r.outstanding : 0), 0)

  const toggleStatus = useCallback((next: string) => {
    setStatusFilter((prev) => (prev === next ? '' : next))
  }, [])

  const kpiStrip: EnterpriseKpiItem[] = useMemo(
    () => [
      {
        id: 'total',
        label: 'Invoices',
        value: registerRows.length,
        icon: KPI_ICON_PRESETS.open,
        accent: 'blue',
        context: 'Money In AR',
        active: !statusFilter,
        onClick: () => setStatusFilter(''),
        updatedAt: Date.now(),
      },
      {
        id: 'draft',
        label: 'Draft / Ready',
        value: draftCount + readyCount,
        icon: FileText,
        accent: 'amber',
        context: readyCount > 0 ? `${readyCount} ready to post` : 'In progress',
        active: statusFilter === 'draft' || statusFilter === 'ready',
        onClick: () => toggleStatus('draft'),
        updatedAt: Date.now(),
      },
      {
        id: 'open',
        label: 'Open Balance',
        value: openCount,
        icon: Clock,
        accent: openCount > 0 ? 'amber' : 'green',
        context: openCount > 0 ? 'Awaiting collection' : 'All clear',
        active: statusFilter === 'open',
        onClick: () => toggleStatus('open'),
        updatedAt: Date.now(),
      },
      {
        id: 'overdue',
        label: 'Overdue',
        value: overdueCount,
        icon: AlertTriangle,
        accent: overdueCount > 0 ? 'red' : 'slate',
        context: overdueCount > 0 ? 'Past due date' : 'None overdue',
        active: statusFilter === 'overdue',
        onClick: () => toggleStatus('overdue'),
        updatedAt: Date.now(),
      },
      {
        id: 'value',
        label: 'Outstanding',
        value: formatCompactCurrency(openValue),
        icon: KPI_ICON_PRESETS.revenue,
        accent: 'slate',
        context: formatCurrency(openValue),
        updatedAt: Date.now(),
      },
    ],
    [registerRows.length, draftCount, readyCount, openCount, overdueCount, openValue, statusFilter, toggleStatus],
  )

  function exportInvoices(list: InvoiceRegisterRow[] = filtered) {
    exportRowsToCsv(
      'money-in-invoices',
      [
        'Invoice No',
        'Status',
        'Settlement',
        'Customer',
        'Customer No',
        'Invoice Date',
        'Due Date',
        'Source',
        'Amount',
        'Balance',
        'Overdue Days',
        'Ageing',
      ],
      list.map((r) => [
        r.displayNo,
        r.statusLabel,
        r.settlement ? SETTLEMENT_STATUS_LABELS[r.settlement] : '',
        r.invoice.customerNameSnapshot,
        r.invoice.customerCodeSnapshot ?? '',
        r.invoice.invoiceDate,
        r.invoice.dueDate ?? '',
        sourceTypeLabel(r.invoice.sourceType),
        r.total,
        r.invoice.status === 'POSTED' || r.invoice.status === 'REVERSED' ? r.outstanding : '',
        r.overdueDays > 0 ? r.overdueDays : '',
        r.isOpen ? r.ageingBucket : '',
      ]),
    )
  }

  const columns = useMemo<ColumnDef<InvoiceRegisterRow, unknown>[]>(
    () => [
      {
        id: 'invoiceNo',
        header: 'No.',
        meta: { columnLabel: 'Invoice No.' },
        enableSorting: false,
        cell: ({ row }) => (
          <TableLink to={`/accounting/money-in/invoices/${row.original.invoice.id}`}>
            <EnterpriseIdCell id={row.original.displayNo} />
          </TableLink>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        meta: { columnLabel: 'Status' },
        enableSorting: false,
        cell: ({ row }) => (
          <StatusDot label={row.original.statusLabel} tone={statusDotTone(row.original)} />
        ),
      },
      {
        id: 'settlement',
        header: 'Settlement',
        meta: { columnLabel: 'Settlement' },
        enableSorting: false,
        cell: ({ row }) => {
          const settlement = row.original.settlement
          if (!settlement || settlement === 'NOT_APPLICABLE') {
            return <span className="text-erp-muted">—</span>
          }
          return (
            <StatusDot
              label={SETTLEMENT_STATUS_LABELS[settlement]}
              tone={chipToneFromErp(settlementStatusTone(settlement))}
            />
          )
        },
      },
      {
        id: 'customer',
        header: 'Customer',
        meta: { columnLabel: 'Customer' },
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-[200px] truncate" title={row.original.invoice.customerNameSnapshot}>
            <TableLink to={partyMasterRoute('crm', row.original.invoice.customerId)}>
              {row.original.invoice.customerNameSnapshot}
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
            {row.original.invoice.customerCodeSnapshot ?? '—'}
          </span>
        ),
      },
      {
        id: 'invoiceDate',
        header: 'Invoice Date',
        meta: { columnLabel: 'Invoice Date' },
        enableSorting: false,
        cell: ({ row }) => formatDate(row.original.invoice.invoiceDate),
      },
      {
        id: 'dueDate',
        header: 'Due Date',
        meta: { columnLabel: 'Due Date' },
        enableSorting: false,
        cell: ({ row }) => {
          const overdue = row.original.overdueDays > 0
          if (!row.original.invoice.dueDate) return '—'
          return (
            <span className={cn(overdue && 'font-semibold text-erp-danger')} title={overdue ? 'Overdue' : undefined}>
              {formatDate(row.original.invoice.dueDate)}
            </span>
          )
        },
      },
      {
        id: 'source',
        header: 'Source',
        meta: { columnLabel: 'Source' },
        enableSorting: false,
        cell: ({ row }) => {
          const inv = row.original.invoice
          const label = sourceTypeLabel(inv.sourceType)
          const href =
            inv.sourceDocumentId ? sourceDocumentRoute(inv.sourceType, inv.sourceDocumentId) : null
          return (
            <span className="block max-w-[160px]">
              {href ? <TableLink to={href}>{label}</TableLink> : label}
              {inv.sourceType === 'CRM_TAX_INVOICE' ? (
                <span className="mt-0.5 block text-[11px] font-medium text-sky-800">CRM-created</span>
              ) : null}
            </span>
          )
        },
      },
      {
        id: 'amount',
        header: 'Amount',
        meta: entNumericMeta('Amount Incl. Tax'),
        enableSorting: false,
        cell: ({ row }) => (
          <EnterpriseNumericCell value={formatCurrency(row.original.total)} className="font-semibold" />
        ),
      },
      {
        id: 'balance',
        header: 'Balance',
        meta: entNumericMeta('Balance Due'),
        enableSorting: false,
        cell: ({ row }) => {
          const inv = row.original.invoice
          if (inv.status !== 'POSTED' && inv.status !== 'REVERSED') {
            return <span className="text-erp-muted">—</span>
          }
          const overdue = row.original.overdueDays > 0
          return (
            <EnterpriseNumericCell
              value={formatCurrency(row.original.outstanding)}
              className={cn(overdue && 'font-semibold text-erp-danger')}
            />
          )
        },
      },
      {
        id: 'overdue',
        header: 'Overdue',
        meta: entNumericMeta('Overdue Days'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.overdueDays > 0 ? (
            <EnterpriseNumericCell
              value={`${row.original.overdueDays}d`}
              className="font-semibold text-erp-danger"
            />
          ) : (
            <span className="text-erp-muted">—</span>
          ),
      },
      {
        id: 'ageing',
        header: 'Ageing',
        meta: { columnLabel: 'Ageing' },
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-erp-muted">{row.original.isOpen ? row.original.ageingBucket : '—'}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        meta: { columnLabel: 'Actions' },
        cell: ({ row }) => {
          const inv = row.original.invoice
          const actions = inv.allowedActions
          return (
            <EnterpriseRowActionsMenu
              actions={[
                {
                  id: 'view',
                  label: 'View',
                  icon: Eye,
                  onClick: () => navigate(`/accounting/money-in/invoices/${inv.id}`),
                },
                ...(mergeAllowedAction(canEdit, actions?.edit)
                  ? [{
                      id: 'edit',
                      label: 'Edit',
                      icon: Pencil,
                      onClick: () => navigate(`/accounting/money-in/invoices/${inv.id}/edit`),
                    }]
                  : []),
                ...(row.original.isOpen
                  ? [{
                      id: 'alloc',
                      label: 'Allocate receipt',
                      icon: Wallet,
                      onClick: () =>
                        navigate(`/accounting/money-in/receipts?customerId=${inv.customerId}`),
                    }]
                  : []),
              ]}
            />
          )
        },
      },
    ],
    [canEdit, navigate],
  )

  if (!perms.canViewInvoice) {
    return (
      <MoneyInWorkspaceShell title="Invoices">
        <p className="text-[13px] text-erp-muted">You do not have permission to view invoices.</p>
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <>
      <MoneyInWorkspaceShell
        title="Invoices"
        description="Posted AR invoices — draft, post, and track collections against customers"
        contentClassName="border-0 bg-transparent p-0 shadow-none"
        kpiStrip={kpiStrip}
        commandBar={(
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={
              canCreate
                ? {
                    id: 'new',
                    label: 'New Invoice',
                    icon: Plus,
                    onClick: () => navigate('/accounting/money-in/invoices/new'),
                  }
                : undefined
            }
            secondaryActions={[
              { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
              { id: 'export', label: 'Export', icon: Download, onClick: () => exportInvoices() },
            ]}
            moreActions={[
              { id: 'save-view', label: 'Save View', icon: Save, onClick: savedViews.openSaveDialog },
            ]}
          />
        )}
      >
        {loading && rows.length === 0 ? (
          <LoadingState variant="table" />
        ) : (
          <EnterpriseRegisterTableShell>
            <ErpDataGrid
              className={cn('erp-money-in-invoices-table', densityClass)}
              data={filtered}
              columns={columns}
              recordLabel="Invoices"
              stickyFirstColumn
              showCompactSearch={false}
              showToolbarExport={false}
              enableColumnSorting={false}
              sortResetToken={sortBy}
              emptyMessage={
                hasActiveFilters
                  ? 'No invoices match the current filters.'
                  : 'No invoices yet. Create one to begin tracking receivables.'
              }
              emptyAction={
                filtered.length === 0 ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    {canCreate ? (
                      <button
                        type="button"
                        className="erp-btn erp-btn--primary text-[13px]"
                        onClick={() => navigate('/accounting/money-in/invoices/new')}
                      >
                        New Invoice
                      </button>
                    ) : null}
                    {hasActiveFilters ? (
                      <button type="button" className="erp-btn erp-btn--secondary text-[13px]" onClick={clearFilters}>
                        Clear Filters
                      </button>
                    ) : null}
                  </div>
                ) : undefined
              }
              getRowId={(row) => row.invoice.id}
              onRowView={(row) => navigate(`/accounting/money-in/invoices/${row.invoice.id}`)}
              registerBar={(
                <CrmListFilterBar
                  className="crm-list-filter-bar--embedded"
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search invoice, customer, source, PO, GSTIN…"
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
                      aria-label="Sort invoices"
                      options={INVOICE_SORT_OPTIONS}
                    />
                  )}
                />
              )}
            />
          </EnterpriseRegisterTableShell>
        )}
      </MoneyInWorkspaceShell>

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
        title="Filter invoices"
      />
    </>
  )
}
