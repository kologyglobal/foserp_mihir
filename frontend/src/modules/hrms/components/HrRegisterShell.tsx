import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/forms/Inputs'
import { cn } from '@/utils/cn'

interface HrRegisterShellProps {
  /** Free-text search box — omit to hide. */
  search?: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
  }
  /** Filter Select/FormField controls rendered inline beside the search box. */
  filters?: ReactNode
  /** Table (or empty/loading state) card content. */
  children: ReactNode
  /** Pagination footer — omit when the list has a single page. */
  pagination?: {
    page: number
    totalPages: number
    total: number
    onPageChange: (page: number) => void
  }
  className?: string
}

/** Standard register layout: search + filter row, table card, pagination footer. */
export function HrRegisterShell({ search, filters, children, pagination, className }: HrRegisterShellProps) {
  return (
    <div className={cn('hr-register-shell', className)}>
      {(search || filters) && (
        <div className="hr-register-shell__toolbar">
          {search ? (
            <div className="hr-register-shell__search">
              <Search className="hr-register-shell__search-icon" aria-hidden />
              <Input
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder ?? 'Search…'}
                className="hr-register-shell__search-input"
              />
            </div>
          ) : null}
          {filters ? <div className="hr-register-shell__filters">{filters}</div> : null}
        </div>
      )}

      <div className="hr-register-shell__table-card">{children}</div>

      {pagination && pagination.totalPages > 1 ? (
        <div className="hr-register-shell__pagination">
          <span className="hr-register-shell__pagination-summary">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
          </span>
          <div className="hr-register-shell__pagination-buttons">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
