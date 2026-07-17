import {
  CrmListFilterBar,
  CrmListSortSelect,
  type CrmListSortOption,
} from '../crm/CrmListFilterBar'
import { cn } from '../../utils/cn'

export interface PurchaseSimpleListFilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  status: string
  onStatusChange: (value: string) => void
  statusOptions: CrmListSortOption[]
  statusAllLabel?: string
  statusAriaLabel?: string
  className?: string
}

/**
 * Purchase list toolbar for pages not yet on the full register + drawer path.
 * Same Search → Status/Sort alignment as PO list; never shows ⌘K.
 */
export function PurchaseSimpleListFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  status,
  onStatusChange,
  statusOptions,
  statusAllLabel = 'All statuses',
  statusAriaLabel = 'Filter by status',
  className,
}: PurchaseSimpleListFilterBarProps) {
  const statusLabel = statusOptions.find((o) => o.value === status)?.label
  const chips =
    status && statusLabel ? [{ id: 'status', label: statusLabel }] : []

  return (
    <CrmListFilterBar
      className={cn('crm-list-filter-bar--purchase mb-4', className)}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      activeFilterCount={status ? 1 : 0}
      showCommandPaletteHint={false}
      chips={chips}
      onRemoveChip={(id) => {
        if (id === 'status') onStatusChange('')
      }}
      onClearAll={() => {
        onSearchChange('')
        onStatusChange('')
      }}
      sort={
        <CrmListSortSelect
          value={status}
          onChange={onStatusChange}
          aria-label={statusAriaLabel}
          options={[{ value: '', label: statusAllLabel }, ...statusOptions]}
        />
      }
    />
  )
}
