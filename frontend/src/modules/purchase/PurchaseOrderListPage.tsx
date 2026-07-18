import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, FileText, Plus, RefreshCw, Save } from 'lucide-react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { ErpPageGuide } from '../../components/erp/ErpPageGuide'
import { SaveViewDialog } from '../../components/design-system/SaveViewDialog'
import { EnterpriseRegisterTableShell } from '../../design-system/list-page/EnterpriseRegisterTableShell'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../design-system/components/LoadingState'
import { CrmFilterDrawer } from '../../components/crm/CrmFilterDrawer'
import { CrmListSortSelect } from '../../components/crm/CrmListFilterBar'
import { PurchaseOrdersTable } from '../../components/purchase/PurchaseOrdersTable'
import { PurchaseRegisterContextPanel } from '../../components/purchase/PurchaseRegisterContextPanel'
import { useSavedViews } from '../../hooks/useSavedViews'
import { useCrmFilterDrawer } from '../../hooks/useCrmFilterDrawer'
import { PO_REGISTER_PRESETS } from '../../config/savedViewPresets'
import {
  DEFAULT_PO_LIST_FILTERS,
  PO_SORT_OPTIONS,
  buildPoFilterFields,
  crmValuesToPoFilters,
  hasActivePoFilters,
  poFilterChipLabelResolver,
  poFiltersToCrmValues,
  serializePoFilters,
  type PoListFilters,
  type PoSortKey,
} from '../../config/poFilterConfig'
import { PO_RELEASED_OR_LATER_STATUSES } from '../../utils/poKpiItems'
import {
  buildPoRegisterOverview,
  buildPoRegisterSuggestions,
} from '../../utils/poRegisterInsights'
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  getPurchaseOrderList,
  PurchaseServiceError,
  releasePurchaseOrder,
  submitPurchaseOrder,
} from '../../services/purchase'
import type { PurchaseOrderListRow } from '../../types/purchaseDomain'
import { exportRowsToCsv } from '../../utils/exportCsv'
import { poListBreadcrumbs } from '../../utils/purchaseNavigation'
import { notify } from '../../store/toastStore'
import { usePurchasePermissions } from '../../utils/permissions'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function isPoOverdue(row: PurchaseOrderListRow, today = todayIsoDate()) {
  if (['closed', 'cancelled', 'fully_received', 'invoiced'].includes(row.status)) return false
  if (!['released', 'partially_received', 'approved'].includes(row.status)) return false
  return row.expectedDeliveryDate < today
}

function isPendingDelivery(row: PurchaseOrderListRow) {
  return row.status === 'released' || row.status === 'partially_received'
}

function sortPoRows(rows: PurchaseOrderListRow[], sortBy: PoSortKey): PurchaseOrderListRow[] {
  const list = [...rows]
  const cmp = (a: string | number | null | undefined, b: string | number | null | undefined) => {
    const as = a == null ? '' : String(a)
    const bs = b == null ? '' : String(b)
    return as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' })
  }
  switch (sortBy) {
    case 'documentNumber':
      return list.sort((a, b) => cmp(a.documentNumber, b.documentNumber))
    case 'vendorName':
      return list.sort((a, b) => cmp(a.vendorName, b.vendorName))
    case 'totalAmount':
      return list.sort((a, b) => b.totalAmount - a.totalAmount)
    case 'expectedDeliveryDate':
      return list.sort((a, b) => cmp(a.expectedDeliveryDate, b.expectedDeliveryDate))
    case 'status':
      return list.sort((a, b) => cmp(a.statusLabel, b.statusLabel))
    case 'approvalStatus':
      return list.sort((a, b) => cmp(a.approvalStatusLabel, b.approvalStatusLabel))
    case 'receivedPercentage':
      return list.sort((a, b) => b.receivedPercentage - a.receivedPercentage)
    case 'documentDate':
    default:
      return list.sort(
        (a, b) =>
          cmp(b.documentDate, a.documentDate) || cmp(b.documentNumber, a.documentNumber),
      )
  }
}

