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
  resolveApprovalQueueTab,
  sortApprovalRows,
  type ApprovalListFilters,
  type ApprovalSortKey,
} from '@/config/approvalFilterConfig'
import {
  buildApprovalRegisterOverview,
  buildApprovalRegisterSuggestions,
} from '@/utils/approvalRegisterInsights'
import {
  approvePurchaseDocument,
  delegatePurchaseApproval,
  getPurchaseApprovalQueue,
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
import { appConfirm, appPromptNote } from '@/store/confirmDialogStore'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

export function PurchaseApprovalsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<ApprovalListFilters>(DEFAULT_APPROVAL_LIST_FILTERS)
  const [sortBy, setSortBy] = useState<ApprovalSortKey>('submittedDate')
  const [rows, setRows] = useState<PurchaseApprovalQueueRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [drawerMode, setDrawerMode] = useState<'review' | 'history'>('review')

  const tab = resolveApprovalQueueTab(filters.queue)

  const setQueueTab = useCallback((next: PurchaseApprovalQueueTab, ageing?: string) => {
    setFilters((f) => ({
      ...f,
      queue: next === 'pending_mine' ? '' : next,
      ageing: ageing !== undefined ? ageing : next === 'pending_mine' ? f.ageing : '',
    }))
  }, [])

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    setErrorMessage(null)
    try {
      const tabRows = await getPurchaseApprovalQueue(tab)
      if (signal?.cancelled) return
      setRows(tabRows)
      setLoadState(tabRows.length === 0 ? 'empty' : 'ready')
    } catch (err) {
      if (signal?.cancelled) return
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load approvals')
      setRows([])
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

  const registerOverview = useMemo(() => buildApprovalRegisterOverview(filtered), [filtered])
  const registerSuggestions = useMemo(
    () =>
      buildApprovalRegisterSuggestions({
        rows: filtered,
        activeTab: tab,
        activeAgeing: filters.ageing,
        onSelectTab: (next) => setQueueTab(next),
        onShowOverdue: () => setQueueTab('pending_mine', 'overdue'),
        onShowHistory: () => setQueueTab('all_history'),
        onOpenSetup: () => navigate('/purchase/setup'),
      }),
    [filtered, tab, filters.ageing, navigate, setQueueTab],
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
        if (kind === 'approve') {
          const ok = await appConfirm({
            title: 'Approve document?',
            description: 'This will move the document to the next approval / release step.',
            detail: row.documentNumber,
            tone: 'success',
            confirmLabel: 'Approve',
          })
          if (!ok) return
          setBusyId(row.approvalId)
          await approvePurchaseDocument(row.documentType, row.documentId, 'Approved')
          notify.success(`${row.documentNumber} approved`)
        } else if (kind === 'reject') {
          const remarks = await appPromptNote({
            title: 'Reject document?',
            description: 'The requester will be notified. Comments are required for the audit trail.',
            detail: row.documentNumber,
            tone: 'danger',
            confirmLabel: 'Reject',
            note: {
              required: true,
              label: 'Rejection comments',
              placeholder: 'Explain why this document is being rejected…',
            },
          })
          if (remarks == null) return
          setBusyId(row.approvalId)
          await rejectPurchaseDocument(row.documentType, row.documentId, remarks)
          notify.success(`${row.documentNumber} rejected`)
        } else if (kind === 'send_back') {
          const remarks = await appPromptNote({
            title: 'Send back for revision?',
            description: 'The document returns to the previous step. Comments are required.',
            detail: row.documentNumber,
            tone: 'warning',
            confirmLabel: 'Send back',
            note: {
              required: true,
              label: 'Send-back comments',
              placeholder: 'What should the requester change before resubmitting…',
            },
          })
          if (remarks == null) return
          setBusyId(row.approvalId)
          await sendBackPurchaseDocument(row.documentType, row.documentId, remarks)
          notify.success(`${row.documentNumber} sent back`)
        } else {
          setBusyId(row.approvalId)
          await delegatePurchaseApproval(row.approvalId, 'finance_head', 'Delegated to Finance Head')
          notify.success(`${row.documentNumber} delegated`)
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
        <LoadingState variant="table" rows={8} cols={8} />
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
              id: 'refresh',
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => {
                setRefreshToken((n) => n + 1)
                notify.info('Approvals refreshed')
              },
            }}
            secondaryActions={[
              {
                id: 'setup',
                label: 'Purchase Setup',
                icon: Settings2,
                onClick: () => navigate('/purchase/setup'),
              },
            ]}
          />
        }
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
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
                showCommandPaletteHint: false,
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
                        onClick={() => setQueueTab('pending_mine', '')}
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
