import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, MessageCircle, MoreHorizontal, Phone, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import {
  CollectionActivityDrawer,
  CollectionStatusBadge,
  ReceivableEmptyState,
  ReceivablesWorkspaceTabs,
  type CollectionActivityCustomerSummary,
} from '@/components/accounting/receivables'
import {
  DEFAULT_RECEIVABLE_FILTER,
  getCollectionWorklist,
  getCustomerOutstanding,
} from '@/services/accounting/receivablesService'
import type { CollectionPriority, CollectionWorklistItem, ReceivableFilter } from '@/types/receivables'
import { useReceivablesPermissions } from '@/utils/permissions/receivables'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { MQ_MOBILE, useMediaQuery } from '@/hooks/useMediaQuery'
import { clearReceivableFilterFields, sortWorklistRows, type WorklistSortKey } from './receivablesUi'
import { cn } from '@/utils/cn'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

const COLLECTION_TABS: { id: string; label: string }[] = [
  { id: 'my_worklist', label: 'My Worklist' },
  { id: 'due_today', label: 'Due Today' },
  { id: 'overdue_followups', label: 'Overdue Follow-ups' },
  { id: 'payment_promises', label: 'Payment Promises' },
  { id: 'broken_promises', label: 'Broken Promises' },
  { id: 'disputes', label: 'Disputes' },
  { id: 'completed', label: 'Completed' },
  { id: 'all', label: 'All Activities' },
]

const PRIORITIES: CollectionPriority[] = [
  'Highest Overdue',
  'Highest Outstanding',
  'Oldest Invoice',
  'Broken Promise',
  'Credit Limit Exceeded',
  'Strategic Customer',
  'Manual Priority',
]

