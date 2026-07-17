import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'
import { DEFAULT_SAVED_VIEWS } from '../../utils/pageNavigation'
import { FilterBarFieldContext } from './filterBarContext'
import { Select } from '../forms/Inputs'

export interface FilterChip {
  id: string
  label: string
}

interface SmartFilterBarProps {
  children?: ReactNode
  /** Second row — toggles, extra filters */
  secondary?: ReactNode
  /** Right-aligned controls before record count / saved view (e.g. sort) */
  trailing?: ReactNode
  chips?: FilterChip[]
  onRemoveChip?: (id: string) => void
  onClearAll?: () => void
  savedView?: string
  onSavedViewChange?: (view: string) => void
  savedViews?: readonly string[]
  /** Opens save-view dialog — renders "Save as…" beside the view picker */
  onSaveView?: () => void
  resultCount?: number
  className?: string
}

/** Compact filter row — designed to sit inside page hero */
export function SmartFilterBar({
  children,
  secondary,
  trailing,
  chips = [],
  onRemoveChip,
  onClearAll,
  savedView = 'My View',
  onSavedViewChange,
  savedViews = DEFAULT_SAVED_VIEWS,
  onSaveView,
  resultCount,
  className,
}: SmartFilterBarProps) {
  return (
    <FilterBarFieldContext.Provider value>
      <div className={cn('erp-smart-filter', className)}>
        <div className="flex items-center gap-x-3 gap-y-2">
          <div className="erp-smart-filter-fields flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {children}
          </div>
          <div className="erp-smart-filter-meta ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
            {trailing}
            {resultCount != null && (
              <span className="whitespace-nowrap text-[11px] font-medium tabular-nums text-erp-muted">
                {resultCount} records
              </span>
            )}
            {resultCount != null && onSavedViewChange && (
              <span className="hidden text-erp-border sm:inline" aria-hidden>·</span>
            )}
            {onSavedViewChange && (
              <label className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-erp-muted">
                <span className="font-medium text-erp-text">Saved view</span>
                <Select
                  value={savedView}
                  onChange={(e) => onSavedViewChange(e.target.value)}
                  className="h-8 min-w-[8rem] py-0"
                  aria-label="Saved view"
                >
                  {savedViews.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </Select>
              </label>
            )}
            {onSaveView && (
              <button
                type="button"
                onClick={onSaveView}
                className="whitespace-nowrap rounded-md border border-erp-primary/25 bg-erp-primary-soft/40 px-2 py-1 text-[11px] font-semibold text-erp-primary hover:bg-erp-primary-soft"
              >
                Save view
              </button>
            )}
          </div>
        </div>
        {secondary && (
          <div className="erp-smart-filter-secondary mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-erp-border/70 pt-2">
            {secondary}
          </div>
        )}
        {(chips.length > 0 || onClearAll) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-erp-border pt-2">
            {chips.length > 0 && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Filters</span>
            )}
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
            {chips.length > 0 && onClearAll && (
              <button type="button" onClick={onClearAll} className="text-[11px] font-semibold text-erp-primary hover:underline">
                Clear
              </button>
            )}
          </div>
        )}
      </div>
    </FilterBarFieldContext.Provider>
  )
}
