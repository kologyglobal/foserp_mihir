import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Banknote, CalendarClock, Download, MoreHorizontal, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import {
  PayableEmptyState,
  PayablesCoreFlowStrip,
  PayablesSummaryCards,
  PayablesWorkspaceTabs,
  PaymentHoldDialog,
  VendorStatementPreview,
} from '@/components/accounting/payables'
import {
  DEFAULT_PAYABLE_FILTER,
  exportPayables,
  getPayableLookups,
  getVendorOutstanding,
  PayablesServiceError,
} from '@/services/accounting/payablesService'
import type {
  PayableAgeingBucket,
  PayableFilter,
  PayableLookups,
  PayableVendorStatus,
  VendorOutstandingSummary,
} from '@/types/payables'
import { PAYABLE_AGEING_BUCKETS } from '@/types/payables'
import { usePayablesPermissions } from '@/utils/permissions/payables'
import { formatCurrency, formatCompactCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { MQ_MOBILE, useMediaQuery } from '@/hooks/useMediaQuery'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import {
  clearPayableFilterFields,
  downloadTextFile,
  sortVendorOutstandingRows,
  type VendorOutstandingSortKey,
} from './payablesUi'
import { cn } from '@/utils/cn'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

function filterFromSearchParams(params: URLSearchParams): Partial<PayableFilter> {
  const patch: Partial<PayableFilter> = {}
  const vendorId = params.get('vendorId')
  if (vendorId) patch.vendorId = vendorId
  const os = params.get('overdueStatus')
  if (os === 'overdue' || os === 'current' || os === 'due_soon') patch.overdueStatus = os
  const ab = params.get('ageingBucket')
  if (ab) patch.ageingBucket = ab as PayableAgeingBucket
  const vc = params.get('vendorCategory')
  if (vc) patch.vendorCategory = vc
  const vs = params.get('vendorStatus')
  if (vs === 'Active' || vs === 'On Hold') patch.vendorStatus = vs
  return patch
}

function CreditUtilBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  return (
    <div className="min-w-[5rem]">
      <div className="h-1.5 overflow-hidden rounded-full bg-erp-surface-alt">
        <div
          className={cn('h-full rounded-full', pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-erp-muted">{limit > 0 ? `${pct}%` : '—'}</span>
    </div>
  )
}

export function VendorOutstandingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const perms = usePayablesPermissions()
  const isMobile = useMediaQuery(MQ_MOBILE)

  const [filter, setFilter] = useState<PayableFilter>(() => ({
    ...DEFAULT_PAYABLE_FILTER,
    workspaceTab: 'outstanding',
    ...filterFromSearchParams(searchParams),
  }))
  const [rows, setRows] = useState<VendorOutstandingSummary[]>([])
  const [lookups, setLookups] = useState<PayableLookups | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [sortKey, setSortKey] = useState<VendorOutstandingSortKey>('totalOutstanding')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const pageSize = 25
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [holdTarget, setHoldTarget] = useState<VendorOutstandingSummary | null>(null)
  const [statementOpen, setStatementOpen] = useState(false)
  const [statementVendorId, setStatementVendorId] = useState<string>()
  const [statementVendorName, setStatementVendorName] = useState<string>()

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
        const [list, looks] = await Promise.all([
          getVendorOutstanding(filter),
          lookups ? Promise.resolve(lookups) : getPayableLookups(),
        ])
        if (signal?.cancelled) return
        setRows(list)
        setLookups(looks)
        setLoadState(list.length === 0 ? 'empty' : 'ready')
      } catch (err) {
        if (signal?.cancelled) return
        setErrorMessage(err instanceof Error ? err.message : 'Vendor outstanding could not be loaded.')
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

  const sorted = useMemo(() => sortVendorOutstandingRows(rows, sortKey, sortDir), [rows, sortKey, sortDir])
  const paged = useMemo(() => sorted.slice(page * pageSize, page * pageSize + pageSize), [sorted, page])

  useEffect(() => {
    setPage(0)
  }, [filter, sortKey, sortDir])

  const summary = useMemo(() => {
    const withBal = rows.filter((r) => r.totalOutstanding > 0)
    return {
      totalVendors: withBal.length,
      totalOutstanding: withBal.reduce((s, r) => s + r.totalOutstanding, 0),
      current: withBal.reduce((s, r) => s + r.currentAmount, 0),
      overdue: withBal.reduce((s, r) => s + r.overdueAmount, 0),
      onHold: withBal.filter((r) => r.paymentHold || r.status === 'On Hold').length,
      msme: withBal.filter((r) => r.msme).length,
    }
  }, [rows])

  const kpiItems: EnterpriseKpiItem[] = [
    { id: 'vendors', label: 'Total Vendors', value: summary.totalVendors, accent: 'blue' },
    {
      id: 'outstanding',
      label: 'Total Outstanding',
      value: formatCompactCurrency(summary.totalOutstanding),
      helper: formatCurrency(summary.totalOutstanding),
      accent: 'blue',
    },
    { id: 'current', label: 'Current', value: formatCompactCurrency(summary.current), accent: 'green' },
    { id: 'overdue', label: 'Overdue', value: formatCompactCurrency(summary.overdue), accent: 'red' },
    { id: 'hold', label: 'On Hold', value: summary.onHold, accent: 'amber' },
    { id: 'msme', label: 'MSME Vendors', value: summary.msme, accent: 'slate' },
  ]

  const handleSort = (key: VendorOutstandingSortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const handleExport = async () => {
    if (!perms.canExport) return notify.error('Missing export permission')
    try {
      const result = await exportPayables({ scope: 'vendor_outstanding', format: 'csv', filter })
      downloadTextFile(result.filename, result.content)
      notify.success(result.disclaimer)
    } catch (err) {
      notify.error(err instanceof PayablesServiceError ? err.message : 'Export failed')
    }
  }

  const hasActiveFilters =
    filter.search ||
    filter.vendorId ||
    filter.vendorCategory ||
    filter.vendorStatus ||
    filter.overdueStatus !== 'all' ||
    filter.ageingBucket

  if (!perms.canView || !perms.canViewVendor) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Vendor Outstanding"
        breadcrumbs={[
          { label: 'Accounting', to: '/accounting' },
          { label: 'Payables', to: '/accounting/payables' },
          { label: 'Outstanding' },
        ]}
        autoBreadcrumbs={false}
      >
        <PayableEmptyState title="Access denied" description="You cannot view vendor outstanding." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Vendor Outstanding"
      description="Primary AP workspace — vendor open balances, priority, and the start of the payment run."
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Payables', to: '/accounting/payables' },
        { label: 'Outstanding' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/payables/outstanding"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canViewPaymentPlanning || perms.canViewPlanning
              ? {
                  id: 'plan-payments',
                  label: 'Plan Payments',
                  icon: CalendarClock,
                  variant: 'primary',
                  onClick: () => navigate('/accounting/payables/payment-planning'),
                }
              : perms.canCreatePayment
                ? {
                    id: 'create-payment',
                    label: 'Create Payment',
                    icon: Banknote,
                    variant: 'primary',
                    onClick: () => navigate('/accounting/payables/payments/new'),
                  }
                : undefined
          }
          secondaryActions={[
            ...(perms.canCreatePayment
              ? [
                  {
                    id: 'create-payment',
                    label: 'Create Payment',
                    icon: Banknote,
                    onClick: () => navigate('/accounting/payables/payments/new'),
                  },
                ]
              : []),
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
      <PayablesWorkspaceTabs active="outstanding" />
      <PayablesCoreFlowStrip active="outstanding" className="mt-3" />

      <div className="mt-3">
        <PayablesSummaryCards items={kpiItems} />
      </div>

      <div className="mb-2 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-erp-border bg-erp-surface/40 px-3 py-2">
        <SearchInput
          value={filter.search}
          onChange={(search) => setFilter((f) => ({ ...f, search }))}
          placeholder="Vendor, code, GSTIN…"
          className="w-full max-w-xs"
          size="sm"
        />
        <select
          className="erp-input h-9 min-w-[9rem] text-[12px]"
          value={filter.vendorCategory}
          onChange={(e) => setFilter((f) => ({ ...f, vendorCategory: e.target.value }))}
          aria-label="Vendor category"
        >
          <option value="">Category</option>
          {(lookups?.vendorCategories ?? []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="erp-input h-9 min-w-[8rem] text-[12px]"
          value={filter.vendorStatus}
          onChange={(e) => setFilter((f) => ({ ...f, vendorStatus: e.target.value as PayableVendorStatus | '' }))}
          aria-label="Vendor status"
        >
          <option value="">Status</option>
          <option value="Active">Active</option>
          <option value="On Hold">On Hold</option>
        </select>
        <select
          className="erp-input h-9 min-w-[8rem] text-[12px]"
          value={filter.overdueStatus}
          onChange={(e) => setFilter((f) => ({ ...f, overdueStatus: e.target.value as PayableFilter['overdueStatus'] }))}
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
      </div>

      {moreFiltersOpen ? (
        <div className="mb-2 flex flex-wrap gap-2 rounded-lg border border-erp-border bg-white px-3 py-2">
          <select
            className="erp-input h-9 min-w-[8rem] text-[12px]"
            value={filter.ageingBucket}
            onChange={(e) => setFilter((f) => ({ ...f, ageingBucket: e.target.value as PayableAgeingBucket | '' }))}
          >
            <option value="">Ageing bucket</option>
            {PAYABLE_AGEING_BUCKETS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {hasActiveFilters ? (
        <div className="mb-2">
          <button
            type="button"
            className="text-[11px] font-semibold text-erp-muted hover:text-erp-text"
            onClick={() => setFilter(clearPayableFilterFields(filter, { workspaceTab: 'outstanding' }))}
          >
            Clear Filters
          </button>
        </div>
      ) : null}

      {loadState === 'loading' ? <LoadingState variant="table" rows={10} /> : null}

      {loadState === 'error' ? (
        <PayableEmptyState
          title="Vendor outstanding could not be loaded."
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
          title={hasActiveFilters ? 'No vendors match the selected filters.' : 'No outstanding vendor balances.'}
          description="Adjust filters or clear them to continue."
          actions={(
            <button
              type="button"
              className="erp-btn erp-btn-primary h-9 px-4 text-[13px]"
              onClick={() => setFilter(clearPayableFilterFields(filter, { workspaceTab: 'outstanding' }))}
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
                    <button type="button" className="hover:text-erp-text" onClick={() => handleSort('vendorName')}>
                      Vendor
                    </button>
                  </th>
                  <th className="px-3 py-2">Category</th>
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
                  <th className="px-3 py-2">Utilization</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Invoices</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {paged.map((row) => (
                  <tr key={row.vendorId} className="border-t border-erp-border hover:bg-erp-surface-alt/50">
                    <td className="px-3 py-2">
                      <Link
                        to={`/accounting/payables/vendor/${row.vendorId}`}
                        className="font-semibold text-erp-primary hover:underline"
                      >
                        {row.vendorName}
                      </Link>
                      <p className="font-mono text-[11px] text-erp-muted">{row.vendorCode}</p>
                      {row.msme ? (
                        <span className="text-[10px] font-semibold text-sky-700">MSME {row.msmeCategory ?? ''}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{row.category}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(row.totalOutstanding)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-rose-700">{formatCurrency(row.overdueAmount)}</td>
                    <td className="px-3 py-2">
                      <CreditUtilBar used={row.totalOutstanding} limit={row.creditLimit} />
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'text-[11px] font-semibold',
                          row.paymentPriority === 'Critical' || row.paymentPriority === 'MSME Priority'
                            ? 'text-rose-700'
                            : row.paymentPriority === 'High'
                              ? 'text-amber-700'
                              : 'text-erp-muted',
                        )}
                      >
                        {row.paymentPriority}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {row.paymentHold || row.status === 'On Hold' ? (
                        <span className="text-[11px] font-semibold text-rose-700">On Hold</span>
                      ) : (
                        <span className="text-[11px] text-emerald-700">Active</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.openInvoiceCount}</td>
                    <td className="relative px-2 py-2">
                      <div ref={openMenuId === row.vendorId ? menuRef : undefined} className="relative inline-block">
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-erp-surface-alt"
                          aria-label="Row actions"
                          onClick={() => setOpenMenuId(openMenuId === row.vendorId ? null : row.vendorId)}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {openMenuId === row.vendorId ? (
                          <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-erp-border bg-white py-1 shadow-lg">
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                              onClick={() => {
                                navigate(`/accounting/payables/vendor/${row.vendorId}`)
                                setOpenMenuId(null)
                              }}
                            >
                              View Vendor Card
                            </button>
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                              onClick={() => {
                                navigate(`/accounting/payables/invoices?vendorId=${row.vendorId}`)
                                setOpenMenuId(null)
                              }}
                            >
                              View Outstanding Invoices
                            </button>
                            {perms.canCreatePayment ? (
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                                onClick={() => {
                                  navigate(`/accounting/payables/payments/new?vendorId=${row.vendorId}`)
                                  setOpenMenuId(null)
                                }}
                              >
                                Create Payment
                              </button>
                            ) : null}
                            {perms.canViewStatement ? (
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                                onClick={() => {
                                  setStatementVendorId(row.vendorId)
                                  setStatementVendorName(row.vendorName)
                                  setStatementOpen(true)
                                  setOpenMenuId(null)
                                }}
                              >
                                Vendor Statement
                              </button>
                            ) : null}
                            {perms.canManagePaymentHold ? (
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                                onClick={() => {
                                  setHoldTarget(row)
                                  setOpenMenuId(null)
                                }}
                              >
                                {row.status === 'On Hold' ? 'Release Hold' : 'Place Hold'}
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

      {holdTarget ? (
        <PaymentHoldDialog
          open={Boolean(holdTarget)}
          onClose={() => setHoldTarget(null)}
          vendorId={holdTarget.vendorId}
          vendorName={holdTarget.vendorName}
          vendorStatus={holdTarget.status}
          onSaved={() => setRefreshToken((n) => n + 1)}
        />
      ) : null}

      <VendorStatementPreview
        open={statementOpen}
        onClose={() => setStatementOpen(false)}
        vendorId={statementVendorId}
        vendorName={statementVendorName}
      />
    </OperationalPageShell>
  )
}
