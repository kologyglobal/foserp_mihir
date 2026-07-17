import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, FileText, Plus, RefreshCw, Save } from 'lucide-react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { SaveViewDialog } from '../../components/design-system/SaveViewDialog'
import { EnterpriseRegisterTableShell } from '../../design-system/list-page/EnterpriseRegisterTableShell'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../design-system/components/LoadingState'
import { CrmFilterDrawer } from '../../components/crm/CrmFilterDrawer'
import { CrmListSortSelect } from '../../components/crm/CrmListFilterBar'
import { PurchaseRequisitionsTable } from '../../components/purchase/PurchaseRequisitionsTable'
import { PurchaseRegisterContextPanel } from '../../components/purchase/PurchaseRegisterContextPanel'
import { useSavedViews } from '../../hooks/useSavedViews'
import { useCrmFilterDrawer } from '../../hooks/useCrmFilterDrawer'
import { PR_REGISTER_PRESETS } from '../../config/savedViewPresets'
import {
  DEFAULT_PR_LIST_FILTERS,
  PR_SORT_OPTIONS,
  buildPrFilterFields,
  crmValuesToPrFilters,
  hasActivePrFilters,
  prFilterChipLabelResolver,
  prFiltersToCrmValues,
  serializePrFilters,
  type PrListFilters,
  type PrSortKey,
} from '../../config/prFilterConfig'
import { buildPrRegisterKpiItems } from '../../utils/prKpiItems'
import {
  buildPrRegisterOverview,
  buildPrRegisterSuggestions,
} from '../../utils/prRegisterInsights'
import {
  cancelPurchaseRequisition,
  convertPurchaseRequisitionToPo,
  convertPurchaseRequisitionToRfq,
  duplicatePurchaseRequisition,
  getPurchaseRequisitionListSummary,
  getPurchaseRequisitions,
  PurchaseServiceError,
  submitPurchaseRequisition,
} from '../../services/purchase'
import type { PurchaseRequisitionListRow } from '../../types/purchaseDomain'
import { exportRowsToCsv } from '../../utils/exportCsv'
import { prListBreadcrumbs } from '../../utils/purchaseNavigation'
import { notify } from '../../store/toastStore'
import { usePurchasePermissions } from '../../utils/permissions'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

function sortPrRows(rows: PurchaseRequisitionListRow[], sortBy: PrSortKey): PurchaseRequisitionListRow[] {
  const list = [...rows]
  const cmp = (a: string | number | null | undefined, b: string | number | null | undefined) => {
    const as = a == null ? '' : String(a)
    const bs = b == null ? '' : String(b)
    return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' })
  }
  switch (sortBy) {
    case 'documentNumber':
      return list.sort((a, b) => cmp(a.documentNumber, b.documentNumber))
    case 'estimatedValue':
      return list.sort((a, b) => b.estimatedValue - a.estimatedValue)
    case 'requiredBy':
      return list.sort((a, b) => cmp(a.requiredBy ?? '9999', b.requiredBy ?? '9999'))
    case 'status':
      return list.sort((a, b) => cmp(a.statusLabel, b.statusLabel))
    case 'priority':
      return list.sort((a, b) => cmp(a.priority, b.priority))
    case 'department':
      return list.sort((a, b) => cmp(a.department, b.department))
    case 'requester':
      return list.sort((a, b) => cmp(a.requester.name, b.requester.name))
    case 'documentDate':
    default:
      return list.sort(
        (a, b) =>
          cmp(b.documentDate, a.documentDate) || cmp(b.documentNumber, a.documentNumber),
      )
  }
}

