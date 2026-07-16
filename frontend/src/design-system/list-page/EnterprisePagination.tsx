import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100]

export function EnterprisePagination({
  from,
  to,
  total,
  pageIndex,
  pageCount,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  from: number
  to: number
  total: number
  pageIndex: number
  pageCount: number
  pageSize: number
  pageSizeOptions?: number[]
  onPageChange: (index: number) => void
  onPageSizeChange?: (size: number) => void
  className?: string
}) {
  if (total <= 0) return null

  const pages = buildPageNumbers(pageIndex, pageCount)

  return (
    <div className={cn('ent-pagination', className)}>
      <p className="ent-pagination__summary">
        Showing <span className="font-medium text-erp-text">{from}</span>–<span className="font-medium text-erp-text">{to}</span> of{' '}
        <span className="font-medium text-erp-text">{total}</span>
      </p>
      <div className="ent-pagination__controls">
        {onPageSizeChange ? (
          <label className="ent-pagination__page-size">
            <span className="text-erp-muted">Rows:</span>
            <span className="relative">
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="ent-pagination__select"
                aria-label="Rows per page"
              >
                {pageSizeOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-erp-muted" />
            </span>
          </label>
        ) : null}
        <div className="ent-pagination__nav">
          <button
            type="button"
            className="ent-pagination__btn"
            disabled={pageIndex <= 0}
            onClick={() => onPageChange(pageIndex - 1)}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`ellipsis-${i}`} className="ent-pagination__ellipsis">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={cn('ent-pagination__page', p === pageIndex && 'ent-pagination__page--active')}
                onClick={() => onPageChange(p as number)}
                aria-current={p === pageIndex ? 'page' : undefined}
              >
                {(p as number) + 1}
              </button>
            ),
          )}
          <button
            type="button"
            className="ent-pagination__btn"
            disabled={pageIndex >= pageCount - 1}
            onClick={() => onPageChange(pageIndex + 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function buildPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  const pages: (number | '…')[] = [0]
  if (current > 2) pages.push('…')
  for (let i = Math.max(1, current - 1); i <= Math.min(total - 2, current + 1); i++) {
    pages.push(i)
  }
  if (current < total - 3) pages.push('…')
  pages.push(total - 1)
  return pages
}
