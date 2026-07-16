import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Download, MoreHorizontal, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import {
  DisputeDrawer,
  InvoiceStatusBadge,
  ReceivableEmptyState,
  ReceivablesSummaryCards,
  ReceivablesWorkspaceTabs,
} from '@/components/accounting/receivables'
import {
  DEFAULT_RECEIVABLE_FILTER,
  exportReceivables,
  getReceivableInvoices,
  ReceivablesServiceError,
} from '@/services/accounting/receivablesService'
import type { ReceivableAgeingBucket, ReceivableFilter, ReceivableInvoice } from '@/types/receivables'
import { useReceivablesPermissions } from '@/utils/permissions/receivables'
import { formatCurrency, formatCompactCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { MQ_MOBILE, useMediaQuery } from '@/hooks/useMediaQuery'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { clearReceivableFilterFields, downloadTextFile, sortInvoiceRows, type InvoiceSortKey } from './receivablesUi'
import { cn } from '@/utils/cn'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

const INVOICE_TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'partially_paid', label: 'Partially Paid' },
  { id: 'due_soon', label: 'Due Soon' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'disputed', label: 'Disputed' },
  { id: 'paid', label: 'Paid' },
  { id: 'cancelled', label: 'Cancelled' },
]

export function ReceivableInvoicesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const perms = useReceivablesPermissions()
  const isMobile = useMediaQuery(MQ_MOBILE)

  const tabFromUrl = searchParams.get('invoiceTab') ?? searchParams.get('tab') ?? 'all'
  const customerFromUrl = searchParams.get('customerId') ?? ''
  const ageingFromUrl = searchParams.get('ageingBucket') ?? ''

  const [filter, setFilter] = useState<ReceivableFilter>(() => ({
    ...DEFAULT_RECEIVABLE_FILTER,
    workspaceTab: 'invoices',
    invoiceTab: tabFromUrl,
    customerId: customerFromUrl,
    ageingBucket: (ageingFromUrl as ReceivableAgeingBucket) || '',
  }))
  const [rows, setRows] = useState<ReceivableInvoice[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [sortKey, setSortKey] = useState<InvoiceSortKey>('dueDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const pageSize = 25
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [disputeInvoice, setDisputeInvoice] = useState<ReceivableInvoice | null>(null)

  useEffect(() => {
    setFilter((f) => ({
      ...f,
      invoiceTab: tabFromUrl,
      customerId: customerFromUrl,
      ageingBucket: (ageingFromUrl as ReceivableAgeingBucket) || '',
    }))
  }, [tabFromUrl, customerFromUrl, ageingFromUrl])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    setErrorMessage(null)
    try {
      const list = await getReceivableInvoices(filter)
      if (signal?.cancelled) return
      setRows(list)
      setLoadState(list.length === 0 ? 'empty' : 'ready')
    } catch (err) {
      if (signal?.cancelled) return
      setErrorMessage(err instanceof Error ? err.message : 'Invoices could not be loaded.')
      setLoadState('error')
    }
  }, [filter])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, refreshToken])

  const sorted = useMemo(() => sortInvoiceRows(rows, sortKey, sortDir), [rows, sortKey, sortDir])
  const paged = useMemo(() => sorted.slice(page * pageSize, page * pageSize + pageSize), [sorted, page])

  useEffect(() => {
    setPage(0)
  }, [filter, sortKey, sortDir])

  const summary = useMemo(() => ({
    total: rows.length,
    open: rows.filter((i) => i.invoiceStatus === 'Open').length,
    overdue: rows.filter((i) => i.invoiceStatus === 'Overdue').length,
    disputed: rows.filter((i) => i.hasDispute || i.invoiceStatus === 'Disputed').length,
    outstanding: rows.reduce((s, i) => s + i.outstandingBalance, 0),
  }), [rows])

  const kpiItems: EnterpriseKpiItem[] = [
    { id: 'total', label: 'Invoices', value: summary.total, accent: 'blue' },
    { id: 'open', label: 'Open', value: summary.open, accent: 'blue' },
    { id: 'overdue', label: 'Overdue', value: summary.overdue, accent: 'red' },
    { id: 'disputed', label: 'Disputed', value: summary.disputed, accent: 'amber' },
    { id: 'balance', label: 'Total Outstanding', value: formatCompactCurrency(summary.outstanding), helper: formatCurrency(summary.outstanding), accent: 'blue' },
  ]

  const setInvoiceTab = (tab: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('invoiceTab', tab)
    setSearchParams(next)
    setFilter((f) => ({ ...f, invoiceTab: tab }))
  }

  const handleSort = (key: InvoiceSortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'dueDate' || key === 'invoiceDate' ? 'asc' : 'desc')
    }
  }

  const handleExport = async () => {
    if (!perms.canExport) return notify.error('Missing export permission')
    try {
      const result = await exportReceivables({ scope: 'open_invoices', format: 'csv', filter })
      downloadTextFile(result.filename, result.content)
      notify.success(result.disclaimer)
    } catch (err) {
      notify.error(err instanceof ReceivablesServiceError ? err.message : 'Export failed')
    }
  }

  const hasActiveFilters =
    filter.search || filter.customerId || filter.ageingBucket || filter.invoiceTab !== 'all'

  if (!perms.canView || !perms.canViewInvoice) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Receivable Invoices"
        breadcrumbs={[
          { label: 'Accounting', to: '/accounting' },
          { label: 'Receivables', to: '/accounting/receivables' },
          { label: 'Invoices' },
        ]}
        autoBreadcrumbs={false}
      >
        <ReceivableEmptyState title="Access denied" description="You cannot view receivable invoices." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Receivable Invoices"
      description="Open and settled customer invoices with ageing, disputes and collection status."
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Receivables', to: '/accounting/receivables' },
        { label: 'Invoices' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/receivables/invoices"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            {
              id: 'export',
              label: 'Export',
              icon: Download,
              disabled: !perms.canExport,
              onClick: () => void handleExport(),
            },
            {
              id: 'refresh',
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => setRefreshToken((n) => n + 1),
            },
          ]}
        />
      )}
    >
      <ReceivablesWorkspaceTabs active="invoices" />

      <div className="mt-3 flex flex-wrap gap-1 border-b border-erp-border">
        {INVOICE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn(
              'rounded-t-md px-3 py-2 text-[12px] font-semibold',
              filter.invoiceTab === tab.id
                ? 'border border-b-white border-erp-border bg-white text-erp-primary'
                : 'text-erp-muted hover:text-erp-text',
            )}
            onClick={() => setInvoiceTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <ReceivablesSummaryCards items={kpiItems} />
      </div>

      <div className="mb-2 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-erp-border bg-erp-surface/40 px-3 py-2">
        <SearchInput
          value={filter.search}
          onChange={(search) => setFilter((f) => ({ ...f, search }))}
          placeholder="Invoice, customer, SO…"
          className="w-full max-w-xs"
          size="sm"
        />
        {hasActiveFilters ? (
          <button
            type="button"
            className="text-[11px] font-semibold text-erp-muted hover:text-erp-text"
            onClick={() => {
              setSearchParams({})
              setFilter(clearReceivableFilterFields(filter, { workspaceTab: 'invoices', invoiceTab: 'all' }))
            }}
          >
            Clear Filters
          </button>
        ) : null}
      </div>

      {loadState === 'loading' ? <LoadingState variant="table" rows={10} /> : null}

      {loadState === 'error' ? (
        <ReceivableEmptyState
          title="Receivable invoices could not be loaded."
          description={errorMessage ?? undefined}
          actions={(
            <button type="button" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]" onClick={() => setRefreshToken((n) => n + 1)}>
              Retry
            </button>
          )}
        />
      ) : null}

      {loadState === 'empty' ? (
        <ReceivableEmptyState
          title={hasActiveFilters ? 'No invoices match the selected filters.' : 'No receivable invoices found.'}
          description="Adjust tabs or clear filters to continue."
          actions={(
            <button
              type="button"
              className="erp-btn erp-btn-primary h-9 px-4 text-[13px]"
              onClick={() => {
                setSearchParams({})
                setFilter(clearReceivableFilterFields(filter, { workspaceTab: 'invoices', invoiceTab: 'all' }))
              }}
            >
              Clear Filters
            </button>
          )}
        />
      ) : null}

      {loadState === 'ready' ? (
        <EnterpriseRegisterTableShell className="border-0 shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[80rem] text-[12px]">
              <thead className="sticky top-0 z-10 bg-erp-surface-alt text-left text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                <tr>
                  <th className="px-3 py-2">
                    <button type="button" onClick={() => handleSort('invoiceNumber')}>Invoice</button>
                  </th>
                  <th className="px-3 py-2">
                    <button type="button" onClick={() => handleSort('invoiceDate')}>Invoice Date</button>
                  </th>
                  <th className="px-3 py-2">
                    <button type="button" onClick={() => handleSort('dueDate')}>Due Date</button>
                  </th>
                  <th className="px-3 py-2">
                    <button type="button" onClick={() => handleSort('customerName')}>Customer</button>
                  </th>
                  <th className="px-3 py-2 text-right">
                    <button type="button" onClick={() => handleSort('originalAmount')}>Original</button>
                  </th>
                  <th className="px-3 py-2 text-right">
                    <button type="button" onClick={() => handleSort('outstandingBalance')}>Balance</button>
                  </th>
                  <th className="px-3 py-2 text-right">
                    <button type="button" onClick={() => handleSort('overdueDays')}>Overdue</button>
                  </th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Ageing</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {paged.map((inv) => (
                  <tr key={inv.id} className="border-t border-erp-border hover:bg-erp-surface-alt/50">
                    <td className="px-3 py-2">
                      <Link
                        to={`/accounting/receivables/invoice/${inv.id}`}
                        className="font-mono font-semibold text-erp-primary hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{formatDate(inv.invoiceDate)}</td>
                    <td className="px-3 py-2">{formatDate(inv.dueDate)}</td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/accounting/receivables/customer/${inv.customerId}`}
                        className="hover:text-erp-primary hover:underline"
                      >
                        {inv.customerName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(inv.originalAmount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(inv.outstandingBalance)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{inv.overdueDays > 0 ? `${inv.overdueDays}d` : '—'}</td>
                    <td className="px-3 py-2">
                      <InvoiceStatusBadge status={inv.invoiceStatus} />
                    </td>
                    <td className="px-3 py-2 text-erp-muted">{inv.ageingBucket}</td>
                    <td className="relative px-2 py-2">
                      <div ref={openMenuId === inv.id ? menuRef : undefined} className="relative inline-block">
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-erp-surface-alt"
                          aria-label="Row actions"
                          onClick={() => setOpenMenuId(openMenuId === inv.id ? null : inv.id)}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {openMenuId === inv.id ? (
                          <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-erp-border bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                            onClick={() => {
                              navigate(`/accounting/receivables/invoice/${inv.id}`)
                              setOpenMenuId(null)
                            }}
                          >
                            View Invoice
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                            onClick={() => {
                              navigate(`/accounting/receivables/customer/${inv.customerId}`)
                              setOpenMenuId(null)
                            }}
                          >
                            Open Customer
                          </button>
                          {perms.canCreateReceipt ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                              onClick={() => {
                                navigate(`/accounting/receivables/receipts/new?customerId=${inv.customerId}`)
                                setOpenMenuId(null)
                              }}
                            >
                              Record Receipt
                            </button>
                          ) : null}
                          {perms.canAllocate ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                              onClick={() => {
                                navigate(`/accounting/receivables/allocations?customerId=${inv.customerId}`)
                                setOpenMenuId(null)
                              }}
                            >
                              Allocate
                            </button>
                          ) : null}
                          {perms.canManageDispute ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                              onClick={() => {
                                setDisputeInvoice(inv)
                                setDisputeOpen(true)
                                setOpenMenuId(null)
                              }}
                            >
                              Mark as Disputed
                            </button>
                          ) : null}
                          {perms.canManageCollection ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                              onClick={() => notify.info('Collection note saved locally (demo).')}
                            >
                              Add Collection Note
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                            onClick={() => {
                              if (inv.sourceSalesInvoiceId) navigate(`/invoices/${inv.sourceSalesInvoiceId}`)
                              else notify.info('No linked sales document for this invoice (demo).')
                              setOpenMenuId(null)
                            }}
                          >
                            View Source Sales Document
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                            onClick={() => notify.info('Print preview is not connected (demo).')}
                          >
                            Print
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                            onClick={() => notify.info('Export queued (demo).')}
                          >
                            Export
                          </button>
                        </div>
                      ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={cn('flex items-center justify-between border-t border-erp-border px-3 py-2 text-[12px]', isMobile && 'flex-wrap gap-2')}>
            <span className="text-erp-muted">
              {sorted.length === 0 ? '0' : page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
            </span>
            <div className="flex gap-1">
              <button type="button" className="erp-btn erp-btn-ghost h-8 px-2 text-[12px]" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <button
                type="button"
                className="erp-btn erp-btn-ghost h-8 px-2 text-[12px]"
                disabled={(page + 1) * pageSize >= sorted.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </EnterpriseRegisterTableShell>
      ) : null}

      <DisputeDrawer
        open={disputeOpen}
        onClose={() => {
          setDisputeOpen(false)
          setDisputeInvoice(null)
        }}
        customerId={disputeInvoice?.customerId}
        customerName={disputeInvoice?.customerName}
        onSaved={() => setRefreshToken((n) => n + 1)}
      />
    </OperationalPageShell>
  )
}
