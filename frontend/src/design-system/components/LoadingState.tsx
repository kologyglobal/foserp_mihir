import { SkeletonTable } from '../../components/design-system/SkeletonTable'
import { cn } from '../../utils/cn'

export interface LoadingStateProps {
  variant?: 'table' | 'card' | 'form' | 'dashboard'
  rows?: number
  className?: string
}

export function LoadingState({ variant = 'table', rows = 6, className }: LoadingStateProps) {
  if (variant === 'table') {
    return <SkeletonTable rows={rows} className={className} />
  }

  return (
    <div className={cn('ds-loading animate-pulse space-y-4 p-4', className)} aria-busy aria-label="Loading">
      {variant === 'dashboard' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-[var(--dyn-bg-sidebar)]" />
          ))}
        </div>
      ) : null}
      <div className="h-8 w-1/3 rounded bg-[var(--dyn-bg-sidebar)]" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 rounded bg-[var(--dyn-bg-sidebar)]" />
        ))}
      </div>
    </div>
  )
}
