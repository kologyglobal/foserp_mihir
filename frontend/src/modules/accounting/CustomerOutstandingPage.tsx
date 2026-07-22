import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bookmark,
  Download,
  MoreHorizontal,
  RefreshCw,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import {
  CollectionActivityDrawer,
  CreditHoldDialog,
  CreditStatusBadge,
  CreditUtilizationBar,
  CustomerStatementPreview,
  CollectionStatusBadge,
  ReceivableEmptyState,
  ReceivablesSummaryCards,
  ReceivablesWorkspaceTabs,
  type CollectionActivityCustomerSummary,
} from '@/components/accounting/receivables'
import {
  DEFAULT_RECEIVABLE_FILTER,
  exportReceivables,
  getCustomerOutstanding,
  getReceivableLookups,
  getSavedReceivableViews,
  ReceivablesServiceError,
  saveReceivableView,
} from '@/services/accounting/receivablesService'
import { isApiMode } from '@/config/apiConfig'
import { getCommercialCommitmentSummary } from '@/data/accounting/commercialCommitmentsSeed'
import type { CommercialCommitmentSummary } from '@/types/commercialCommitments'
import type {
  CustomerCreditStatus,
  CustomerOutstandingSummary,
  ReceivableAgeingBucket,
  ReceivableFilter,
  ReceivableLookups,
  ReceivableSavedView,
} from '@/types/receivables'
import { RECEIVABLE_AGEING_BUCKETS } from '@/types/receivables'
import { useReceivablesPermissions } from '@/utils/permissions/receivables'
import { formatCurrency, formatCompactCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { MQ_MOBILE, useMediaQuery } from '@/hooks/useMediaQuery'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import {
  clearReceivableFilterFields,
  downloadTextFile,
  sortOutstandingRows,
  type OutstandingSortKey,
} from './receivablesUi'
import { cn } from '@/utils/cn'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

function filterFromSearchParams(params: URLSearchParams): Partial<ReceivableFilter> {
  const patch: Partial<ReceivableFilter> = {}
  const cs = params.get('creditStatus')
  if (cs) patch.creditStatus = cs as CustomerCreditStatus
  const os = params.get('overdueStatus')
  if (os === 'overdue' || os === 'current' || os === 'due_soon') patch.overdueStatus = os
  const ab = params.get('ageingBucket')
  if (ab) patch.ageingBucket = ab as ReceivableAgeingBucket
  const cg = params.get('customerGroup')
  if (cg) patch.customerGroup = cg
  return patch
}

export function CustomerOutstandingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const perms = useReceivablesPermissions()
  const isMobile = useMediaQuery(MQ_MOBILE)

  const [filter, setFilter] = useState<ReceivableFilter>(() => ({
    ...DEFAULT_RECEIVABLE_FILTER,
    workspaceTab: 'outstanding',
    ...filterFromSearchParams(searchParams),
  }))
  const [rows, setRows] = useState<CustomerOutstandingSummary[]>([])
  const [lookups, setLookups] = useState<ReceivableLookups | null>(null)
  const [savedViews, setSavedViews] = useState<ReceivableSavedView[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [sortKey, setSortKey] = useState<OutstandingSortKey>('totalOutstanding')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const pageSize = 25
  const [viewsOpen, setViewsOpen] = useState(false)
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [activityOpen, setActivityOpen] = useState(false)
  const [activityCustomer, setActivityCustomer] = useState<CollectionActivityCustomerSummary | null>(null)
  const [holdTarget, setHoldTarget] = useState<CustomerOutstandingSummary | null>(null)
  const [statementOpen, setStatementOpen] = useState(false)
  const [statementCustomerId, setStatementCustomerId] = useState<string>()
  const [statementCustomerName, setStatementCustomerName] = useState<string>()
  const [commercialSummary, setCommercialSummary] = useState<CommercialCommitmentSummary | null>(null)

  useEffect(() => {
    setFilter((f) => ({ ...f, ...filterFromSearchParams(searchParams) }))
  }, [searchParams])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const load = useCallback(
    async (signal?: { cancelled: boolean }) => {
      setLoadState('loading')
      setErrorMessage(null)
      try {
        const [list, looks, views] = await Promise.all([
          getCustomerOutstanding(filter),
          lookups ? Promise.resolve(lookups) : getReceivableLookups(),
          getSavedReceivableViews(),
        ])
        if (signal?.cancelled) return
        setRows(list)
        setLookups(looks)
        setSavedViews(views)
        setLoadState(list.length === 0 ? 'empty' : 'ready')
      } catch (err) {
        if (signal?.cancelled) return
        setErrorMessage(err instanceof Error ? err.message : 'Outstanding balances could not be loaded.')
        setLoadState('error')
      }
    },
    [filter, lookups],
  )

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, refreshToken])

  useEffect(() => {
    // Commercial commitments are a seed-backed panel — never surface seed data in API mode.
    if (isApiMode()) return
    void getCommercialCommitmentSummary().then(setCommercialSummary)
  }, [refreshToken])

  const sorted = useMemo(() => sortOutstandingRows(rows, sortKey, sortDir), [rows, sortKey, sortDir])
  const paged = useMemo(() => sorted.slice(page * pageSize, page * pageSize + pageSize), [sorted, page])

  useEffect(() => {
    setPage(0)
  }, [filter, sortKey, sortDir])

  const summary = useMemo(() => {
    const withBal = rows.filter((r) => r.totalOutstanding > 0)
    return {
      totalCustomers: withBal.length,
      totalOutstanding: withBal.reduce((s, r) => s + r.totalOutstanding, 0),
      current: withBal.reduce((s, r) => s + r.currentAmount, 0),
      overdue: withBal.reduce((s, r) => s + r.overdueAmount, 0),
      creditHold: withBal.filter((r) => r.creditStatus === 'Credit Hold').length,
      overLimit: withBal.filter((r) => r.creditStatus === 'Over Limit').length,
    }
  }, [rows])

  const kpiItems: EnterpriseKpiItem[] = [
    { id: 'customers', label: 'Total Customers', value: summary.totalCustomers, accent: 'blue' },
    { id: 'outstanding', label: 'Total Outstanding', value: formatCompactCurrency(summary.totalOutstanding), helper: formatCurrency(summary.totalOutstanding), accent: 'blue' },
    { id: 'current', label: 'Current', value: formatCompactCurrency(summary.current), accent: 'green' },
    { id: 'overdue', label: 'Overdue', value: formatCompactCurrency(summary.overdue), accent: 'red' },
    { id: 'hold', label: 'Credit Hold', value: summary.creditHold, accent: 'amber' },
    { id: 'overlimit', label: 'Over Credit Limit', value: summary.overLimit, accent: 'red' },
  ]

  const handleSort = (key: OutstandingSortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const saveCurrentView = async () => {
    if (!perms.canSaveView) return notify.error('Missing save view permission')
    const name = `Outstanding ${new Date().toLocaleString('en-IN')}`
    try {
      await saveReceivableView({
        name,
        filters: filter,
        columns: [],
        sortKey,
        sortDir,
        selectedTab: 'outstanding',
      })
      setSavedViews(await getSavedReceivableViews())
      notify.success(`Saved “${name}” (demo session).`)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Could not save view')
    }
  }

  const handleExport = async () => {
    if (!perms.canExport) return notify.error('Missing export permission')
    try {
      const result = await exportReceivables({ scope: 'customer_outstanding', format: 'csv', filter })
      downloadTextFile(result.filename, result.content)
      notify.success(result.disclaimer)
    } catch (err) {
      notify.error(err instanceof ReceivablesServiceError ? err.message : 'Export failed')
    }
  }

  const openActivity = (row: CustomerOutstandingSummary) => {
    setActivityCustomer({
      customerId: row.customerId,
      customerName: row.customerName,
      outstanding: row.totalOutstanding,
      overdue: row.overdueAmount,
      creditLimit: row.creditLimit,
      oldestDueDate: row.oldestDueDate,
      collectionOwner: row.collectionOwner,
    })
    setActivityOpen(true)
  }

  const hasActiveFilters =
    filter.search ||
    filter.customerGroup ||
    filter.salesperson ||
    filter.territory ||
    filter.state ||
    filter.creditStatus ||
    filter.overdueStatus !== 'all' ||
    filter.ageingBucket ||
    filter.hasDispute !== 'all' ||
    filter.hasPaymentPromise !== 'all'

  if (!perms.canView || !perms.canViewCustomer) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Customer Outstanding"
        breadcrumbs={[
          { label: 'Accounting', to: '/accounting' },
          { label: 'Receivables', to: '/accounting/receivables' },
          { label: 'Outstanding' },
        ]}
        autoBreadcrumbs={false}
      >
        <ReceivableEmptyState title="Access denied" description="You cannot view customer outstanding." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Customer Outstanding"
      description="Customer-wise open balances, credit utilization, collection status and drill-down to invoices."
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Receivables', to: '/accounting/receivables' },
        { label: 'Outstanding' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/receivables/outstanding"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateReceipt
              ? {
                  id: 'record-receipt',
                  label: 'Record Receipt',
                  variant: 'primary',
                  onClick: () => navigate('/accounting/receivables/receipts/new'),
                }
              : undefined
          }
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
          moreActions={[
            {
              id: 'save-view',
              label: 'Save Current View',
              icon: Bookmark,
              disabled: !perms.canSaveView,
              onClick: () => void saveCurrentView(),
            },
          ]}
        />
      )}
    >
      <ReceivablesWorkspaceTabs active="outstanding" />

      <div className="mt-3 space-y-3">
        <ReceivablesSummaryCards items={kpiItems} />
        {commercialSummary ? (
          <Link
            to="/accounting/commercial-commitments"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2.5 text-[12px] hover:border-amber-300"
          >
            <span>
              <span className="font-semibold text-amber-900">Pending Commercial Value</span>
              {' · '}
              <span className="tabular-nums font-semibold">
                {formatCurrency(commercialSummary.potentialReceivable)}
              </span>
              <span className="text-erp-muted"> confirmed but not invoiced (excluded from outstanding)</span>
            </span>
            <span className="font-semibold text-erp-primary">Commercial Commitments →</span>
          </Link>
        ) : null}
      </div>

      <div className="mb-2 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-erp-border bg-erp-surface/40 px-3 py-2">
        <SearchInput
          value={filter.search}
          onChange={(search) => setFilter((f) => ({ ...f, search }))}
          placeholder="Customer, code, GSTIN…"
          className="w-full max-w-xs"
          size="sm"
        />
        <select
          className="erp-input h-9 min-w-[9rem] text-[12px]"
          value={filter.customerGroup}
          onChange={(e) => setFilter((f) => ({ ...f, customerGroup: e.target.value }))}
          aria-label="Customer group"
        >
          <option value="">Customer group</option>
          {(lookups?.customerGroups ?? []).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          className="erp-input h-9 min-w-[8rem] text-[12px]"
          value={filter.salesperson}
          onChange={(e) => setFilter((f) => ({ ...f, salesperson: e.target.value }))}
          aria-label="Salesperson"
        >
          <option value="">Salesperson</option>
          {(lookups?.salespersons ?? []).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="erp-input h-9 min-w-[8rem] text-[12px]"
          value={filter.territory}
          onChange={(e) => setFilter((f) => ({ ...f, territory: e.target.value }))}
          aria-label="Territory"
        >
          <option value="">Territory</option>
          {(lookups?.territories ?? []).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          className="erp-input h-9 min-w-[7rem] text-[12px]"
          value={filter.state}
          onChange={(e) => setFilter((f) => ({ ...f, state: e.target.value }))}
          aria-label="State"
        >
          <option value="">State</option>
          {(lookups?.states ?? []).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="erp-input h-9 min-w-[8rem] text-[12px]"
          value={filter.creditStatus}
          onChange={(e) => setFilter((f) => ({ ...f, creditStatus: e.target.value as CustomerCreditStatus | '' }))}
          aria-label="Credit status"
        >
          <option value="">Credit status</option>
          {(['Within Limit', 'Near Limit', 'Over Limit', 'Credit Hold', 'Temporarily Released', 'No Credit Limit'] as const).map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ),
          )}
        </select>
        <select
          className="erp-input h-9 min-w-[8rem] text-[12px]"
          value={filter.overdueStatus}
          onChange={(e) =>
            setFilter((f) => ({ ...f, overdueStatus: e.target.value as ReceivableFilter['overdueStatus'] }))
          }
          aria-label="Overdue status"
        >
          <option value="all">Overdue: All</option>
          <option value="current">Current only</option>
          <option value="overdue">Overdue only</option>
        </select>
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-lg border border-erp-border bg-white px-2.5 text-[12px] font-semibold"
          onClick={() => setMoreFiltersOpen((o) => !o)}
        >
          {moreFiltersOpen ? 'Fewer filters' : 'More filters'}
        </button>
        <div className="relative ml-auto">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-erp-border bg-white px-2.5 text-[12px] font-semibold"
            onClick={() => setViewsOpen((o) => !o)}
          >
            <Bookmark className="h-3.5 w-3.5" />
            Saved Views
          </button>
          {viewsOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-erp-border bg-white py-1 shadow-lg">
              {savedViews.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className="flex w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                  onClick={() => {
                    setFilter(v.filters)
                    setSortKey(v.sortKey as OutstandingSortKey)
                    setSortDir(v.sortDir)
                    setViewsOpen(false)
                    notify.success(`Applied “${v.name}”`)
                  }}
                >
                  {v.name}
                </button>
              ))}
              <button
                type="button"
                className="flex w-full border-t border-erp-border px-3 py-2 text-left text-[12px] font-semibold text-erp-primary"
                onClick={() => {
                  setViewsOpen(false)
                  void saveCurrentView()
                }}
              >
                Save current view…
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {moreFiltersOpen ? (
        <div className="mb-2 flex flex-wrap gap-2 rounded-lg border border-erp-border bg-white px-3 py-2">
          <select
            className="erp-input h-9 min-w-[8rem] text-[12px]"
            value={filter.ageingBucket}
            onChange={(e) => setFilter((f) => ({ ...f, ageingBucket: e.target.value as ReceivableAgeingBucket | '' }))}
          >
            <option value="">Ageing bucket</option>
            {RECEIVABLE_AGEING_BUCKETS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select
            className="erp-input h-9 min-w-[8rem] text-[12px]"
            value={filter.hasDispute}
            onChange={(e) => setFilter((f) => ({ ...f, hasDispute: e.target.value as ReceivableFilter['hasDispute'] }))}
          >
            <option value="all">Dispute: All</option>
            <option value="yes">Has dispute</option>
            <option value="no">No dispute</option>
          </select>
          <select
            className="erp-input h-9 min-w-[8rem] text-[12px]"
            value={filter.hasPaymentPromise}
            onChange={(e) =>
              setFilter((f) => ({ ...f, hasPaymentPromise: e.target.value as ReceivableFilter['hasPaymentPromise'] }))
            }
          >
            <option value="all">Promise: All</option>
            <option value="yes">Has promise</option>
            <option value="no">No promise</option>
          </select>
        </div>
      ) : null}

      {hasActiveFilters ? (
        <div className="mb-2">
          <button
            type="button"
            className="text-[11px] font-semibold text-erp-muted hover:text-erp-text"
            onClick={() => setFilter(clearReceivableFilterFields(filter, { workspaceTab: 'outstanding' }))}
          >
            Clear Filters
          </button>
        </div>
      ) : null}

      {loadState === 'loading' ? <LoadingState variant="table" rows={10} /> : null}

      {loadState === 'error' ? (
        <ReceivableEmptyState
          title="Outstanding balances could not be loaded."
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
          title={hasActiveFilters ? 'No customers match the selected filters.' : 'No outstanding customer balances.'}
          description="Adjust filters or clear them to continue."
          actions={(
            <button
              type="button"
              className="erp-btn erp-btn-primary h-9 px-4 text-[13px]"
              onClick={() => setFilter(clearReceivableFilterFields(filter, { workspaceTab: 'outstanding' }))}
            >
              Clear Filters
            </button>
          )}
        />
      ) : null}

      {loadState === 'ready' ? (
        <EnterpriseRegisterTableShell className="border-0 shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[72rem] text-[12px]">
              <thead className="sticky top-0 z-10 bg-erp-surface-alt text-left text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                <tr>
                  <th className="px-3 py-2">
                    <button type="button" className="hover:text-erp-text" onClick={() => handleSort('customerName')}>
                      Customer
                    </button>
                  </th>
                  <th className="px-3 py-2">Group</th>
                  <th className="px-3 py-2">Salesperson</th>
                  <th className="px-3 py-2 text-right">
                    <button type="button" className="hover:text-erp-text" onClick={() => handleSort('totalOutstanding')}>
                      Outstanding
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right">
                    <button type="button" className="hover:text-erp-text" onClick={() => handleSort('overdueAmount')}>
                      Overdue
                    </button>
                  </th>
                  <th className="px-3 py-2">Credit</th>
                  <th className="px-3 py-2">Utilization</th>
                  <th className="px-3 py-2">Collection</th>
                  <th className="px-3 py-2 text-right">Invoices</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {paged.map((row) => (
                  <tr key={row.customerId} className="border-t border-erp-border hover:bg-erp-surface-alt/50">
                    <td className="px-3 py-2">
                      <Link
                        to={`/accounting/receivables/customer/${row.customerId}`}
                        className="font-semibold text-erp-primary hover:underline"
                      >
                        {row.customerName}
                      </Link>
                      <p className="font-mono text-[11px] text-erp-muted">{row.customerCode}</p>
                    </td>
                    <td className="px-3 py-2">{row.customerGroup}</td>
                    <td className="px-3 py-2">{row.salesperson}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(row.totalOutstanding)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-rose-700">{formatCurrency(row.overdueAmount)}</td>
                    <td className="px-3 py-2">
                      <CreditStatusBadge status={row.creditStatus} />
                    </td>
                    <td className="px-3 py-2">
                      <CreditUtilizationBar used={row.totalOutstanding} limit={row.creditLimit} />
                    </td>
                    <td className="px-3 py-2">
                      <CollectionStatusBadge status={row.collectionStatus} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.openInvoiceCount}</td>
                    <td className="relative px-2 py-2">
                      <div ref={openMenuId === row.customerId ? menuRef : undefined} className="relative inline-block">
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-erp-surface-alt"
                          aria-label="Row actions"
                          onClick={() => setOpenMenuId(openMenuId === row.customerId ? null : row.customerId)}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {openMenuId === row.customerId ? (
                          <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-erp-border bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                            onClick={() => {
                              navigate(`/accounting/receivables/customer/${row.customerId}`)
                              setOpenMenuId(null)
                            }}
                          >
                            View Customer
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                            onClick={() => {
                              navigate(`/accounting/receivables/invoices?customerId=${row.customerId}`)
                              setOpenMenuId(null)
                            }}
                          >
                            View Outstanding Invoices
                          </button>
                          {perms.canCreateReceipt ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                              onClick={() => {
                                navigate(`/accounting/receivables/receipts/new?customerId=${row.customerId}`)
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
                                navigate(`/accounting/receivables/allocations?customerId=${row.customerId}`)
                                setOpenMenuId(null)
                              }}
                            >
                              Allocate
                            </button>
                          ) : null}
                          {perms.canManageCollection ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                              onClick={() => {
                                openActivity(row)
                                setOpenMenuId(null)
                              }}
                            >
                              Create Collection Activity
                            </button>
                          ) : null}
                          {perms.canManagePromise ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                              onClick={() => {
                                openActivity(row)
                                setOpenMenuId(null)
                              }}
                            >
                              Create Payment Promise
                            </button>
                          ) : null}
                          {perms.canPreviewReminder ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                              onClick={() => {
                                navigate('/accounting/receivables/reminders')
                                notify.info('Open reminder preview from Reminders workspace (demo).')
                                setOpenMenuId(null)
                              }}
                            >
                              Send Reminder Preview
                            </button>
                          ) : null}
                          {perms.canViewStatement ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                              onClick={() => {
                                setStatementCustomerId(row.customerId)
                                setStatementCustomerName(row.customerName)
                                setStatementOpen(true)
                                setOpenMenuId(null)
                              }}
                            >
                              View Statement
                            </button>
                          ) : null}
                          {perms.canManageCreditHold ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                              onClick={() => {
                                setHoldTarget(row)
                                setOpenMenuId(null)
                              }}
                            >
                              {row.creditStatus === 'Credit Hold' ? 'Remove Credit Hold' : 'Place Credit Hold'}
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
              <button
                type="button"
                className="erp-btn erp-btn-ghost h-8 px-2 text-[12px]"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
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

      <CollectionActivityDrawer
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        customerSummary={activityCustomer ?? undefined}
        onSaved={() => setRefreshToken((n) => n + 1)}
      />

      {holdTarget ? (
        <CreditHoldDialog
          open={Boolean(holdTarget)}
          onClose={() => setHoldTarget(null)}
          customerId={holdTarget.customerId}
          customerName={holdTarget.customerName}
          creditStatus={holdTarget.creditStatus}
          onSaved={() => setRefreshToken((n) => n + 1)}
        />
      ) : null}

      <CustomerStatementPreview
        open={statementOpen}
        onClose={() => setStatementOpen(false)}
        customerId={statementCustomerId}
        customerName={statementCustomerName}
      />
    </OperationalPageShell>
  )
}
