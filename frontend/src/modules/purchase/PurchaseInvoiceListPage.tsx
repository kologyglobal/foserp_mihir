import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, Plus, Receipt, RefreshCw, Save } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { SaveViewDialog } from '@/components/design-system/SaveViewDialog'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { CrmFilterDrawer } from '@/components/crm/CrmFilterDrawer'
import { CrmListSortSelect } from '@/components/crm/CrmListFilterBar'
import { PurchaseInvoicesTable } from '@/components/purchase/PurchaseInvoicesTable'
import { PurchaseRegisterContextPanel } from '@/components/purchase/PurchaseRegisterContextPanel'
import { useSavedViews } from '@/hooks/useSavedViews'
import { useCrmFilterDrawer } from '@/hooks/useCrmFilterDrawer'
import { INVOICE_REGISTER_PRESETS } from '@/config/savedViewPresets'
import {
  DEFAULT_INVOICE_LIST_FILTERS,
  INVOICE_SORT_OPTIONS,
  buildInvoiceFilterFields,
  crmValuesToInvoiceFilters,
  hasActiveInvoiceFilters,
  invoiceFilterChipLabelResolver,
  invoiceFiltersToCrmValues,
  serializeInvoiceFilters,
  type InvoiceListFilters,
  type InvoiceSortKey,
} from '@/config/invoiceFilterConfig'
import {
  isInvoiceMismatchOrHold,
  isInvoiceNeedsAttention,
  isInvoiceReadyToPost,
} from '@/utils/invoiceKpiItems'
import {
  buildInvoiceRegisterOverview,
  buildInvoiceRegisterSuggestions,
} from '@/utils/invoiceRegisterInsights'
import { getPurchaseInvoiceList } from '@/services/purchase'
import type { PurchaseInvoiceListRow } from '@/types/purchaseDomain'
import { exportRowsToCsv } from '@/utils/exportCsv'
import { invoiceListBreadcrumbs } from '@/utils/purchaseNavigation'
import { notify } from '@/store/toastStore'
import { usePurchasePermissions } from '@/utils/permissions'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

function sortInvoiceRows(
  rows: PurchaseInvoiceListRow[],
  sortBy: InvoiceSortKey,
): PurchaseInvoiceListRow[] {
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
    case 'status':
      return list.sort((a, b) => cmp(a.statusLabel, b.statusLabel))
    case 'matchingResultStatus':
      return list.sort((a, b) =>
        cmp(a.matchingResultStatusLabel, b.matchingResultStatusLabel),
      )
    case 'dueDate':
      return list.sort((a, b) => cmp(a.dueDate ?? '9999', b.dueDate ?? '9999'))
    case 'documentDate':
    default:
      return list.sort(
        (a, b) =>
          cmp(b.documentDate, a.documentDate) || cmp(b.documentNumber, a.documentNumber),
      )
  }
}