export function PurchaseRequisitionListPage() {
  const navigate = useNavigate()
  const perms = usePurchasePermissions()
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<PrListFilters>(() => ({
    ...DEFAULT_PR_LIST_FILTERS,
    status: searchParams.get('status') === 'open' ? '' : (searchParams.get('status') ?? ''),
  }))
  const [sortBy, setSortBy] = useState<PrSortKey>('documentDate')
  const [rows, setRows] = useState<PurchaseRequisitionListRow[]>([])
  const [summary, setSummary] = useState({
    total: 0,
    draft: 0,
    pendingApproval: 0,
    approved: 0,
    converted: 0,
  })
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    setErrorMessage(null)
    try {
      const [list, stats] = await Promise.all([
        getPurchaseRequisitions(),
        getPurchaseRequisitionListSummary(),
      ])
      if (signal?.cancelled) return
      setRows(list)
      setSummary(stats)
      setLoadState(list.length === 0 ? 'empty' : 'ready')
    } catch (err) {
      if (signal?.cancelled) return
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load requisitions')
      setRows([])
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, refreshToken])

  useEffect(() => {
    const status = searchParams.get('status')
    if (!status) return
    if (status === 'converted') {
      setFilters((f) => ({ ...f, status: 'converted' }))
      return
    }
    if (status === 'open') {
      setFilters((f) => ({ ...f, status: '' }))
      return
    }
    setFilters((f) => ({ ...f, status }))
  }, [searchParams])

  const applyPrFilters = useCallback((saved: Record<string, string>) => {
    setFilters({
      ...DEFAULT_PR_LIST_FILTERS,
      search: saved.search ?? '',
      status: saved.status ?? '',
      documentDateFrom: saved.documentDateFrom ?? '',
      documentDateTo: saved.documentDateTo ?? '',
      requiredByFrom: saved.requiredByFrom ?? '',
      requiredByTo: saved.requiredByTo ?? '',
      department: saved.department ?? '',
      locationId: saved.locationId ?? '',
      requesterId: saved.requesterId ?? '',
      priority: saved.priority ?? '',
      source: saved.source ?? '',
    })
    const sb = saved.sortBy as PrSortKey | undefined
    if (sb && PR_SORT_OPTIONS.some((o) => o.value === sb)) {
      setSortBy(sb)
    }
  }, [])

  const savedViews = useSavedViews({
    pageId: '/purchase/requisitions',
    filters: { ...serializePrFilters(filters), sortBy },
    onApply: applyPrFilters,
    systemPresets: PR_REGISTER_PRESETS,
  })

  const departments = useMemo(
    () => [...new Set(rows.map((r) => r.department).filter(Boolean))].sort(),
    [rows],
  )
  const locations = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) map.set(r.location.id, r.location.name)
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [rows])
  const requesters = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) map.set(r.requester.id, r.requester.name)
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [rows])

  const prFilterFields = useMemo(
    () =>
      buildPrFilterFields({
        departmentOptions: departments,
        locationOptions: locations,
        requesterOptions: requesters,
      }),
    [departments, locations, requesters],
  )

  const filterDrawer = useCrmFilterDrawer({
    values: prFiltersToCrmValues(filters),
    onChange: (next) => setFilters(crmValuesToPrFilters(next)),
    fields: prFilterFields,
    defaults: prFiltersToCrmValues(DEFAULT_PR_LIST_FILTERS),
    chipLabelResolver: (key, value) =>
      prFilterChipLabelResolver(key, value, { locations, requesters }),
  })

  const filtered = useMemo(() => {
    let list = [...rows]
    const q = filters.search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (r) =>
          r.documentNumber.toLowerCase().includes(q) ||
          r.requester.name.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q) ||
          r.location.name.toLowerCase().includes(q) ||
          r.statusLabel.toLowerCase().includes(q) ||
          r.priorityLabel.toLowerCase().includes(q) ||
          r.sourceLabel.toLowerCase().includes(q) ||
          r.lines.some(
            (l) =>
              l.itemCode.toLowerCase().includes(q) ||
              l.itemName.toLowerCase().includes(q),
          ),
      )
    }
    if (filters.status === 'converted') {
      list = list.filter((r) =>
        ['converted_to_rfq', 'converted_to_po'].includes(r.status),
      )
    } else if (filters.status === 'pending_po') {
      list = list.filter((r) => r.status === 'approved' && !r.rfqRequired && !r.convertedPoId)
    } else if (filters.status === 'pending_rfq') {
      list = list.filter((r) => r.status === 'approved' && r.rfqRequired && !r.convertedRfqId)
    } else if (filters.status) {
      list = list.filter((r) => r.status === filters.status)
    }
    if (filters.documentDateFrom) {
      list = list.filter((r) => r.documentDate >= filters.documentDateFrom)
    }
    if (filters.documentDateTo) {
      list = list.filter((r) => r.documentDate <= filters.documentDateTo)
    }
    if (filters.requiredByFrom) {
      list = list.filter((r) => (r.requiredBy ?? '') >= filters.requiredByFrom)
    }
    if (filters.requiredByTo) {
      list = list.filter((r) => (r.requiredBy ?? '') <= filters.requiredByTo)
    }
    if (filters.department) list = list.filter((r) => r.department === filters.department)
    if (filters.locationId) list = list.filter((r) => r.location.id === filters.locationId)
    if (filters.requesterId) list = list.filter((r) => r.requester.id === filters.requesterId)
    if (filters.priority) list = list.filter((r) => r.priority === filters.priority)
    if (filters.source) list = list.filter((r) => r.source === filters.source)
    return sortPrRows(list, sortBy)
  }, [rows, filters, sortBy])

  const prKpiStrip = useMemo(
    () =>
      buildPrRegisterKpiItems(rows, summary, filters.status, (status) =>
        setFilters((f) => ({ ...f, status })),
      ),
    [rows, summary, filters.status],
  )

  const applyStatusFilter = useCallback((status: string) => {
    setFilters((f) => ({ ...f, status }))
  }, [])

  const registerOverview = useMemo(() => buildPrRegisterOverview(filtered), [filtered])
  const registerSuggestions = useMemo(
    () =>
      buildPrRegisterSuggestions({
        rows: filtered,
        activeStatus: filters.status,
        canCreate: perms.canCreateRequisition,
        onApplyStatus: applyStatusFilter,
        onReviewOverdue: () => {
          setSortBy('requiredBy')
          setFilters((f) => ({ ...f, status: '' }))
        },
        onCreate: () => navigate('/purchase/requisitions/new'),
        onOpenSetup: () => navigate('/purchase/setup'),
      }),
    [filtered, filters.status, perms.canCreateRequisition, applyStatusFilter, navigate],
  )

  const runAction = async (id: string, work: () => Promise<unknown>, success: string) => {
    setBusyId(id)
    try {
      await work()
      notify.success(success)
      setRefreshToken((n) => n + 1)
    } catch (err) {
      const message =
        err instanceof PurchaseServiceError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Action failed'
      notify.error(message)
    } finally {
      setBusyId(null)
    }
  }

  const rowHandlers = useMemo(
    () => ({
      onView: (pr: PurchaseRequisitionListRow) => navigate(`/purchase/requisitions/${pr.id}`),
      onEdit: (pr: PurchaseRequisitionListRow) => navigate(`/purchase/requisitions/${pr.id}/edit`),
      onDuplicate: (pr: PurchaseRequisitionListRow) =>
        void runAction(
          pr.id,
          () => duplicatePurchaseRequisition(pr.id),
          `Duplicated ${pr.documentNumber}`,
        ),
      onSubmit: (pr: PurchaseRequisitionListRow) =>
        void runAction(
          pr.id,
          () => submitPurchaseRequisition(pr.id),
          `${pr.documentNumber} submitted for approval`,
        ),
      onConvertRfq: (pr: PurchaseRequisitionListRow) =>
        void runAction(pr.id, async () => {
          const rfq = await convertPurchaseRequisitionToRfq(pr.id)
          navigate(`/purchase/rfqs/${rfq.id}`)
        }, `${pr.documentNumber} converted to RFQ`),
      onConvertPo: (pr: PurchaseRequisitionListRow) =>
        void runAction(pr.id, async () => {
          const po = await convertPurchaseRequisitionToPo(pr.id)
          navigate(`/purchase/orders/${po.id}`)
        }, `${pr.documentNumber} converted to PO`),
      onPrint: (pr: PurchaseRequisitionListRow) => {
        navigate(`/purchase/requisitions/${pr.id}?print=1`)
        notify.info('Open print dialog from the requisition detail (Ctrl+P)')
      },
      onCancel: (pr: PurchaseRequisitionListRow) =>
        void runAction(
          pr.id,
          () => cancelPurchaseRequisition(pr.id, 'Cancelled from list'),
          `${pr.documentNumber} cancelled`,
        ),
    }),
    [navigate],
  )

  const exportList = () => {
    exportRowsToCsv(
      'purchase-requisitions',
      [
        'PR Number',
        'PR Date',
        'Department',
        'Location',
        'Requested By',
        'Required By',
        'Item Count',
        'Estimated Value',
        'Priority',
        'Source',
        'Approval Status',
        'Status',
        'Linked RFQ',
        'Linked PO',
      ],
      filtered.map((r) => [
        r.documentNumber,
        r.documentDate,
        r.department,
        r.location.name,
        r.requester.name,
        r.requiredBy,
        r.itemCount,
        r.estimatedValue,
        r.priorityLabel,
        r.sourceLabel,
        r.approvalStatusLabel,
        r.statusLabel,
        r.convertedRfqNumber,
        r.convertedPoNumber,
      ]),
    )
    notify.success(`Exported ${filtered.length} requisition(s)`)
  }

  const clearFilters = () => {
    filterDrawer.clearAll()
  }

  const shellBreadcrumbs = prListBreadcrumbs()
  const activeFilters = hasActivePrFilters(filters)

  if (loadState === 'loading' && rows.length === 0) {
    return (
      <OperationalPageShell
        title="Purchase Requisitions"
        description="Manual and MRP-driven material demand awaiting review and conversion"
        badge="Purchase"
        variant="dynamics"
        breadcrumbs={shellBreadcrumbs}
        favoritePath="/purchase/requisitions"
      >
        <LoadingState variant="table" rows={8} />
      </OperationalPageShell>
    )
  }

  if (loadState === 'error') {
    return (
      <OperationalPageShell
        title="Purchase Requisitions"
        description="Manual and MRP-driven material demand awaiting review and conversion"
        badge="Purchase"
        variant="dynamics"
        breadcrumbs={shellBreadcrumbs}
        favoritePath="/purchase/requisitions"
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
          icon={FileText}
          title="Could not load requisitions"
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
        title="Purchase Requisitions"
        description="Manual and MRP-driven material demand awaiting review and conversion"
        badge="Purchase"
        variant="dynamics"
        breadcrumbs={shellBreadcrumbs}
        favoritePath="/purchase/requisitions"
        commandBar={
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={
              perms.canCreateRequisition
                ? {
                    id: 'create',
                    label: 'Create Requisition',
                    icon: Plus,
                    onClick: () => navigate('/purchase/requisitions/new'),
                  }
                : undefined
            }
            secondaryActions={[
              {
                id: 'export',
                label: 'Export',
                icon: Download,
                onClick: exportList,
              },
              {
                id: 'refresh',
                label: 'Refresh',
                icon: RefreshCw,
                onClick: () => {
                  setRefreshToken((n) => n + 1)
                  notify.info('Requisitions refreshed')
                },
              },
            ]}
            moreActions={[
              { id: 'save-view', label: 'Save View', icon: Save, onClick: savedViews.openSaveDialog },
            ]}
          />
        }
        kpiStrip={prKpiStrip}
      >
        <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
          <EnterpriseRegisterTableShell className="min-w-0">
            <PurchaseRequisitionsTable
              rows={filtered}
              busyId={busyId}
              handlers={rowHandlers}
              hasActiveFilters={activeFilters}
              onClearFilters={clearFilters}
              onExport={exportList}
              registerFilter={{
                search: filters.search,
                onSearchChange: (search) => setFilters((f) => ({ ...f, search })),
                searchPlaceholder: 'Search PR number, item, requester, department…',
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
                    onChange={(v) => setSortBy(v as PrSortKey)}
                    aria-label="Sort purchase requisitions"
                    options={PR_SORT_OPTIONS}
                  />
                ),
              }}
              emptyAction={
                filtered.length === 0 ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    {rows.length === 0 && perms.canCreateRequisition ? (
                      <button
                        type="button"
                        className="erp-btn erp-btn--primary text-[13px]"
                        onClick={() => navigate('/purchase/requisitions/new')}
                      >
                        Create Requisition
                      </button>
                    ) : null}
                    {activeFilters ? (
                      <button
                        type="button"
                        className="erp-btn erp-btn--secondary text-[13px]"
                        onClick={clearFilters}
                      >
                        Clear Filters
                      </button>
                    ) : null}
                  </div>
                ) : undefined
              }
            />
          </EnterpriseRegisterTableShell>
          <PurchaseRegisterContextPanel
            ariaLabel="Purchase requisition overview and suggestions"
            title="Requisition Insights"
            subtitle="AI suggested bottlenecks and next actions for this register."
            overview={registerOverview}
            suggestions={registerSuggestions}
          />
        </div>
      </OperationalPageShell>

      <CrmFilterDrawer
        open={filterDrawer.open}
        onClose={filterDrawer.closeDrawer}
        fields={prFilterFields}
        values={filterDrawer.draft}
        onChange={(next) => filterDrawer.setDraft({ ...filterDrawer.draft, ...next })}
        onApply={filterDrawer.applyFilters}
        onReset={filterDrawer.resetDraft}
      />
      <SaveViewDialog
        open={savedViews.saveDialogOpen}
        defaultName={savedViews.activeView === 'My View' ? '' : savedViews.activeView}
        onClose={savedViews.closeSaveDialog}
        onSave={savedViews.saveCurrentView}
      />
    </>
  )
}
