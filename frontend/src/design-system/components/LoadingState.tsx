import { SkeletonForm, SkeletonTable } from '../../components/design-system/SkeletonTable'
import { cn } from '../../utils/cn'

export interface LoadingStateProps {
  variant?: 'table' | 'card' | 'form' | 'dashboard'
  rows?: number
  /** Column count for table shimmer (default 6) */
  cols?: number
  className?: string
}

export function LoadingState({
  variant = 'table',
  rows = 6,
  cols = 6,
  className,
}: LoadingStateProps) {
  if (variant === 'table') {
    return <SkeletonTable rows={rows} cols={cols} className={className} showToolbar />
  }

  if (variant === 'form') {
    return <SkeletonForm rows={rows} className={className} />
  }

  return (
    <div
      className={cn('ds-loading space-y-4 p-4', className)}
      aria-busy
      aria-label="Loading"
      role="status"
    >
      {variant === 'dashboard' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="erp-skeleton h-24 rounded-lg" />
          ))}
        </div>
      ) : null}
      <div className="erp-skeleton h-8 w-1/3 max-w-xs rounded" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="erp-skeleton h-10 rounded" />
        ))}
      </div>
    </div>
  )
}
