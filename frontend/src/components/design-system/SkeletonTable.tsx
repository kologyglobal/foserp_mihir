import { cn } from '../../utils/cn'

interface SkeletonTableProps {
  rows?: number
  cols?: number
  className?: string
}

export function SkeletonTable({ rows = 8, cols = 6, className }: SkeletonTableProps) {
  return (
    <div className={cn('overflow-hidden rounded-erp border border-erp-border bg-erp-surface', className)}>
      <div className="border-b border-erp-border bg-erp-surface-alt px-4 py-3">
        <div className="erp-skeleton h-8 w-full max-w-md rounded-md" />
      </div>
      <div className="divide-y divide-erp-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-3 px-4 py-3">
            {Array.from({ length: cols }).map((__, c) => (
              <div
                key={c}
                className="erp-skeleton h-4 flex-1 rounded"
                style={{ maxWidth: c === 0 ? '120px' : undefined, opacity: 1 - c * 0.08 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonInsightStrip({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="erp-skeleton h-20 rounded-erp" />
      ))}
    </div>
  )
}
