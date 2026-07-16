import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Download, MoreHorizontal, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import {
  PayableEmptyState,
  PayableInvoiceStatusBadge,
  PayableMatchStatusBadge,
  PayablesSummaryCards,
  PayablesWorkspaceTabs,
  ThreeWayMatchDrawer,
} from '@/components/accounting/payables'
import {
  DEFAULT_PAYABLE_FILTER,
  exportPayables,
  getPayableInvoices,
  getThreeWayMatch,
  PayablesServiceError,
} from '@/services/accounting/payablesService'
import type { MatchStatus, PayableAgeingBucket, PayableFilter, PayableInvoice } from '@/types/payables'
import { usePayablesPermissions } from '@/utils/permissions/payables'
import { formatCurrency, formatCompactCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { MQ_MOBILE, useMediaQuery } from '@/hooks/useMediaQuery'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import type { ThreeWayMatchResult as DrawerMatchResult } from '@/components/accounting/payables'
import {
  clearPayableFilterFields,
  downloadTextFile,
  isPayableMatchMismatch,
  mapMatchStatusForBadge,
  mapThreeWayMatchForDrawer,
  sortPayableInvoiceRows,
  type PayableInvoiceSortKey,
} from './payablesUi'
import { cn } from '@/utils/cn'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

type InvoiceTabDef = {
  id: string
  label: string
  invoiceTab?: string
  matchStatus?: MatchStatus
  clientFilter?: 'mismatch' | 'on_hold'
}

const INVOICE_TABS: InvoiceTabDef[] = [
  { id: 'all', label: 'All' },
  { id: 'pending_verification', label: 'Pending Verification', matchStatus: 'Pending Verification' },
  { id: 'fully_matched', label: 'Fully Matched', matchStatus: 'Fully Matched' },
  { id: 'mismatch', label: 'Mismatch', clientFilter: 'mismatch' },
  { id: 'open', label: 'Open', invoiceTab: 'open' },
  { id: 'overdue', label: 'Overdue', invoiceTab: 'overdue' },
  { id: 'on_hold', label: 'On Hold', clientFilter: 'on_hold' },
  { id: 'partially_paid', label: 'Partially Paid', invoiceTab: 'partially_paid' },
  { id: 'disputed', label: 'Disputed', invoiceTab: 'disputed' },
  { id: 'paid', label: 'Paid', invoiceTab: 'paid' },
]

function tabToFilter(tabId: string): Partial<PayableFilter> {
  const tab = INVOICE_TABS.find((t) => t.id === tabId) ?? INVOICE_TABS[0]
  return {
    invoiceTab: tab.invoiceTab ?? 'all',
    matchStatus: tab.matchStatus ?? '',
  }
}

function applyClientTabFilter(rows: PayableInvoice[], tabId: string): PayableInvoice[] {
  const tab = INVOICE_TABS.find((t) => t.id === tabId)
  if (!tab?.clientFilter) return rows
  if (tab.clientFilter === 'mismatch') return rows.filter((i) => isPayableMatchMismatch(i.matchStatus))
  if (tab.clientFilter === 'on_hold') return rows.filter((i) => i.paymentHold?.status === 'Active')
  return rows
}

export function PayableInvoicesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const perms = usePayablesPermissions()
  const isMobile = useMediaQuery(MQ_MOBILE)

  const tabFromUrl = searchParams.get('invoiceTab') ?? searchParams.get('tab') ?? 'all'
  const vendorFromUrl = searchParams.get('vendorId') ?? ''
  const ageingFromUrl = searchParams.get('ageingBucket') ?? ''

  const [activeTab, setActiveTab] = useState(tabFromUrl)
  const [filter, setFilter] = useState<PayableFilter>(() => ({
    ...DEFAULT_PAYABLE_FILTER,
    workspaceTab: 'invoices',
    ...tabToFilter(tabFromUrl),
    vendorId: vendorFromUrl,
    ageingBucket: (ageingFromUrl as PayableAgeingBucket) || '',
  }))
  const [rows, setRows] = useState<PayableInvoice[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [sortKey, setSortKey] = useState<PayableInvoiceSortKey>('dueDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const pageSize = 25
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [matchOpen, setMatchOpen] = useState(false)
  const [matchResult, setMatchResult] = useState<DrawerMatchResult | null>(null)
  const [matchLoading, setMatchLoading] = useState(false)

  useEffect(() => {
    const tab = tabFromUrl
    setActiveTab(tab)
    setFilter((f) => ({
      ...f,
      ...tabToFilter(tab),
      vendorId: vendorFromUrl,
      ageingBucket: (ageingFromUrl as PayableAgeingBucket) || '',
    }))
  }, [tabFromUrl, vendorFromUrl, ageingFromUrl])

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
      const tabDef = INVOICE_TABS.find((t) => t.id === activeTab)
      const apiFilter: PayableFilter = {
        ...filter,
        matchStatus: tabDef?.clientFilter ? '' : filter.matchStatus,
        invoiceTab: tabDef?.clientFilter ? 'all' : filter.invoiceTab,
      }
      const list = await getPayableInvoices(apiFilter)
      if (signal?.cancelled) return
      const filtered = applyClientTabFilter(list, activeTab)
      setRows(filtered)
      setLoadState(filtered.length === 0 ? 'empty' : 'ready')
    } catch (err) {
      if (signal?.cancelled) return
      setErrorMessage(err instanceof Error ? err.message : 'Invoices could not be loaded.')
      setLoadState('error')
    }
  }, [filter, activeTab])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, refreshToken])

  const sorted = useMemo(() => sortPayableInvoiceRows(rows, sortKey, sortDir), [rows, sortKey, sortDir])
  const paged = useMemo(() => sorted.slice(page * pageSize, page * pageSize + pageSize), [sorted, page])

  useEffect(() => {
    setPage(0)
  }, [filter, sortKey, sortDir, activeTab])

  const summary = useMemo(
    () => ({
      total: rows.length,
      open: rows.filter((i) => i.status === 'Open').length,
      overdue: rows.filter((i) => i.status === 'Overdue').length,
      disputed: rows.filter((i) => i.hasDispute || i.status === 'Disputed').length,
      outstanding: rows.reduce((s, i) => s + i.outstandingBalance, 0),
    }),
    [rows],
  )

  const kpiItems: EnterpriseKpiItem[] = [
    { id: 'total', label: 'Invoices', value: summary.total, accent: 'blue' },
    { id: 'open', label: 'Open', value: summary.open, accent: 'blue' },
    { id: 'overdue', label: 'Overdue', value: summary.overdue, accent: 'red' },
    { id: 'disputed', label: 'Disputed', value: summary.disputed, accent: 'amber' },
    {
      id: 'balance',
      label: 'Total Outstanding',
      value: formatCompactCurrency(summary.outstanding),
      helper: formatCurrency(summary.outstanding),
      accent: 'blue',
    },
  ]

  const setInvoiceTab = (tab: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('invoiceTab', tab)
    setSearchParams(next)
    setActiveTab(tab)
    setFilter((f) => ({ ...f, ...tabToFilter(tab) }))
  }

  const handleSort = (key: PayableInvoiceSortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'dueDate' || key === 'invoiceDate' ? 'asc' : 'desc')
    }
  }

  const handleExport = async () => {
    if (!perms.canExport) return notify.error('Missing export permission')
    try {
      const result = await exportPayables({ scope: 'open_invoices', format: 'csv', filter })
      downloadTextFile(result.filename, result.content)
      notify.success(result.disclaimer)
    } catch (err) {
      notify.error(err instanceof PayablesServiceError ? err.message : 'Export failed')
    }
  }

  const openThreeWayMatch = async (invoiceId: string) => {
    setMatchLoading(true)
    setMatchOpen(true)
    setMatchResult(null)
    try {
      const result = await getThreeWayMatch(invoiceId)
      setMatchResult(mapThreeWayMatchForDrawer(result))
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Match data could not be loaded.')
      setMatchOpen(false)
    } finally {
      setMatchLoading(false)
    }
  }

  const hasActiveFilters =
    filter.search || filter.vendorId || filter.ageingBucket || activeTab !== 'all'

  if (!perms.canView || !perms.canViewInvoice) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Payable Invoices"
        breadcrumbs={[
          { label: 'Accounting', to: '/accounting' },
          { label: 'Payables', to: '/accounting/payables' },
          { label: 'Invoices' },
        ]}
        autoBreadcrumbs={false}
      >
        <PayableEmptyState title="Access denied" description="You cannot view payable invoices." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Payable Invoices"
      description="Vendor invoices with three-way match status, payment holds and ageing."
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Payables', to: '/accounting/payables' },
        { label: 'Invoices' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/payables/invoices"
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
      <PayablesWorkspaceTabs active="invoices" />

      <div className="mt-3 flex flex-wrap gap-1 border-b border-erp-border">
        {INVOICE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn(
              'rounded-t-md px-3 py-2 text-[12px] font-semibold',
              activeTab === tab.id
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
        <PayablesSummaryCards items={kpiItems} />
      </div>

      <div className="mb-2 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-erp-border bg-erp-surface/40 px-3 py-2">
        <SearchInput
          value={filter.search}
          onChange={(search) => setFilter((f) => ({ ...f, search }))}
          placeholder="Invoice, vendor, PO…"
          className="w-full max-w-xs"
          size="sm"
        />
        {hasActiveFilters ? (
          <button
            type="button"
            className="text-[11px] font-semibold text-erp-muted hover:text-erp-text"
            onClick={() => {
              setSearchParams({})
              setActiveTab('all')
              setFilter(clearPayableFilterFields(filter, { workspaceTab: 'invoices', invoiceTab: 'all' }))
            }}
          >
            Clear Filters
          </button>
        ) : null}
      </div>

      {loadState === 'loading' ? <LoadingState variant="table" rows={10} /> : null}

      {loadState === 'error' ? (
        <PayableEmptyState
          title="Payable invoices could not be loaded."
          description={errorMessage ?? undefined}
          actions={(
            <button type="button" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]" onClick={() => setRefreshToken((n) => n + 1)}>
              Retry
            </button>
          )}
        />
      ) : null}

      {loadState === 'empty' ? (
        <PayableEmptyState
          title={hasActiveFilters ? 'No invoices match the selected filters.' : 'No payable invoices found.'}
          description="Adjust tabs or clear filters to continue."
          actions={(
            <button
              type="button"
              className="erp-btn erp-btn-primary h-9 px-4 text-[13px]"
              onClick={() => {
                setSearchParams({})
                setActiveTab('all')
                setFilter(clearPayableFilterFields(filter, { workspaceTab: 'invoices', invoiceTab: 'all' }))
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
            <table className="w-full min-w-[84rem] text-[12px]">
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
                    <button type="button" onClick={() => handleSort('vendorName')}>Vendor</button>
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
                  <th className="px-3 py-2">Match</th>
                  <th className="px-3 py-2">Ageing</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {paged.map((inv) => (
                  <tr key={inv.id} className="border-t border-erp-border hover:bg-erp-surface-alt/50">
                    <td className="px-3 py-2">
                      <Link
                        to={`/accounting/payables/invoice/${inv.id}`}
                        className="font-mono font-semibold text-erp-primary hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                      {inv.paymentHold?.status === 'Active' ? (
                        <p className="text-[10px] font-semibold text-rose-700">On hold</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{formatDate(inv.invoiceDate)}</td>
                    <td className="px-3 py-2">{formatDate(inv.dueDate)}</td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/accounting/payables/vendor/${inv.vendorId}`}
                        className="hover:text-erp-primary hover:underline"
                      >
                        {inv.vendorName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(inv.originalAmount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(inv.outstandingBalance)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{inv.overdueDays > 0 ? `${inv.overdueDays}d` : '—'}</td>
                    <td className="px-3 py-2">
                      <PayableInvoiceStatusBadge status={inv.status} />
                    </td>
                    <td className="px-3 py-2">
                      <PayableMatchStatusBadge status={mapMatchStatusForBadge(inv.matchStatus)} />
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
                                navigate(`/accounting/payables/invoice/${inv.id}`)
                                setOpenMenuId(null)
                              }}
                            >
                              View Invoice
                            </button>
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                              onClick={() => {
                                void openThreeWayMatch(inv.id)
                                setOpenMenuId(null)
                              }}
                            >
                              View Three-Way Match
                            </button>
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                              onClick={() => {
                                navigate(`/accounting/payables/vendor/${inv.vendorId}`)
                                setOpenMenuId(null)
                              }}
                            >
                              Open Vendor
                            </button>
                            {perms.canCreatePayment && inv.outstandingBalance > 0 ? (
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                                onClick={() => {
                                  navigate(`/accounting/payables/payments/new?vendorId=${inv.vendorId}&invoiceId=${inv.id}`)
                                  setOpenMenuId(null)
                                }}
                              >
                                Create Payment
                              </button>
                            ) : null}
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

      <ThreeWayMatchDrawer
        open={matchOpen}
        onClose={() => {
          setMatchOpen(false)
          setMatchResult(null)
        }}
        result={matchLoading ? null : matchResult}
      />
    </OperationalPageShell>
  )
}
