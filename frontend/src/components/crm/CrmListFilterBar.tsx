import type { ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { SmartFilterBar, type FilterChip } from '../design-system/SmartFilterBar'
import { SearchInput } from '../ui/SearchInput'
import { ErpButton } from '../erp/ErpButton'
import { Select } from '../forms/Inputs'
import { cn } from '../../utils/cn'

export interface CrmListFilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  activeFilterCount: number
  onOpenFilters: () => void
  chips?: FilterChip[]
  onRemoveChip?: (id: string) => void
  onClearAll?: () => void
  resultCount?: number
  savedView?: string
  onSavedViewChange?: (view: string) => void
  savedViews?: readonly string[]
  onSaveView?: () => void
  trailing?: ReactNode
  className?: string
  /** Sort dropdown — rendered beside the Filters button */
  sort?: ReactNode
  /** Extra controls beside Filters / Sort (e.g. view toggles, column picker) */
  afterFilters?: ReactNode
  /** Show ⌘K hint and focus opens command palette */
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
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn('crm-list-filter-bar__sort-select h-9 min-w-[9.5rem] max-w-[11rem] shrink-0 py-0 text-[13px]', className)}
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

export function CrmListFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  activeFilterCount,
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
  showCommandPaletteHint = true,
}: CrmListFilterBarProps) {
  return (
    <SmartFilterBar
      className={cn('crm-list-filter-bar', className)}
      chips={chips}
      onRemoveChip={onRemoveChip}
      onClearAll={chips.length > 0 ? onClearAll : undefined}
      resultCount={resultCount}
      savedView={savedView}
      onSavedViewChange={onSavedViewChange}
      savedViews={savedViews}
      onSaveView={onSaveView}
      trailing={trailing}
    >
      <div className="ent-search-wrap">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          className="w-full"
        />
        {showCommandPaletteHint ? (
          <kbd className="ent-search-kbd" aria-hidden>
            <span>⌘</span>K
          </kbd>
        ) : null}
      </div>
      <div className="crm-list-filter-bar__actions">
        <ErpButton
          type="button"
          variant="secondary"
          size="sm"
          icon={SlidersHorizontal}
          onClick={onOpenFilters}
          className="crm-list-filter-bar__btn shrink-0"
          aria-label={activeFilterCount > 0 ? `Filters (${activeFilterCount} active)` : 'Open filters'}
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" aria-hidden />
        </ErpButton>
        {sort}
        {afterFilters}
      </div>
    </SmartFilterBar>
  )
}
