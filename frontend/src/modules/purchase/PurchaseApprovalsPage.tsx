import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Settings2, ShieldCheck } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { CrmFilterDrawer } from '@/components/crm/CrmFilterDrawer'
import { CrmListSortSelect } from '@/components/crm/CrmListFilterBar'
import { PurchaseApprovalsTable } from '@/components/purchase/PurchaseApprovalsTable'
import { PurchaseRegisterContextPanel } from '@/components/purchase/PurchaseRegisterContextPanel'
import { useCrmFilterDrawer } from '@/hooks/useCrmFilterDrawer'
import { PurchaseApprovalReviewDrawer } from './PurchaseApprovalReviewDrawer'
import {
  DEFAULT_APPROVAL_LIST_FILTERS,
  APPROVAL_SORT_OPTIONS,
  approvalFilterChipLabelResolver,
  approvalFiltersToCrmValues,
  buildApprovalFilterFields,
  crmValuesToApprovalFilters,
  filterApprovalRows,
  hasActiveApprovalFilters,
  sortApprovalRows,
  type ApprovalListFilters,
  type ApprovalSortKey,
} from '@/config/approvalFilterConfig'
import {
  buildApprovalRegisterKpiItems,
  summarizeApprovalKpis,
} from '@/utils/approvalKpiItems'
import {
  buildApprovalRegisterOverview,
  buildApprovalRegisterSuggestions,
} from '@/utils/approvalRegisterInsights'
import {
  approvePurchaseDocument,
  delegatePurchaseApproval,
  getPurchaseApprovalQueue,
  PURCHASE_APPROVAL_QUEUE_TAB_LABELS,
  PurchaseServiceError,
  rejectPurchaseDocument,
  sendBackPurchaseDocument,
} from '@/services/purchase'
import type {
  PurchaseApprovalQueueRow,
  PurchaseApprovalQueueTab,
} from '@/types/purchaseDomain'
import { approvalsListBreadcrumbs } from '@/utils/purchaseNavigation'
import { notify } from '@/store/toastStore'
import { systemPrompt } from '@/utils/systemConfirm'
import { cn } from '@/utils/cn'

const TABS: PurchaseApprovalQueueTab[] = [
  'pending_mine',
  'approved_by_me',
  'rejected_by_me',
  'all_history',
]

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