export function CollectionWorklistPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const perms = useReceivablesPermissions()
  const isMobile = useMediaQuery(MQ_MOBILE)

  const tabFromUrl = searchParams.get('tab') ?? 'my_worklist'

  const [filter, setFilter] = useState<ReceivableFilter>(() => ({
    ...DEFAULT_RECEIVABLE_FILTER,
    workspaceTab: 'collections',
    collectionTab: tabFromUrl,
  }))
  const [rows, setRows] = useState<CollectionWorklistItem[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [sortKey] = useState<WorklistSortKey>('priority')
  const [sortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const pageSize = 25
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [activityOpen, setActivityOpen] = useState(false)
  const [activityCustomer, setActivityCustomer] = useState<CollectionActivityCustomerSummary | null>(null)

  useEffect(() => {
    setFilter((f) => ({ ...f, collectionTab: tabFromUrl }))
  }, [tabFromUrl])

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
      const list = await getCollectionWorklist(filter)
      if (signal?.cancelled) return
      setRows(list)
      setLoadState(list.length === 0 ? 'empty' : 'ready')
    } catch (err) {
      if (signal?.cancelled) return
      setErrorMessage(err instanceof Error ? err.message : 'Collection worklist could not be loaded.')
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

  const sorted = useMemo(() => sortWorklistRows(rows, sortKey, sortDir), [rows, sortKey, sortDir])
  const paged = useMemo(() => sorted.slice(page * pageSize, page * pageSize + pageSize), [sorted, page])

  useEffect(() => {
    setPage(0)
  }, [filter, sortKey, sortDir])

  const setCollectionTab = (tab: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next)
    setFilter((f) => ({ ...f, collectionTab: tab }))
  }

  const openActivityForRow = async (row: CollectionWorklistItem, type?: 'Call' | 'Email' | 'Meeting' | 'Payment Promise') => {
    try {
      const outstanding = await getCustomerOutstanding({ customerId: row.customerId })
      const cust = outstanding[0]
      setActivityCustomer({
        customerId: row.customerId,
        customerName: row.customerName,
        outstanding: row.totalOutstanding,
        overdue: row.overdue,
        creditLimit: cust?.creditLimit ?? 0,
        oldestDueDate: cust?.oldestDueDate ?? null,
        collectionOwner: row.collectionOwner,
      })
      setActivityOpen(true)
      if (type === 'Email' || type === 'Meeting') {
        notify.info(`${type} activity opens in drawer. Messaging integration is not connected (demo).`)
      }
    } catch {
      notify.error('Could not load customer context.')
    }
  }

  const hasActiveFilters = filter.search || filter.priority

  if (!perms.canView || !perms.canViewCollection) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Collection Worklist"
        breadcrumbs={[
          { label: 'Accounting', to: '/accounting' },
          { label: 'Receivables', to: '/accounting/receivables' },
          { label: 'Collections' },
        ]}
        autoBreadcrumbs={false}
      >
        <ReceivableEmptyState title="Access denied" description="You cannot view the collection worklist." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Collection Worklist"
      description="Prioritize overdue accounts, follow-ups, payment promises and disputes for collection action."
      breadcrumbs={[
        { label: 'Accounting', to: '/accounting' },
        { label: 'Receivables', to: '/accounting/receivables' },
        { label: 'Collections' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/receivables/collections"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
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
      <ReceivablesWorkspaceTabs active="collections" />

      <div className="mt-3 flex flex-wrap gap-1 border-b border-erp-border">
        {COLLECTION_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn(
              'rounded-t-md px-3 py-2 text-[12px] font-semibold',
              filter.collectionTab === tab.id
                ? 'border border-b-white border-erp-border bg-white text-erp-primary'
                : 'text-erp-muted hover:text-erp-text',
            )}
            onClick={() => setCollectionTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-2 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-erp-border bg-erp-surface/40 px-3 py-2">
        <SearchInput
          value={filter.search}
          onChange={(search) => setFilter((f) => ({ ...f, search }))}
          placeholder="Customer name…"
          className="w-full max-w-xs"
          size="sm"
        />
        <label className="text-[12px] font-semibold">
          Priority
          <select
            className="erp-input mt-1 h-9 min-w-[11rem] text-[12px]"
            value={filter.priority}
            onChange={(e) => setFilter((f) => ({ ...f, priority: e.target.value as CollectionPriority | '' }))}
          >
            <option value="">Default ranking</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        {hasActiveFilters ? (
          <button
            type="button"
            className="text-[11px] font-semibold text-erp-muted hover:text-erp-text"
            onClick={() => setFilter(clearReceivableFilterFields(filter, { workspaceTab: 'collections', collectionTab: filter.collectionTab }))}
          >
            Clear Filters
          </button>
        ) : null}
      </div>

      {loadState === 'loading' ? <LoadingState variant="table" rows={10} /> : null}

      {loadState === 'error' ? (
        <ReceivableEmptyState
          title="Collection worklist could not be loaded."
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
          title={hasActiveFilters ? 'No items match the selected filters.' : 'No collection worklist items.'}
          description="Try another tab or clear filters."
          actions={(
            <button
              type="button"
              className="erp-btn erp-btn-primary h-9 px-4 text-[13px]"
              onClick={() => setFilter(clearReceivableFilterFields(filter, { workspaceTab: 'collections', collectionTab: 'all' }))}
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
              <thead className="sticky top-0 z-10 bg-erp-surface-alt text-left text-[11px] font-semibold uppercase text-erp-muted">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Priority reason</th>
                  <th className="px-3 py-2 text-right">Outstanding</th>
                  <th className="px-3 py-2 text-right">Overdue</th>
                  <th className="px-3 py-2">Last contact</th>
                  <th className="px-3 py-2">Next follow-up</th>
                  <th className="px-3 py-2">Promise</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2 w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((row) => (
                  <tr key={row.id} className="border-t border-erp-border hover:bg-erp-surface-alt/50">
                    <td className="px-3 py-2 tabular-nums font-semibold">{row.priority}</td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/accounting/receivables/customer/${row.customerId}`}
                        className="font-semibold text-erp-primary hover:underline"
                      >
                        {row.customerName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-erp-muted">{row.priorityReason}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.totalOutstanding)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-rose-700">{formatCurrency(row.overdue)}</td>
                    <td className="px-3 py-2">{row.lastContact ? formatDate(row.lastContact) : '—'}</td>
                    <td className="px-3 py-2">{row.nextFollowUp ? formatDate(row.nextFollowUp) : '—'}</td>
                    <td className="px-3 py-2">
                      {row.paymentPromise ? (
                        <span className="tabular-nums">
                          {formatDate(row.paymentPromise)}
                          {row.promiseAmount ? ` · ${formatCurrency(row.promiseAmount)}` : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <CollectionStatusBadge status={row.collectionStatus} />
                    </td>
                    <td className="px-3 py-2 text-erp-muted">{row.collectionOwner}</td>
                    <td className="relative px-2 py-2">
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-erp-surface-alt"
                          title="Log call"
                          onClick={() => void openActivityForRow(row, 'Call')}
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-erp-surface-alt"
                          title="Email"
                          onClick={() => void openActivityForRow(row, 'Email')}
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-erp-surface-alt"
                          title="WhatsApp"
                          onClick={() => notify.info('WhatsApp preview — messaging integration is not connected (demo).')}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </button>
                        <div ref={openMenuId === row.id ? menuRef : undefined} className="relative inline-block">
                          <button
                            type="button"
                            className="rounded p-1 hover:bg-erp-surface-alt"
                            aria-label="More actions"
                            onClick={() => setOpenMenuId(openMenuId === row.id ? null : row.id)}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                          {openMenuId === row.id ? (
                            <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-erp-border bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                            onClick={() => {
                              void openActivityForRow(row, 'Meeting')
                              setOpenMenuId(null)
                            }}
                          >
                            Log Meeting
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                            onClick={() => {
                              void openActivityForRow(row, 'Payment Promise')
                              setOpenMenuId(null)
                            }}
                          >
                            Payment Promise
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-[12px] hover:bg-erp-surface-alt"
                            onClick={() => {
                              navigate(`/accounting/receivables/invoices?customerId=${row.customerId}`)
                              setOpenMenuId(null)
                            }}
                          >
                            View Invoices
                          </button>
                            </div>
                          ) : null}
                        </div>
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

      <CollectionActivityDrawer
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        customerSummary={activityCustomer ?? undefined}
        onSaved={() => setRefreshToken((n) => n + 1)}
      />
    </OperationalPageShell>
  )
}
