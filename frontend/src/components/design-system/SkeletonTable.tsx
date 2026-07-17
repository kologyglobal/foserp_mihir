import { cn } from '../../utils/cn'

interface SkeletonTableProps {
  rows?: number
  cols?: number
  className?: string
  /** Show a register-style toolbar shimmer (search + actions) above the grid */
  showToolbar?: boolean
}

const COL_WIDTHS = ['14%', '18%', '12%', '10%', '12%', '11%', '10%', '13%']

/**
 * Register-style table shimmer — toolbar + header cells + row/column bars
 * until real data replaces it.
 */
export function SkeletonTable({
  rows = 8,
  cols = 6,
  className,
  showToolbar = true,
}: SkeletonTableProps) {
  const colCount = Math.max(3, Math.min(cols, COL_WIDTHS.length))

  return (
    <div
      className={cn(
        'overflow-hidden rounded-erp border border-erp-border bg-white shadow-erp',
        className,
      )}
      aria-busy="true"
      aria-label="Loading table"
      role="status"
    >
      {showToolbar ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-erp-border bg-white px-4 py-3">
          <div className="erp-skeleton h-9 min-w-[12rem] flex-1 rounded-lg" />
          <div className="erp-skeleton h-9 w-36 shrink-0 rounded-lg" />
          <div className="erp-skeleton h-9 w-24 shrink-0 rounded-lg" />
          <div className="erp-skeleton h-9 w-28 shrink-0 rounded-lg" />
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="flex items-center gap-3 border-b border-erp-border bg-white px-4 py-2.5">
            {Array.from({ length: colCount }).map((_, c) => (
              <div
                key={`h-${c}`}
                className="erp-skeleton h-3.5 rounded"
                style={{ width: COL_WIDTHS[c], flex: '0 0 auto' }}
              />
            ))}
          </div>

          <div className="divide-y divide-erp-border">
            {Array.from({ length: rows }).map((_, r) => (
              <div
                key={r}
                className="flex items-center gap-3 px-4 py-3.5"
                style={{ animationDelay: `${r * 40}ms` }}
              >
                {Array.from({ length: colCount }).map((__, c) => (
                  <div
                    key={c}
                    className="erp-skeleton h-4 rounded"
                    style={{
                      width: COL_WIDTHS[c],
                      flex: '0 0 auto',
                      opacity: 0.92 - c * 0.04,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Form / setup section shimmer (field labels + inputs) */
export function SkeletonForm({ rows = 8, className }: { rows?: number; className?: string }) {
  return (
    <div
      className={cn(
        'space-y-4 rounded-erp border border-erp-border bg-white p-4 shadow-erp',
        className,
      )}
      aria-busy="true"
      aria-label="Loading form"
      role="status"
    >
      <div className="erp-skeleton h-5 w-48 rounded" />
      <div className="erp-skeleton h-3 w-72 max-w-full rounded" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="erp-skeleton h-3 w-28 rounded" />
            <div className="erp-skeleton h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonInsightStrip({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-busy="true" role="status">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="erp-skeleton h-20 rounded-erp" />
      ))}
    </div>
  )
}