export function PurchaseApprovalsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<PurchaseApprovalQueueTab>('pending_mine')
  const [filters, setFilters] = useState<ApprovalListFilters>(DEFAULT_APPROVAL_LIST_FILTERS)
  const [sortBy, setSortBy] = useState<ApprovalSortKey>('submittedDate')
  const [rows, setRows] = useState<PurchaseApprovalQueueRow[]>([])
  const [pendingRows, setPendingRows] = useState<PurchaseApprovalQueueRow[]>([])
  const [approvedRows, setApprovedRows] = useState<PurchaseApprovalQueueRow[]>([])
  const [rejectedRows, setRejectedRows] = useState<PurchaseApprovalQueueRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [drawerMode, setDrawerMode] = useState<'review' | 'history'>('review')

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    setErrorMessage(null)
    try {
      const [tabRows, pending, approved, rejected] = await Promise.all([
        getPurchaseApprovalQueue(tab),
        getPurchaseApprovalQueue('pending_mine'),
        getPurchaseApprovalQueue('approved_by_me'),
        getPurchaseApprovalQueue('rejected_by_me'),
      ])
      if (signal?.cancelled) return
      setRows(tabRows)
      setPendingRows(pending)
      setApprovedRows(approved)
      setRejectedRows(rejected)
      setLoadState(tabRows.length === 0 ? 'empty' : 'ready')
    } catch (err) {
      if (signal?.cancelled) return
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load approvals')
      setRows([])
      setPendingRows([])
      setApprovedRows([])
      setRejectedRows([])
      setLoadState('error')
    }
  }, [tab])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, refreshToken])

  const departments = useMemo(
    () => [...new Set(rows.map((r) => r.department).filter(Boolean))].sort(),
    [rows],
  )
  const locations = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) map.set(r.locationId, r.locationName)
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [rows])

  const approvalFilterFields = useMemo(
    () =>
      buildApprovalFilterFields({
        departmentOptions: departments,
        locationOptions: locations,
      }),
    [departments, locations],
  )

  const filterDrawer = useCrmFilterDrawer({
    values: approvalFiltersToCrmValues(filters),
    onChange: (next) => setFilters(crmValuesToApprovalFilters(next)),
    fields: approvalFilterFields,
    defaults: approvalFiltersToCrmValues(DEFAULT_APPROVAL_LIST_FILTERS),
    chipLabelResolver: (key, value) =>
      approvalFilterChipLabelResolver(key, value, { locations }),
  })

  const filtered = useMemo(
    () => sortApprovalRows(filterApprovalRows(rows, filters), sortBy),
    [rows, filters, sortBy],
  )

  const kpiSummary = useMemo(
    () =>
      summarizeApprovalKpis({
        pending: pendingRows,
        approved: approvedRows,
        rejected: rejectedRows,
      }),
    [pendingRows, approvedRows, rejectedRows],
  )

  const applyKpiSelection = useCallback(
    (next: { tab: PurchaseApprovalQueueTab; ageing?: string }) => {
      setTab(next.tab)
      if (next.ageing !== undefined) {
        setFilters((f) => ({ ...f, ageing: next.ageing ?? '' }))
      } else if (next.tab !== 'pending_mine') {
        setFilters((f) => ({ ...f, ageing: '' }))
      }
    },
    [],
  )

  const kpiStrip = useMemo(
    () =>
      buildApprovalRegisterKpiItems(
        pendingRows,
        kpiSummary,
        tab,
        filters.ageing,
        applyKpiSelection,
      ),
    [pendingRows, kpiSummary, tab, filters.ageing, applyKpiSelection],
  )

  const registerOverview = useMemo(() => buildApprovalRegisterOverview(filtered), [filtered])
  const registerSuggestions = useMemo(
    () =>
      buildApprovalRegisterSuggestions({
        rows: filtered,
        activeTab: tab,
        activeAgeing: filters.ageing,
        onSelectTab: (next) => {
          setTab(next)
          setFilters((f) => ({ ...f, ageing: '' }))
        },
        onShowOverdue: () => applyKpiSelection({ tab: 'pending_mine', ageing: 'overdue' }),
        onShowHistory: () => {
          setTab('all_history')
          setFilters((f) => ({ ...f, ageing: '' }))
        },
        onOpenSetup: () => navigate('/purchase/setup'),
      }),
    [filtered, tab, filters.ageing, applyKpiSelection, navigate],
  )

  const openReview = (id: string, mode: 'review' | 'history' = 'review') => {
    setDrawerMode(mode)
    setReviewId(id)
  }

  const runQuickAction = useCallback(
    async (
      row: PurchaseApprovalQueueRow,
      kind: 'approve' | 'reject' | 'send_back' | 'delegate',
    ) => {
      try {
        if (kind === 'reject') {
          const remarks = await systemPrompt({
            title: 'Reject document',
            description: `Reject ${row.documentNumber}? Comments are required and will be shared with the requester.`,
            fieldLabel: 'Rejection comments',
            placeholder: 'Explain why this request is being rejected…',
            confirmLabel: 'Reject',
            cancelLabel: 'Cancel',
            variant: 'danger',
            required: true,
          })
          if (remarks == null) return
          setBusyId(row.approvalId)
          await rejectPurchaseDocument(row.documentType, row.documentId, remarks)
          notify.success(`${row.documentNumber} rejected`)
        } else if (kind === 'send_back') {
          const remarks = await systemPrompt({
            title: 'Send back for correction',
            description: `Return ${row.documentNumber} to the requester. Comments are mandatory so they know what to fix.`,
            fieldLabel: 'Send-back comments',
            placeholder: 'Describe what needs to be corrected…',
            confirmLabel: 'Send Back',
            cancelLabel: 'Cancel',
            required: true,
          })
          if (remarks == null) return
          setBusyId(row.approvalId)
          await sendBackPurchaseDocument(row.documentType, row.documentId, remarks)
          notify.success(`${row.documentNumber} sent back`)
        } else {
          setBusyId(row.approvalId)
          if (kind === 'approve') {
            await approvePurchaseDocument(row.documentType, row.documentId, 'Approved')
            notify.success(`${row.documentNumber} approved`)
          } else {
            await delegatePurchaseApproval(row.approvalId, 'finance_head', 'Delegated to Finance Head')
            notify.success(`${row.documentNumber} delegated`)
          }
        }
        setRefreshToken((n) => n + 1)
      } catch (err) {
        notify.error(err instanceof PurchaseServiceError ? err.message : 'Action failed')
      } finally {
        setBusyId(null)
      }
    },
    [],
  )

  const rowHandlers = useMemo(
    () => ({
      onReview: (row: PurchaseApprovalQueueRow) => openReview(row.approvalId, 'review'),
      onHistory: (row: PurchaseApprovalQueueRow) => openReview(row.approvalId, 'history'),
      onApprove: (row: PurchaseApprovalQueueRow) => void runQuickAction(row, 'approve'),
      onReject: (row: PurchaseApprovalQueueRow) => void runQuickAction(row, 'reject'),
      onSendBack: (row: PurchaseApprovalQueueRow) => void runQuickAction(row, 'send_back'),
      onDelegate: (row: PurchaseApprovalQueueRow) => void runQuickAction(row, 'delegate'),
    }),
    [runQuickAction],
  )

  const clearFilters = () => {
    filterDrawer.clearAll()
  }

  const activeFilters = hasActiveApprovalFilters(filters)
  const shellBreadcrumbs = approvalsListBreadcrumbs()

  const tabStrip = (
    <div className="mb-3 flex flex-wrap gap-1.5 border-b border-erp-border pb-2.5">
      {TABS.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => {
            setTab(t)
            if (t !== 'pending_mine') {
              setFilters((f) => ({ ...f, ageing: '' }))
            }
          }}
          className={cn(
            'rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors',
            tab === t
              ? 'bg-erp-primary text-white'
              : 'bg-erp-surface-alt text-erp-text hover:bg-erp-primary-soft',
          )}
        >
          {PURCHASE_APPROVAL_QUEUE_TAB_LABELS[t]}
          {t === 'pending_mine' && kpiSummary.pending > 0 ? (
            <span
              className={cn(
                'ml-1.5 inline-flex min-w-[1.15rem] justify-center rounded-full px-1 text-[11px] tabular-nums',
                tab === t ? 'bg-white/20' : 'bg-erp-warning-soft text-erp-warning-fg',
              )}
            >
              {kpiSummary.pending}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )

  if (loadState === 'loading' && rows.length === 0) {
    return (
      <OperationalPageShell
        title="Purchase Approvals"
        description="Requisitions and purchase orders awaiting approval — matrix driven by Purchase Setup"
        badge="Purchase"
        variant="dynamics"
        breadcrumbs={shellBreadcrumbs}
        favoritePath="/purchase/approvals"
      >
        <LoadingState variant="table" rows={8} />
      </OperationalPageShell>
    )
  }

  if (loadState === 'error') {
    return (
      <OperationalPageShell
        title="Purchase Approvals"
        description="Requisitions and purchase orders awaiting approval — matrix driven by Purchase Setup"
        badge="Purchase"
        variant="dynamics"
        breadcrumbs={shellBreadcrumbs}
        favoritePath="/purchase/approvals"
        commandBar={
          <ErpCommandBar
            inline
            sticky={false}
            secondaryActions={[
              {
                id: 'retry',
                label: 'Retry',
                icon: RefreshCw,
                onClick: () => setRefreshToken((n) => n + 1),
              },
            ]}
          />
        }
      >
        <EmptyState
          icon={ShieldCheck}
          title="Could not load approvals"
          description={errorMessage ?? 'Unknown error'}
          action={
            <button
              type="button"
              className="erp-btn erp-btn--primary text-[13px]"
              onClick={() => setRefreshToken((n) => n + 1)}
            >
              Retry
            </button>
          }
        />
      </OperationalPageShell>
    )
  }

  return (
    <>
      <OperationalPageShell
        title="Purchase Approvals"
        description="Requisitions and purchase orders awaiting approval — matrix driven by Purchase Setup"
        badge="Purchase"
        variant="dynamics"
        breadcrumbs={shellBreadcrumbs}
        favoritePath="/purchase/approvals"
        commandBar={
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={{
              id: 'pending',
              label: 'Pending Queue',
              icon: ShieldCheck,
              onClick: () => applyKpiSelection({ tab: 'pending_mine', ageing: '' }),
            }}
            secondaryActions={[
              {
                id: 'refresh',
                label: 'Refresh',
                icon: RefreshCw,
                onClick: () => {
                  setRefreshToken((n) => n + 1)
                  notify.info('Approvals refreshed')
                },
              },
              {
                id: 'setup',
                label: 'Purchase Setup',
                icon: Settings2,
                onClick: () => navigate('/purchase/setup'),
              },
            ]}
          />
        }
        kpiStrip={kpiStrip}
      >
        {tabStrip}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto]">
          <EnterpriseRegisterTableShell className="min-w-0">
            <PurchaseApprovalsTable
              rows={filtered}
              busyId={busyId}
              handlers={rowHandlers}
              hasActiveFilters={activeFilters}
              onClearFilters={clearFilters}
              registerFilter={{
                search: filters.search,
                onSearchChange: (search) => setFilters((f) => ({ ...f, search })),
                searchPlaceholder: 'Search document, requester, department…',
                activeFilterCount: filterDrawer.activeCount,
                onOpenFilters: filterDrawer.openDrawer,
                chips: filterDrawer.chips,
                onRemoveChip: filterDrawer.removeChip,
                onClearAll: clearFilters,
                resultCount: filtered.length,
                sort: (
                  <CrmListSortSelect
                    value={sortBy}
                    onChange={(v) => setSortBy(v as ApprovalSortKey)}
                    aria-label="Sort approvals"
                    options={APPROVAL_SORT_OPTIONS}
                  />
                ),
              }}
              emptyAction={
                filtered.length === 0 ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    {activeFilters ? (
                      <button
                        type="button"
                        className="erp-btn erp-btn--secondary text-[13px]"
                        onClick={clearFilters}
                      >
                        Clear Filters
                      </button>
                    ) : null}
                    {tab !== 'pending_mine' ? (
                      <button
                        type="button"
                        className="erp-btn erp-btn--primary text-[13px]"
                        onClick={() => applyKpiSelection({ tab: 'pending_mine', ageing: '' })}
                      >
                        Go to Pending Queue
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="erp-btn erp-btn--secondary text-[13px]"
                        onClick={() => navigate('/purchase/setup')}
                      >
                        Open Purchase Setup
                      </button>
                    )}
                  </div>
                ) : undefined
              }
            />
          </EnterpriseRegisterTableShell>
          <PurchaseRegisterContextPanel
            ariaLabel="Approval queue overview and suggestions"
            title="Approval Insights"
            subtitle="AI suggested bottlenecks and next actions for this queue."
            overview={registerOverview}
            suggestions={registerSuggestions}
          />
        </div>
      </OperationalPageShell>

      <CrmFilterDrawer
        open={filterDrawer.open}
        onClose={filterDrawer.closeDrawer}
        fields={approvalFilterFields}
        values={filterDrawer.draft}
        onChange={(next) => filterDrawer.setDraft({ ...filterDrawer.draft, ...next })}
        onApply={filterDrawer.applyFilters}
        onReset={filterDrawer.resetDraft}
      />

      <PurchaseApprovalReviewDrawer
        open={Boolean(reviewId)}
        approvalId={reviewId}
        mode={drawerMode}
        onClose={() => setReviewId(null)}
        onChanged={() => setRefreshToken((n) => n + 1)}
      />
    </>
  )
}