export function PurchaseOrderListPage() {
  const navigate = useNavigate()
  const perms = usePurchasePermissions()
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<PoListFilters>(() => ({
    ...DEFAULT_PO_LIST_FILTERS,
    status: searchParams.get('status') ?? '',
  }))
  const [sortBy, setSortBy] = useState<PoSortKey>('documentDate')
  const [rows, setRows] = useState<PurchaseOrderListRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    setErrorMessage(null)
    try {
      const list = await getPurchaseOrderList()
      if (signal?.cancelled) return
      setRows(list)
      setLoadState(list.length === 0 ? 'empty' : 'ready')
    } catch (err) {
      if (signal?.cancelled) return
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load purchase orders')
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
    setFilters((f) => ({ ...f, status }))
  }, [searchParams])

  const applyPoFilters = useCallback((saved: Record<string, string>) => {
    setFilters({
      ...DEFAULT_PO_LIST_FILTERS,
      search: saved.search ?? '',
      status: saved.status ?? '',
      vendorName: saved.vendorName ?? '',
      locationName: saved.locationName ?? '',
      buyerName: saved.buyerName ?? '',
      approvalStatus: saved.approvalStatus ?? '',
      invoiceStatus: saved.invoiceStatus ?? '',
      origin: saved.origin ?? '',
      documentDateFrom: saved.documentDateFrom ?? '',
      documentDateTo: saved.documentDateTo ?? '',
      expectedDeliveryFrom: saved.expectedDeliveryFrom ?? '',
      expectedDeliveryTo: saved.expectedDeliveryTo ?? '',
    })
    const sb = saved.sortBy as PoSortKey | undefined
    if (sb && PO_SORT_OPTIONS.some((o) => o.value === sb)) {
      setSortBy(sb)
    }
  }, [])

  const savedViews = useSavedViews({
    pageId: '/purchase/orders',
    filters: { ...serializePoFilters(filters), sortBy },
    onApply: applyPoFilters,
    systemPresets: PO_REGISTER_PRESETS,
  })

  const vendorNames = useMemo(
    () => [...new Set(rows.map((r) => r.vendorName).filter(Boolean))].sort(),
    [rows],
  )
  const locationNames = useMemo(
    () => [...new Set(rows.map((r) => r.locationName).filter(Boolean))].sort(),
    [rows],
  )
  const buyerNames = useMemo(
    () => [...new Set(rows.map((r) => r.buyerName).filter(Boolean))].sort(),
    [rows],
  )

  const poFilterFields = useMemo(
    () =>
      buildPoFilterFields({
        vendorOptions: vendorNames,
        locationOptions: locationNames,
        buyerOptions: buyerNames,
      }),
    [vendorNames, locationNames, buyerNames],
  )

  const filterDrawer = useCrmFilterDrawer({
    values: poFiltersToCrmValues(filters),
    onChange: (next) => setFilters(crmValuesToPoFilters(next)),
    fields: poFilterFields,
    defaults: poFiltersToCrmValues(DEFAULT_PO_LIST_FILTERS),
    chipLabelResolver: (key, value) => poFilterChipLabelResolver(key, value),
  })

  const filtered = useMemo(() => {
    let list = [...rows]
    const q = filters.search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (r) =>
          r.documentNumber.toLowerCase().includes(q) ||
          r.vendorName.toLowerCase().includes(q) ||
          r.vendorGstin.toLowerCase().includes(q) ||
          r.buyerName.toLowerCase().includes(q) ||
          r.locationName.toLowerCase().includes(q) ||
          r.statusLabel.toLowerCase().includes(q) ||
          r.approvalStatusLabel.toLowerCase().includes(q),
      )
    }
    if (filters.status === 'released_or_later') {
      list = list.filter((r) =>
        (PO_RELEASED_OR_LATER_STATUSES as readonly string[]).includes(r.status),
      )
    } else if (filters.status === 'overdue') {
      const today = todayIsoDate()
      list = list.filter((r) => isPoOverdue(r, today))
    } else if (filters.status === 'pending_delivery') {
      list = list.filter(isPendingDelivery)
    } else if (filters.status) {
      list = list.filter((r) => r.status === filters.status)
    }
    if (filters.vendorName) list = list.filter((r) => r.vendorName === filters.vendorName)
    if (filters.locationName) list = list.filter((r) => r.locationName === filters.locationName)
    if (filters.buyerName) list = list.filter((r) => r.buyerName === filters.buyerName)
    if (filters.approvalStatus) {
      list = list.filter((r) => r.approvalStatus === filters.approvalStatus)
    }
    if (filters.invoiceStatus) {
      list = list.filter((r) => r.invoiceStatus === filters.invoiceStatus)
    }
    if (filters.origin) list = list.filter((r) => r.origin === filters.origin)
    if (filters.documentDateFrom) {
      list = list.filter((r) => r.documentDate >= filters.documentDateFrom)
    }
    if (filters.documentDateTo) {
      list = list.filter((r) => r.documentDate <= filters.documentDateTo)
    }
    if (filters.expectedDeliveryFrom) {
      list = list.filter((r) => r.expectedDeliveryDate >= filters.expectedDeliveryFrom)
    }
    if (filters.expectedDeliveryTo) {
      list = list.filter((r) => r.expectedDeliveryDate <= filters.expectedDeliveryTo)
    }
    return sortPoRows(list, sortBy)
  }, [rows, filters, sortBy])

  const applyStatusFilter = useCallback((status: string) => {
    setFilters((f) => ({ ...f, status }))
  }, [])

  const registerOverview = useMemo(() => buildPoRegisterOverview(filtered), [filtered])
  const registerSuggestions = useMemo(
    () =>
      buildPoRegisterSuggestions({
        rows: filtered,
        activeStatus: filters.status,
        canCreate: perms.canCreateOrder,
        onApplyStatus: applyStatusFilter,
        onCreate: () => navigate('/purchase/orders/new'),
        onOpenSetup: () => navigate('/purchase/setup'),
      }),
    [filtered, filters.status, perms.canCreateOrder, applyStatusFilter, navigate],
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
      onView: (po: PurchaseOrderListRow) => navigate(`/purchase/orders/${po.id}`),
      onEdit: (po: PurchaseOrderListRow) => navigate(`/purchase/orders/${po.id}/edit`),
      onRevise: (po: PurchaseOrderListRow) => navigate(`/purchase/orders/${po.id}/revise`),
      onPrint: (po: PurchaseOrderListRow) => navigate(`/purchase/orders/${po.id}/print`),
      onSubmit: (po: PurchaseOrderListRow) =>
        void runAction(
          po.id,
          () => submitPurchaseOrder(po.id),
          `${po.documentNumber} submitted for approval`,
        ),
      onApprove: (po: PurchaseOrderListRow) =>
        void runAction(po.id, () => approvePurchaseOrder(po.id), `${po.documentNumber} approved`),
      onRelease: (po: PurchaseOrderListRow) =>
        void runAction(po.id, () => releasePurchaseOrder(po.id), `${po.documentNumber} released`),
      onCancel: (po: PurchaseOrderListRow) =>
        void runAction(
          po.id,
          () => cancelPurchaseOrder(po.id, 'Cancelled from list'),
          `${po.documentNumber} cancelled`,
        ),
    }),
    [navigate],
  )

  const exportList = () => {
    exportRowsToCsv(
      'purchase-orders',
      [
        'PO Number',
        'PO Date',
        'Vendor',
        'Vendor GST Number',
        'Location',
        'Buyer',
        'Currency',
        'Expected Delivery',
        'Basic Amount',
        'Tax Amount',
        'Total Amount',
        'Received %',
        'Invoice Status',
        'Approval Status',
        'PO Status',
      ],
      filtered.map((r) => [
        r.documentNumber,
        r.documentDate,
        r.vendorName,
        r.vendorGstin,
        r.locationName,
        r.buyerName,
        r.currency,
        r.expectedDeliveryDate,
        r.basicAmount,
        r.taxAmount,
        r.totalAmount,
        r.receivedPercentage,
        r.invoiceStatusLabel,
        r.approvalStatusLabel,
        r.statusLabel,
      ]),
    )
    notify.success(`Exported ${filtered.length} purchase order(s)`)
  }

  const clearFilters = () => {
    filterDrawer.clearAll()
  }

  const shellBreadcrumbs = poListBreadcrumbs()
  const activeFilters = hasActivePoFilters(filters)

  if (loadState === 'loading' && rows.length === 0) {
    return (
      <OperationalPageShell
        title="Purchase Orders"
        description="Track vendor commitments, approvals, receipts, and invoicing"
        badge="Purchase"
        variant="dynamics"
        breadcrumbs={shellBreadcrumbs}
        favoritePath="/purchase/orders"
        pageGuide={null}
      >
        <LoadingState variant="table" rows={8} cols={8} />
      </OperationalPageShell>
    )
  }

  if (loadState === 'error') {
    return (
      <OperationalPageShell
        title="Purchase Orders"
        description="Track vendor commitments, approvals, receipts, and invoicing"
        badge="Purchase"
        variant="dynamics"
        breadcrumbs={shellBreadcrumbs}
        favoritePath="/purchase/orders"
        pageGuide={null}
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
          title="Could not load purchase orders"
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
        title="Purchase Orders"
        description="Track vendor commitments, approvals, receipts, and invoicing"
        badge="Purchase"
        variant="dynamics"
        breadcrumbs={shellBreadcrumbs}
        favoritePath="/purchase/orders"
        pageGuide={null}
        commandBar={
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={
              perms.canCreateOrder
                ? {
                    id: 'create',
                    label: 'New Purchase Order',
                    icon: Plus,
                    onClick: () => navigate('/purchase/orders/new'),
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
                  notify.info('Purchase orders refreshed')
                },
              },
            ]}
            moreActions={[
              { id: 'save-view', label: 'Save View', icon: Save, onClick: savedViews.openSaveDialog },
            ]}
          />
        }
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
          <div className="min-w-0 space-y-3">
            <ErpPageGuide
              purpose="Purchase orders — create, approve and release, then track delivery."
              nextStep="Approve and release PO, await vendor confirmation, then record gate entry & GRN."
            />
            <EnterpriseRegisterTableShell className="min-w-0">
              <PurchaseOrdersTable
                rows={filtered}
                busyId={busyId}
                handlers={rowHandlers}
                hasActiveFilters={activeFilters}
                onClearFilters={clearFilters}
                onExport={exportList}
                registerFilter={{
                  search: filters.search,
                  onSearchChange: (search) => setFilters((f) => ({ ...f, search })),
                  searchPlaceholder: 'Search PO number, vendor, GST, buyer…',
                  activeFilterCount: filterDrawer.activeCount,
                  onOpenFilters: filterDrawer.openDrawer,
                  chips: filterDrawer.chips,
                  onRemoveChip: filterDrawer.removeChip,
                  onClearAll: clearFilters,
                  savedView: savedViews.activeView,
                  onSavedViewChange: savedViews.selectView,
                  savedViews: savedViews.viewNames,
                  onSaveView: savedViews.openSaveDialog,
                  showCommandPaletteHint: false,
                  sort: (
                    <CrmListSortSelect
                      value={sortBy}
                      onChange={(v) => setSortBy(v as PoSortKey)}
                      aria-label="Sort purchase orders"
                      options={PO_SORT_OPTIONS}
                    />
                  ),
                }}
                emptyAction={
                  filtered.length === 0 ? (
                    <div className="flex flex-wrap justify-center gap-2">
                      {rows.length === 0 && perms.canCreateOrder ? (
                        <button
                          type="button"
                          className="erp-btn erp-btn--primary text-[13px]"
                          onClick={() => navigate('/purchase/orders/new')}
                        >
                          New Purchase Order
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
          </div>
          <PurchaseRegisterContextPanel
            ariaLabel="Purchase order overview and suggestions"
            title="Order Insights"
            subtitle="AI suggested bottlenecks and next actions for this register."
            overview={registerOverview}
            suggestions={registerSuggestions}
          />
        </div>
      </OperationalPageShell>

      <CrmFilterDrawer
        open={filterDrawer.open}
        onClose={filterDrawer.closeDrawer}
        title="Filter purchase orders"
        fields={poFilterFields}
        values={filterDrawer.draft}
        onChange={(next) => filterDrawer.setDraft({ ...filterDrawer.draft, ...next })}
        onApply={filterDrawer.applyFilters}
        onReset={filterDrawer.resetDraft}
        savedViewsSlot={
          <p className="text-[12px] leading-snug text-erp-muted">
            Apply filters, then use <span className="font-semibold text-erp-text">Save view</span> on
            the register bar to reuse this setup later.
          </p>
        }
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