export function PurchaseInvoiceListPage() {
  const navigate = useNavigate()
  const perms = usePurchasePermissions()
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<InvoiceListFilters>(() => ({
    ...DEFAULT_INVOICE_LIST_FILTERS,
    status: searchParams.get('status') ?? '',
  }))
  const [sortBy, setSortBy] = useState<InvoiceSortKey>('documentDate')
  const [rows, setRows] = useState<PurchaseInvoiceListRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    setErrorMessage(null)
    try {
      const list = await getPurchaseInvoiceList()
      if (signal?.cancelled) return
      setRows(list)
      setLoadState(list.length === 0 ? 'empty' : 'ready')
    } catch (err) {
      if (signal?.cancelled) return
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load invoices')
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

  const applyInvoiceFilters = useCallback((saved: Record<string, string>) => {
    setFilters({
      ...DEFAULT_INVOICE_LIST_FILTERS,
      search: saved.search ?? '',
      status: saved.status ?? '',
      vendorName: saved.vendorName ?? '',
      origin: saved.origin ?? '',
      matchingResultStatus: saved.matchingResultStatus ?? '',
      matchStatus: saved.matchStatus ?? '',
      documentDateFrom: saved.documentDateFrom ?? '',
      documentDateTo: saved.documentDateTo ?? '',
      dueDateFrom: saved.dueDateFrom ?? '',
      dueDateTo: saved.dueDateTo ?? '',
    })
    const sb = saved.sortBy as InvoiceSortKey | undefined
    if (sb && INVOICE_SORT_OPTIONS.some((o) => o.value === sb)) {
      setSortBy(sb)
    }
  }, [])

  const savedViews = useSavedViews({
    pageId: '/purchase/invoices',
    filters: { ...serializeInvoiceFilters(filters), sortBy },
    onApply: applyInvoiceFilters,
    systemPresets: INVOICE_REGISTER_PRESETS,
  })

  const vendorNames = useMemo(
    () => [...new Set(rows.map((r) => r.vendorName).filter(Boolean))].sort(),
    [rows],
  )

  const invoiceFilterFields = useMemo(
    () => buildInvoiceFilterFields({ vendorOptions: vendorNames }),
    [vendorNames],
  )

  const filterDrawer = useCrmFilterDrawer({
    values: invoiceFiltersToCrmValues(filters),
    onChange: (next) => setFilters(crmValuesToInvoiceFilters(next)),
    fields: invoiceFilterFields,
    defaults: invoiceFiltersToCrmValues(DEFAULT_INVOICE_LIST_FILTERS),
    chipLabelResolver: (key, value) => invoiceFilterChipLabelResolver(key, value),
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
          r.vendorInvoiceNumber.toLowerCase().includes(q) ||
          (r.purchaseOrderNumber ?? '').toLowerCase().includes(q) ||
          (r.goodsReceiptNumber ?? '').toLowerCase().includes(q) ||
          r.statusLabel.toLowerCase().includes(q) ||
          r.originLabel.toLowerCase().includes(q) ||
          r.matchingResultStatusLabel.toLowerCase().includes(q),
      )
    }
    if (filters.status === 'needs_attention') {
      list = list.filter(isInvoiceNeedsAttention)
    } else if (filters.status === 'mismatch_or_hold') {
      list = list.filter(isInvoiceMismatchOrHold)
    } else if (filters.status === 'ready_to_post') {
      list = list.filter(isInvoiceReadyToPost)
    } else if (filters.status) {
      list = list.filter((r) => r.status === filters.status)
    }
    if (filters.vendorName) list = list.filter((r) => r.vendorName === filters.vendorName)
    if (filters.origin) list = list.filter((r) => r.origin === filters.origin)
    if (filters.matchingResultStatus) {
      list = list.filter((r) => r.matchingResultStatus === filters.matchingResultStatus)
    }
    if (filters.matchStatus) list = list.filter((r) => r.matchStatus === filters.matchStatus)
    if (filters.documentDateFrom) {
      list = list.filter((r) => r.documentDate >= filters.documentDateFrom)
    }
    if (filters.documentDateTo) {
      list = list.filter((r) => r.documentDate <= filters.documentDateTo)
    }
    if (filters.dueDateFrom) {
      list = list.filter((r) => (r.dueDate ?? '') >= filters.dueDateFrom)
    }
    if (filters.dueDateTo) {
      list = list.filter((r) => (r.dueDate ?? '') <= filters.dueDateTo)
    }
    return sortInvoiceRows(list, sortBy)
  }, [rows, filters, sortBy])

  const applyStatusFilter = useCallback((status: string) => {
    setFilters((f) => ({ ...f, status }))
  }, [])

  const registerOverview = useMemo(() => buildInvoiceRegisterOverview(filtered), [filtered])
  const registerSuggestions = useMemo(
    () =>
      buildInvoiceRegisterSuggestions({
        rows: filtered,
        activeStatus: filters.status,
        canCreate: perms.canCreateInvoice,
        onApplyStatus: applyStatusFilter,
        onCreate: () => navigate('/purchase/invoices/new'),
        onOpenSetup: () => navigate('/purchase/setup'),
      }),
    [filtered, filters.status, perms.canCreateInvoice, applyStatusFilter, navigate],
  )

  const rowHandlers = useMemo(
    () => ({
      onView: (row: PurchaseInvoiceListRow) => navigate(`/purchase/invoices/${row.id}`),
      onEdit: (row: PurchaseInvoiceListRow) => navigate(`/purchase/invoices/${row.id}/edit`),
      onPrint: (row: PurchaseInvoiceListRow) => navigate(`/purchase/invoices/${row.id}/print`),
    }),
    [navigate],
  )

  const exportList = () => {
    exportRowsToCsv(
      'purchase-invoices',
      [
        'Invoice Number',
        'Invoice Date',
        'Vendor',
        'Vendor GSTIN',
        'Vendor Invoice #',
        'PO',
        'GRN',
        'Origin',
        'Matching',
        'Match Status',
        'Total Amount',
        'Due Date',
        'Status',
      ],
      filtered.map((r) => [
        r.documentNumber,
        r.documentDate,
        r.vendorName,
        r.vendorGstin,
        r.vendorInvoiceNumber,
        r.purchaseOrderNumber ?? '',
        r.goodsReceiptNumber ?? '',
        r.originLabel,
        r.matchingResultStatusLabel,
        r.matchStatus,
        r.totalAmount,
        r.dueDate ?? '',
        r.statusLabel,
      ]),
    )
    notify.success(`Exported ${filtered.length} purchase invoice(s)`)
  }

  const clearFilters = () => {
    filterDrawer.clearAll()
  }

  const shellBreadcrumbs = invoiceListBreadcrumbs()
  const activeFilters = hasActiveInvoiceFilters(filters)

  if (loadState === 'loading' && rows.length === 0) {
    return (
      <OperationalPageShell
        title="Purchase Invoices"
        description="Three-way match purchase invoices against PO and GRN"
        badge="Purchase"
        variant="dynamics"
        breadcrumbs={shellBreadcrumbs}
        favoritePath="/purchase/invoices"
      >
        <LoadingState variant="table" rows={8} cols={8} />
      </OperationalPageShell>
    )
  }

  if (loadState === 'error') {
    return (
      <OperationalPageShell
        title="Purchase Invoices"
        description="Three-way match purchase invoices against PO and GRN"
        badge="Purchase"
        variant="dynamics"
        breadcrumbs={shellBreadcrumbs}
        favoritePath="/purchase/invoices"
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
          icon={Receipt}
          title="Could not load purchase invoices"
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
        title="Purchase Invoices"
        description="Three-way match purchase invoices against PO and GRN"
        badge="Purchase"
        variant="dynamics"
        breadcrumbs={shellBreadcrumbs}
        favoritePath="/purchase/invoices"
        commandBar={
          <ErpCommandBar
            inline
            sticky={false}
            primaryAction={
              perms.canCreateInvoice
                ? {
                    id: 'create',
                    label: 'New Invoice',
                    icon: Plus,
                    onClick: () => navigate('/purchase/invoices/new'),
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
                  notify.info('Purchase invoices refreshed')
                },
              },
            ]}
            moreActions={[
              { id: 'save-view', label: 'Save View', icon: Save, onClick: savedViews.openSaveDialog },
            ]}
          />
        }
      >
        <div className="space-y-3">
          <PurchaseRegisterContextPanel
            ariaLabel="Purchase invoice overview and suggestions"
            title="Invoice Insights"
            subtitle="AI suggested bottlenecks and next actions for this register."
            storageKey="purchase.ai-insights.invoices"
            overview={registerOverview}
            suggestions={registerSuggestions}
          />
          <EnterpriseRegisterTableShell className="min-w-0">
            <PurchaseInvoicesTable
              rows={filtered}
              handlers={rowHandlers}
              hasActiveFilters={activeFilters}
              onClearFilters={clearFilters}
              onExport={exportList}
              registerFilter={{
                search: filters.search,
                onSearchChange: (search) => setFilters((f) => ({ ...f, search })),
                searchPlaceholder: 'Search invoice, vendor, PO, GRN…',
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
                    onChange={(v) => setSortBy(v as InvoiceSortKey)}
                    aria-label="Sort purchase invoices"
                    options={INVOICE_SORT_OPTIONS}
                  />
                ),
              }}
              emptyAction={
                filtered.length === 0 ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    {rows.length === 0 && perms.canCreateInvoice ? (
                      <button
                        type="button"
                        className="erp-btn erp-btn--primary text-[13px]"
                        onClick={() => navigate('/purchase/invoices/new')}
                      >
                        New Invoice
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
      </OperationalPageShell>

      <CrmFilterDrawer
        open={filterDrawer.open}
        onClose={filterDrawer.closeDrawer}
        fields={invoiceFilterFields}
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
