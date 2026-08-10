/**
 * Store register list scaffold — the Store-module implementation of
 * `docs/PURCHASE_LIST_PAGE_STANDARD.md` (gold path `/purchase/requisitions`).
 *
 * Chrome provided here: OperationalPageShell + ErpCommandBar,
 * EnterpriseRegisterTableShell + DataGrid (embedded CrmListFilterBar with
 * search / sort / saved views / columns / Filters), CrmFilterDrawer and
 * SaveViewDialog. Callers own data loading, filtering and sorting and pass
 * the final `rows`.
 */
import type { ComponentProps, ReactNode } from 'react'
import { useCallback } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { LucideIcon } from 'lucide-react'
import { OperationalPageShell } from '../../../components/design-system/OperationalPageShell'
import { SaveViewDialog } from '../../../components/design-system/SaveViewDialog'
import { DataGrid } from '../../../components/design-system/DataGrid'
import { EnterpriseRegisterTableShell } from '../../../design-system/list-page/EnterpriseRegisterTableShell'
import { ErpCommandBar } from '../../../components/erp/ErpCommandBar'
import { EmptyState } from '../../../components/ui/EmptyState'
import { LoadingState } from '../../../design-system/components/LoadingState'
import { CrmFilterDrawer } from '../../../components/crm/CrmFilterDrawer'
import { CrmListFilterBar, CrmListSortSelect, type CrmListSortOption } from '../../../components/crm/CrmListFilterBar'
import { useCrmFilterDrawer } from '../../../hooks/useCrmFilterDrawer'
import { useSavedViews } from '../../../hooks/useSavedViews'
import type { CrmFilterField } from '../../../types/crmListFilters'

export type StoreRegisterFilters = Record<string, string>

type CommandBarProps = ComponentProps<typeof ErpCommandBar>

export interface StoreRegisterListPageProps<T> {
  /** Stable route key — saved views + column layout persistence. */
  pageId: string
  title: string
  description: string
  breadcrumbs?: { label: string; to?: string }[]
  /** Filtered + sorted rows to render. */
  rows: T[]
  /** Unfiltered count — distinguishes "nothing exists" from "filters match nothing". */
  totalRowCount: number
  columns: ColumnDef<T, unknown>[]
  getRowId: (row: T) => string
  loading: boolean
  searchPlaceholder: string
  sortOptions: CrmListSortOption[]
  sortBy: string
  onSortChange: (value: string) => void
  /** Applied filter values — must include a `search` key. */
  filters: StoreRegisterFilters
  defaultFilters: StoreRegisterFilters
  onFiltersChange: (next: StoreRegisterFilters) => void
  filterFields: CrmFilterField[]
  drawerTitle: string
  chipLabelResolver?: (key: string, value: string) => string | undefined
  primaryAction?: CommandBarProps['primaryAction']
  secondaryActions?: CommandBarProps['secondaryActions']
  emptyIcon: LucideIcon
  emptyTitle: string
  emptyDescription: string
  emptyAction?: ReactNode
  /** Optional content between command bar and table (e.g. inline create panel). */
  beforeTable?: ReactNode
}

export function StoreRegisterListPage<T>({
  pageId,
  title,
  description,
  breadcrumbs,
  rows,
  totalRowCount,
  columns,
  getRowId,
  loading,
  searchPlaceholder,
  sortOptions,
  sortBy,
  onSortChange,
  filters,
  defaultFilters,
  onFiltersChange,
  filterFields,
  drawerTitle,
  chipLabelResolver,
  primaryAction,
  secondaryActions,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  beforeTable,
}: StoreRegisterListPageProps<T>) {
  const filterDrawer = useCrmFilterDrawer<StoreRegisterFilters>({
    values: filters,
    onChange: onFiltersChange,
    fields: filterFields,
    defaults: defaultFilters,
    chipLabelResolver,
  })

  const applySavedView = useCallback(
    (saved: Record<string, string>) => {
      const next: StoreRegisterFilters = { ...defaultFilters }
      for (const key of Object.keys(defaultFilters)) {
        if (saved[key] != null) next[key] = saved[key]
      }
      onFiltersChange(next)
      const sb = saved.sortBy
      if (sb && sortOptions.some((o) => o.value === sb)) onSortChange(sb)
    },
    [defaultFilters, onFiltersChange, onSortChange, sortOptions],
  )

  const savedViews = useSavedViews({
    pageId,
    filters: { ...filters, sortBy },
    onApply: applySavedView,
  })

  const shellProps = {
    variant: 'dynamics' as const,
    layout: 'enterprise' as const,
    badge: 'Store',
    title,
    description,
    breadcrumbs: breadcrumbs ?? [{ label: 'Store', to: '/inventory' }, { label: title }],
    autoBreadcrumbs: false,
    favoritePath: pageId,
    pageGuide: null,
  }

  const commandBar = (
    <ErpCommandBar inline sticky={false} primaryAction={primaryAction} secondaryActions={secondaryActions} />
  )

  if (loading && totalRowCount === 0) {
    return (
      <OperationalPageShell {...shellProps} commandBar={commandBar}>
        <LoadingState variant="table" rows={8} cols={Math.min(columns.length, 8)} />
      </OperationalPageShell>
    )
  }

  const noDataAtAll = !loading && totalRowCount === 0

  return (
    <>
      <OperationalPageShell {...shellProps} commandBar={commandBar}>
        {beforeTable}
        {noDataAtAll ? (
          <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
        ) : (
          <EnterpriseRegisterTableShell className="min-w-0 flex-1">
            <DataGrid<T>
              data={rows}
              columns={columns}
              getRowId={getRowId}
              loading={loading}
              pageSize={25}
              emptyMessage="No rows match the current filters."
              columnLayoutKey={pageId}
              registerBar={(
                <CrmListFilterBar
                  className="crm-list-filter-bar--embedded"
                  search={filters.search ?? ''}
                  onSearchChange={(search) => onFiltersChange({ ...filters, search })}
                  searchPlaceholder={searchPlaceholder}
                  activeFilterCount={filterDrawer.activeCount}
                  onOpenFilters={filterDrawer.openDrawer}
                  chips={filterDrawer.chips}
                  onRemoveChip={filterDrawer.removeChip}
                  onClearAll={filterDrawer.clearAll}
                  savedView={savedViews.activeView}
                  onSavedViewChange={savedViews.selectView}
                  savedViews={savedViews.viewNames}
                  onSaveView={savedViews.openSaveDialog}
                  showCommandPaletteHint={false}
                  sort={(
                    <CrmListSortSelect
                      value={sortBy}
                      onChange={onSortChange}
                      aria-label={`Sort ${title.toLowerCase()}`}
                      options={sortOptions}
                    />
                  )}
                />
              )}
            />
          </EnterpriseRegisterTableShell>
        )}
      </OperationalPageShell>

      <CrmFilterDrawer
        open={filterDrawer.open}
        onClose={filterDrawer.closeDrawer}
        title={drawerTitle}
        fields={filterFields}
        values={filterDrawer.draft}
        onChange={(next) => filterDrawer.setDraft({ ...filterDrawer.draft, ...(next as StoreRegisterFilters) })}
        onApply={filterDrawer.applyFilters}
        onReset={filterDrawer.resetDraft}
        savedViewsSlot={(
          <p className="text-[12px] leading-snug text-erp-muted">
            Apply filters, then use <span className="font-semibold text-erp-text">Save view</span> on
            the register bar to reuse this setup later.
          </p>
        )}
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
