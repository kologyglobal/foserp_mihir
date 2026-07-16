import type { ReactNode } from 'react'
import { SearchInput } from './SearchInput'
import { cn } from '../../utils/cn'

interface FilterBarProps {
  search?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string
  children?: ReactNode
  className?: string
  resultCount?: number
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search records…',
  children,
  className,
  resultCount,
}: FilterBarProps) {
  return (
    <div className={cn('erp-list-toolbar', className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        {onSearchChange !== undefined && search !== undefined && (
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            className="w-full sm:w-80"
          />
        )}
        {resultCount != null && (
          <span className="text-[12px] font-medium text-erp-muted">
            {resultCount} record{resultCount === 1 ? '' : 's'}
          </span>
        )}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
