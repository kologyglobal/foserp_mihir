import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Pencil, Plus, Printer, RefreshCw, Save, Send, Trash2 } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { SaveViewDialog } from '@/components/design-system/SaveViewDialog'
import { CrmFilterDrawer } from '@/components/crm/CrmFilterDrawer'
import { CrmListFilterBar, CrmListSortSelect } from '@/components/crm/CrmListFilterBar'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpDataGrid } from '@/components/erp/ErpDataGrid'
import { PurchaseRegisterContextPanel } from '@/components/purchase/PurchaseRegisterContextPanel'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
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
import { RFQ_REGISTER_PRESETS } from '@/config/savedViewPresets'
import { useCrmFilterDrawer } from '@/hooks/useCrmFilterDrawer'
import { useSavedViews } from '@/hooks/useSavedViews'
import {
  cancelRFQ,
  getRfqList,
  PurchaseServiceError,
} from '@/services/purchase'
import type { RfqListRow } from '@/types/purchaseDomain'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import {
  buildRfqRegisterOverview,
  buildRfqRegisterSuggestions,
} from '@/utils/rfqRegisterInsights'
import { notify } from '@/store/toastStore'
import { usePurchasePermissions } from '@/utils/permissions'

export function RfqListPage() {
  const navigate = useNavigate()
  const perms = usePurchasePermissions()
  const [rows, setRows] = useState<RfqListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<RfqListFilters>(DEFAULT_RFQ_LIST_FILTERS)
  const [sortBy, setSortBy] = useState<RfqSortKey>('documentDate')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await getRfqList())
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
    pageId: '/purchase/rfqs',
    filters: { ...filters, sortBy },
    onApply: applySavedFilters,
    systemPresets: RFQ_REGISTER_PRESETS,
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

  const filtered = useMemo(
    () => sortRfqRows(filterRfqRows(rows, filters), sortBy),
    [rows, filters, sortBy],
  )

  const clearFilters = () => filterDrawer.clearAll()
  const activeFilters = hasActiveRfqFilters(filters)

  const registerOverview = useMemo(() => buildRfqRegisterOverview(filtered), [filtered])
  const registerSuggestions = useMemo(
    () =>
      buildRfqRegisterSuggestions({
        rows: filtered,
        activeStatus: filters.status,
        canCreate: perms.canCreateRfq,
        onApplyStatus: (status) => setFilters((f) => ({ ...f, status })),
        onCreate: () => navigate('/purchase/rfqs/new'),
        onOpenSetup: () => navigate('/purchase/setup'),
      }),
    [filtered, filters.status, navigate, perms.canCreateRfq],
  )

  const columns = useMemo<ColumnDef<RfqListRow>[]>(
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
        accessorKey: 'bidDueDate',
        header: 'Enquiry Due Date',
        meta: { columnLabel: 'Enquiry Due Date' },
        cell: ({ row }) => formatDate(row.original.bidDueDate),
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
        accessorKey: 'vendorCount',
        header: 'Vendor Count',
        meta: { columnLabel: 'Vendor Count' },
        cell: ({ row }) => row.original.vendorCount,
      },
      {
        accessorKey: 'itemCount',
        header: 'Item Count',
        meta: { columnLabel: 'Item Count' },
        cell: ({ row }) => row.original.itemCount,
      },
      {
        accessorKey: 'estimatedValue',
        header: 'Estimated Value',
        meta: { columnLabel: 'Estimated Value' },
        cell: ({ row }) => (
          <span className="tabular-nums">{formatCurrency(row.original.estimatedValue)}</span>
        ),
      },
      {
        accessorKey: 'responsesReceived',
        header: 'Responses Received',
        meta: { columnLabel: 'Responses Received' },
        cell: ({ row }) =>
          `${row.original.responsesReceived}/${row.original.vendorCount || 0}`,
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
          const isDraft = r.status === 'draft'
          const statusLabel = r.statusLabel || r.status
          const actions: RowActionItem[] = [
            {
              id: 'view',
              label: 'View',
              icon: Eye,
              onClick: () => navigate(`/purchase/rfqs/${r.id}`),
            },
            {
              id: 'edit',
              label: 'Edit',
              icon: Pencil,
              onClick: () => navigate(`/purchase/rfqs/${r.id}/edit`),
              disabled: !isDraft,
              disabledReason: `${statusLabel} RFQs cannot be edited`,
            },
            {
              id: 'delete',
              label: 'Delete',
              icon: Trash2,
              danger: true,
              disabled: !isDraft,
              disabledReason: `${statusLabel} RFQs cannot be deleted`,
              onClick: () => {
                void (async () => {
                  try {
                    await cancelRFQ(r.id)
                    notify.success(`${r.documentNumber} cancelled`)
                    await load()
                  } catch (err) {
                    notify.error(
                      err instanceof PurchaseServiceError ? err.message : 'Cancel failed',
                    )
                  }
                })()
              },
            },
          ]
          if (isDraft) {
            actions.push({
              id: 'send',
              label: 'Send RFQ',
              icon: Send,
              onClick: () => navigate(`/purchase/rfqs/${r.id}?send=1`),
            })
          }
          actions.push({
            id: 'print',
            label: 'Print',
            icon: Printer,
            onClick: () => navigate(`/purchase/rfqs/${r.id}?print=1`),
          })
          return <EnterpriseRowActionsMenu actions={actions} />
        },
      },
    ],
    [load, navigate],
  )

  const shellProps = {
    title: 'Requests for Quotation',
    description: 'Vendor enquiry documents — from approved PRs, manual entry, or combined requisitions',
    badge: 'Purchase' as const,
    variant: 'dynamics' as const,
    favoritePath: '/purchase/rfqs',
    pageGuide: null,
  }

  const commandBar = (
    <ErpCommandBar
      inline
      sticky={false}
      primaryAction={
        perms.canCreateRfq
          ? {
              id: 'create',
              label: 'Create RFQ',
              icon: Plus,
              onClick: () => navigate('/purchase/rfqs/new'),
            }
          : undefined
      }
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

  const emptyAction = (
    <div className="flex flex-wrap justify-center gap-2">
      {rows.length === 0 && perms.canCreateRfq ? (
        <button
          type="button"
          className="erp-btn erp-btn--primary text-[13px]"
          onClick={() => navigate('/purchase/rfqs/new')}
        >
          Create RFQ
        </button>
      ) : null}
      {activeFilters ? (
        <button type="button" className="erp-btn erp-btn--secondary text-[13px]" onClick={clearFilters}>
          Clear Filters
        </button>
      ) : null}
    </div>
  )

  return (
    <>
      {loading && rows.length === 0 ? (
        <OperationalPageShell {...shellProps}>
          <LoadingState variant="table" rows={8} cols={8} />
        </OperationalPageShell>
      ) : (
        <OperationalPageShell {...shellProps} commandBar={commandBar}>
          {error ? (
            <EmptyState
              icon={Send}
              title="Could not load RFQs"
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
              ariaLabel="RFQ overview and suggestions"
              title="RFQ Insights"
              subtitle="Bottlenecks and next actions for this register."
              storageKey="purchase.ai-insights.rfqs"
              overview={registerOverview}
              suggestions={registerSuggestions}
              placement="filterBar"
            >
              {({ restoreButton }) => (
                <EnterpriseRegisterTableShell className="min-w-0">
                  <ErpDataGrid
                    data={filtered}
                    columns={columns}
                    showCompactSearch={false}
                    enableColumnSorting={false}
                    stickyFirstColumn
                    emptyMessage={
                      activeFilters
                        ? 'No RFQs match current filters.'
                        : 'No RFQs found. Create from an approved PR, manually, or combine multiple requisitions.'
                    }
                    emptyAction={emptyAction}
                    getRowId={(r) => r.id}
                    registerBar={
                      <CrmListFilterBar
                        search={filters.search}
                        onSearchChange={(search) => setFilters((f) => ({ ...f, search }))}
                        searchPlaceholder="Search RFQ / buyer / PR"
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
                        afterFilters={restoreButton}
                        sort={
                          <CrmListSortSelect
                            value={sortBy}
                            onChange={(v) => setSortBy(v as RfqSortKey)}
                            aria-label="Sort RFQs"
                            options={RFQ_SORT_OPTIONS}
                          />
                        }
                      />
                    }
                  />
                </EnterpriseRegisterTableShell>
              )}
            </PurchaseRegisterContextPanel>
          )}
        </OperationalPageShell>
      )}

      <CrmFilterDrawer
        open={filterDrawer.open}
        onClose={filterDrawer.closeDrawer}
        title="Filter RFQs"
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
