import type { ReactNode } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import type { FilterChip } from '../design-system/SmartFilterBar'
import { FilterBarFieldContext } from '../design-system/filterBarContext'
import { SearchInput } from '../ui/SearchInput'
import { ErpButton } from '../erp/ErpButton'
import { Select } from '../forms/Inputs'
import { cn } from '../../utils/cn'

export interface CrmListFilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  /** Omit when the bar has no filter drawer (status lives in `sort`). */
  activeFilterCount?: number
  onOpenFilters?: () => void
  chips?: FilterChip[]
  onRemoveChip?: (id: string) => void
  onClearAll?: () => void
  /** @deprecated Prefer table pagination total — hide on register gold path */
  resultCount?: number
  savedView?: string
  onSavedViewChange?: (view: string) => void
  savedViews?: readonly string[]
  onSaveView?: () => void
  trailing?: ReactNode
  className?: string
  /** Sort dropdown — after search */
  sort?: ReactNode
  /** Extra controls (legacy) */
  afterFilters?: ReactNode
  /** Columns control injected by DataGrid when using registerBar */
  columnsControl?: ReactNode
  /** Show ⌘K hint — always off on Purchase; opt in only where command palette is wired. */
  showCommandPaletteHint?: boolean
}

export interface CrmListSortOption {
  value: string
  label: string
}

export function CrmListSortSelect({
  value,
  onChange,
  options,
  'aria-label': ariaLabel = 'Sort',
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: CrmListSortOption[]
  'aria-label'?: string
  className?: string
}) {
  return (
    <Select
      native
      value={value}
      onChange={(e) => onChange(e.target.value)}
      wrapClassName="crm-list-filter-bar__select-wrap crm-list-filter-bar__sort-wrap shrink-0"
      className={cn('crm-list-filter-bar__control crm-list-filter-bar__sort-select', className)}
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  )
}

/**
 * Register toolbar (gold path):
 * Wide:  [ Search …… ] [ Sort ] [ View ] [ Save view ] [ Columns ] [ Filters ]
 * Narrow: row1 Search + Sort · row2 View + Columns + Filters
 */
export function CrmListFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  activeFilterCount = 0,
  onOpenFilters,
  chips = [],
  onRemoveChip,
  onClearAll,
  resultCount,
  savedView,
  onSavedViewChange,
  savedViews,
  onSaveView,
  trailing,
  className,
  sort,
  afterFilters,
  columnsControl,
  showCommandPaletteHint = false,
}: CrmListFilterBarProps) {
  const showChips = chips.length > 0
  const showFilters = typeof onOpenFilters === 'function'
  const showSecondary =
    Boolean(onSavedViewChange && savedViews) ||
    Boolean(onSaveView) ||
    Boolean(columnsControl) ||
    showFilters ||
    Boolean(afterFilters) ||
    Boolean(trailing) ||
    resultCount != null

  return (
    <FilterBarFieldContext.Provider value>
      <div className={cn('crm-list-filter-bar', className)}>
        <div className="crm-list-filter-bar__toolbar">
          <div className="crm-list-filter-bar__primary">
            <div
              className={cn(
                'ent-search-wrap crm-list-filter-bar__search',
                showCommandPaletteHint && 'ent-search-wrap--with-kbd',
              )}
            >
              <SearchInput
                value={search}
                onChange={onSearchChange}
                placeholder={searchPlaceholder}
                className="w-full"
                size="sm"
              />
              {showCommandPaletteHint ? (
                <kbd className="ent-search-kbd" aria-hidden>
                  <span>⌘</span>K
                </kbd>
              ) : null}
            </div>
            {sort}
          </div>

          {showSecondary ? (
          <div className="crm-list-filter-bar__secondary">
            {onSavedViewChange && savedViews ? (
              <Select
                native
                value={savedView}
                onChange={(e) => onSavedViewChange(e.target.value)}
                wrapClassName="crm-list-filter-bar__select-wrap crm-list-filter-bar__view-wrap shrink-0"
                className="crm-list-filter-bar__control crm-list-filter-bar__view-select"
                aria-label="Saved view"
              >
                {savedViews.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            ) : null}
            {onSaveView ? (
              <button
                type="button"
                onClick={onSaveView}
                className="crm-list-filter-bar__save-view"
                title="Save current filters as a view"
              >
                Save view
              </button>
            ) : null}
            {columnsControl}
            {showFilters ? (
              <ErpButton
                type="button"
                variant="secondary"
                size="sm"
                icon={SlidersHorizontal}
                onClick={onOpenFilters}
                className="crm-list-filter-bar__btn crm-list-filter-bar__filters-btn shrink-0"
                aria-label={
                  activeFilterCount > 0 ? `Filters (${activeFilterCount} active)` : 'Open filters'
                }
              >
                <span className="crm-list-filter-bar__filters-label">
                  Filters
                  <span
                    className={cn(
                      'crm-list-filter-bar__filters-count',
                      activeFilterCount > 0 && 'crm-list-filter-bar__filters-count--on',
                    )}
                    aria-hidden={activeFilterCount === 0}
                  >
                    {activeFilterCount > 0 ? `(${activeFilterCount})` : '\u00a0'}
                  </span>
                </span>
              </ErpButton>
            ) : null}
            {afterFilters}
            {trailing}
            {resultCount != null ? (
              <span className="crm-list-filter-bar__count" aria-live="polite">
                {resultCount}
              </span>
            ) : null}
          </div>
          ) : null}
        </div>

        {showChips ? (
          <div className="crm-list-filter-bar__chips">
            <span className="crm-list-filter-bar__chips-label">Filters</span>
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => onRemoveChip?.(chip.id)}
                className="erp-filter-chip group"
              >
                {chip.label}
                <X className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
            {onClearAll ? (
              <button
                type="button"
                onClick={onClearAll}
                className="text-[11px] font-semibold text-erp-primary hover:underline"
              >
                Clear
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </FilterBarFieldContext.Provider>
  )
}
