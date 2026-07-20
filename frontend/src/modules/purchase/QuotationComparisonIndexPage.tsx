import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, GitCompare, RefreshCw, Save } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { SaveViewDialog } from '@/components/design-system/SaveViewDialog'
import { CrmFilterDrawer } from '@/components/crm/CrmFilterDrawer'
import { CrmListFilterBar, CrmListSortSelect } from '@/components/crm/CrmListFilterBar'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpDataGrid } from '@/components/erp/ErpDataGrid'
import { PurchaseRegisterContextPanel } from '@/components/purchase/PurchaseRegisterContextPanel'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
} from '@/design-system/enterprise/EnterpriseTablePrimitives'
import {
  buildRfqFilterFields,
  crmValuesToRfqFilters,
  DEFAULT_RFQ_LIST_FILTERS,
  filterRfqRows,
  hasActiveRfqFilters,
  RFQ_SORT_OPTIONS,
  rfqFilterChipLabelResolver,
  rfqFiltersToCrmValues,
  sortRfqRows,
  type RfqListFilters,
  type RfqSortKey,
} from '@/config/rfqFilterConfig'
import { COMPARISON_REGISTER_PRESETS } from '@/config/savedViewPresets'
import { useCrmFilterDrawer } from '@/hooks/useCrmFilterDrawer'
import { useSavedViews } from '@/hooks/useSavedViews'
import { getRfqList, getVendorQuotations } from '@/services/purchase'
import type { RfqListRow } from '@/types/purchaseDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import {
  buildRfqRegisterOverview,
  buildRfqRegisterSuggestions,
} from '@/utils/rfqRegisterInsights'
import { purchaseBreadcrumbs } from '@/utils/purchaseNavigation'

type ComparisonIndexRow = RfqListRow & { quoteCount: number }

