import type { ReactNode } from 'react'
import { SmartFilterBar, type FilterChip } from '../design-system/SmartFilterBar'
import { SearchInput } from '../ui/SearchInput'
import { Select } from '../forms/Inputs'
import { cn } from '../../utils/cn'

interface FilterOption {
  value: string
  label: string
}

export interface MasterRegisterFilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  statusFilter?: string
  onStatusFilterChange?: (value: string) => void
  statusOptions?: FilterOption[]
  chips?: FilterChip[]
  onRemoveChip?: (id: string) => void
  onClearAll?: () => void
  resultCount?: number
  savedView?: string
  onSavedViewChange?: (view: string) => void
  trailing?: ReactNode
  className?: string
}

/** Embedded register filter — matches CRM list filter bar styling */
export function MasterRegisterFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search records…',
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  chips = [],
  onRemoveChip,
  onClearAll,
  resultCount,
  savedView,
  onSavedViewChange,
  trailing,
  className,
}: MasterRegisterFilterBarProps) {
  return (
    <SmartFilterBar
      className={cn('crm-list-filter-bar masters-list-filter-bar masters-list-filter-bar--embedded', className)}
      chips={chips}
      onRemoveChip={onRemoveChip}
      onClearAll={chips.length > 0 ? onClearAll : undefined}
      resultCount={resultCount}
      savedView={savedView}
      onSavedViewChange={onSavedViewChange}
      savedViews={['All Records', 'Active Only', 'My View']}
      trailing={trailing}
    >
      <div className="ent-search-wrap">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          className="w-full"
        />
        <kbd className="ent-search-kbd" aria-hidden>
          <span>⌘</span>K
        </kbd>
      </div>
      <div className="crm-list-filter-bar__actions">
        {statusOptions && onStatusFilterChange ? (
          <Select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="crm-list-filter-bar__sort-select h-9 min-w-[9.5rem] max-w-[11rem] shrink-0 py-0 text-[13px]"
            aria-label="Status filter"
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        ) : null}
      </div>
    </SmartFilterBar>
  )
}