export function QuotationComparisonIndexPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<ComparisonIndexRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<RfqListFilters>(DEFAULT_RFQ_LIST_FILTERS)
  const [sortBy, setSortBy] = useState<RfqSortKey>('documentDate')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rfqRows, quotes] = await Promise.all([getRfqList(), getVendorQuotations()])
      const countByRfq = quotes.reduce<Record<string, number>>((acc, q) => {
        acc[q.rfqId] = (acc[q.rfqId] ?? 0) + 1
        return acc
      }, {})
      const enriched = rfqRows
        .map((r) => ({ ...r, quoteCount: countByRfq[r.id] ?? 0 }))
        .filter((r) => r.quoteCount > 0 || r.responsesReceived > 0)
        .sort((a, b) => b.quoteCount - a.quoteCount || b.documentDate.localeCompare(a.documentDate))
      setRows(enriched)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load RFQs')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const applySavedFilters = useCallback((saved: Record<string, string>) => {
    setFilters({
      search: saved.search ?? '',
      status: saved.status ?? '',
      buyerName: saved.buyerName ?? '',
      locationName: saved.locationName ?? '',
    })
    const sb = saved.sortBy as RfqSortKey | undefined
    if (sb && RFQ_SORT_OPTIONS.some((o) => o.value === sb)) {
      setSortBy(sb)
    }
  }, [])

  const savedViews = useSavedViews({
    pageId: '/purchase/comparison',
    filters: { ...filters, sortBy },
    onApply: applySavedFilters,
    systemPresets: COMPARISON_REGISTER_PRESETS,
  })

  const buyerOptions = useMemo(
    () => [...new Set(rows.map((r) => r.buyerName).filter(Boolean))].sort(),
    [rows],
  )
  const locationOptions = useMemo(
    () => [...new Set(rows.map((r) => r.locationName).filter(Boolean))].sort(),
    [rows],
  )
  const filterFields = useMemo(
    () => buildRfqFilterFields({ buyerOptions, locationOptions }),
    [buyerOptions, locationOptions],
  )

  const filterDrawer = useCrmFilterDrawer({
    values: rfqFiltersToCrmValues(filters),
    onChange: (next) => setFilters(crmValuesToRfqFilters(next)),
    fields: filterFields,
    defaults: rfqFiltersToCrmValues(DEFAULT_RFQ_LIST_FILTERS),
    chipLabelResolver: rfqFilterChipLabelResolver,
  })

  const filtered = useMemo(() => {
    const list = filterRfqRows(rows, filters) as ComparisonIndexRow[]
    return sortRfqRows(list, sortBy) as ComparisonIndexRow[]
  }, [rows, filters, sortBy])

  const clearFilters = () => filterDrawer.clearAll()
  const activeFilters = hasActiveRfqFilters(filters)

  const registerOverview = useMemo(() => buildRfqRegisterOverview(filtered), [filtered])
  const registerSuggestions = useMemo(
    () =>
      buildRfqRegisterSuggestions({
        rows: filtered,
        activeStatus: filters.status,
        onApplyStatus: (status) => setFilters((f) => ({ ...f, status })),
        onOpenSetup: () => navigate('/purchase/setup'),
      }),
    [filtered, filters.status, navigate],
  )

  const columns = useMemo<ColumnDef<ComparisonIndexRow>[]>(
    () => [
      {
        accessorKey: 'documentNumber',
        header: 'RFQ Number',
        meta: { columnLabel: 'RFQ Number' },
        cell: ({ row }) => (
          <TableLink to={`/purchase/rfqs/${row.original.id}`} className="font-mono">
            {row.original.documentNumber}
          </TableLink>
        ),
      },
      {
        accessorKey: 'documentDate',
        header: 'RFQ Date',
        meta: { columnLabel: 'RFQ Date' },
        cell: ({ row }) => formatDate(row.original.documentDate),
      },
      {
        accessorKey: 'buyerName',
        header: 'Buyer',
        meta: { columnLabel: 'Buyer' },
      },
      {
        accessorKey: 'locationName',
        header: 'Location',
        meta: { columnLabel: 'Location' },
      },
      {
        accessorKey: 'quoteCount',
        header: 'Quotations',
        meta: { columnLabel: 'Quotations' },
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">{row.original.quoteCount}</span>
        ),
      },
      {
        accessorKey: 'responsesReceived',
        header: 'Responses',
        meta: { columnLabel: 'Responses' },
        cell: ({ row }) =>
          `${row.original.responsesReceived}/${row.original.vendorCount || 0}`,
      },
      {
        accessorKey: 'estimatedValue',
        header: 'Estimated Value',
        meta: { columnLabel: 'Estimated Value' },
        cell: ({ row }) => formatCurrency(row.original.estimatedValue),
      },
      {
        accessorKey: 'statusLabel',
        header: 'Status',
        meta: { columnLabel: 'Status' },
        cell: ({ row }) => (
          <StatusDot
            label={row.original.statusLabel}
            tone={statusToneFromLabel(row.original.statusLabel)}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original
          const actions: RowActionItem[] = [
            {
              id: 'view',
              label: 'View RFQ',
              icon: Eye,
              onClick: () => navigate(`/purchase/rfqs/${r.id}`),
            },
            {
              id: 'compare',
              label: 'Compare',
              icon: GitCompare,
              onClick: () => navigate(`/purchase/comparison/${r.id}`),
            },
          ]
          return <EnterpriseRowActionsMenu actions={actions} />
        },
      },
    ],
    [navigate],
  )

  const shellProps = {
    title: 'Quotation Comparison',
    description: 'Compare vendor responses side-by-side and select a recommendation',
    badge: 'Purchase' as const,
    variant: 'dynamics' as const,
    breadcrumbs: purchaseBreadcrumbs('Comparison'),
    favoritePath: '/purchase/comparison',
    pageGuide: null,
  }

  const commandBar = (
    <ErpCommandBar
      inline
      sticky={false}
      secondaryActions={[
        {
          id: 'refresh',
          label: 'Refresh',
          icon: RefreshCw,
          onClick: () => void load(),
        },
      ]}
      moreActions={[
        { id: 'save-view', label: 'Save View', icon: Save, onClick: savedViews.openSaveDialog },
      ]}
    />
  )

  const emptyAction = activeFilters ? (
    <button type="button" className="erp-btn erp-btn--secondary text-[13px]" onClick={clearFilters}>
      Clear Filters
    </button>
  ) : undefined

  return (
    <>
      {loading && rows.length === 0 ? (
        <OperationalPageShell {...shellProps}>
          <LoadingState variant="table" rows={8} cols={7} />
        </OperationalPageShell>
      ) : (
        <OperationalPageShell {...shellProps} commandBar={commandBar}>
          {error ? (
            <EmptyState
              icon={GitCompare}
              title="Could not load comparison index"
              description={error}
              action={
                <button
                  type="button"
                  className="erp-btn erp-btn--primary text-[13px]"
                  onClick={() => void load()}
                >
                  Retry
                </button>
              }
            />
          ) : (
            <PurchaseRegisterContextPanel
              ariaLabel="Comparison overview and suggestions"
              title="Comparison Insights"
              subtitle="Bottlenecks and next actions for this register."
              storageKey="purchase.ai-insights.comparison"
              overview={registerOverview}
              suggestions={registerSuggestions}
              placement="split"
            >
              <EnterpriseRegisterTableShell className="min-w-0">
                <ErpDataGrid
                  data={filtered}
                  columns={columns}
                  showCompactSearch={false}
                  enableColumnSorting={false}
                  stickyFirstColumn
                  emptyMessage={
                    activeFilters
                      ? 'No RFQs match filters.'
                      : 'No RFQs with quotations. Record vendor quotations against sent RFQs to enable comparison.'
                  }
                  emptyAction={emptyAction}
                  getRowId={(r) => r.id}
                  registerBar={
                    <CrmListFilterBar
                      search={filters.search}
                      onSearchChange={(search) => setFilters((f) => ({ ...f, search }))}
                      searchPlaceholder="Search RFQ / buyer / location"
                      activeFilterCount={filterDrawer.activeCount}
                      onOpenFilters={filterDrawer.openDrawer}
                      chips={filterDrawer.chips}
                      onRemoveChip={filterDrawer.removeChip}
                      onClearAll={clearFilters}
                      savedView={savedViews.activeView}
                      onSavedViewChange={savedViews.selectView}
                      savedViews={savedViews.viewNames}
                      onSaveView={savedViews.openSaveDialog}
                      className="crm-list-filter-bar--embedded"
                      showCommandPaletteHint={false}
                      sort={
                        <CrmListSortSelect
                          value={sortBy}
                          onChange={(v) => setSortBy(v as RfqSortKey)}
                          aria-label="Sort comparison RFQs"
                          options={RFQ_SORT_OPTIONS}
                        />
                      }
                    />
                  }
                />
              </EnterpriseRegisterTableShell>
            </PurchaseRegisterContextPanel>
          )}
        </OperationalPageShell>
      )}

      <CrmFilterDrawer
        open={filterDrawer.open}
        onClose={filterDrawer.closeDrawer}
        title="Filter comparison RFQs"
        fields={filterFields}
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
