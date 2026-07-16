import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface SmartEmptyStateProps {
  icon: LucideIcon
  title: string
  insight?: string
  healthNote?: string
  action?: ReactNode
  className?: string
}

/** Empty state that still communicates factory health — not a dead white panel */
export function SmartEmptyState({
  icon: Icon,
  title,
  insight,
  healthNote,
  action,
  className,
}: SmartEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-md border border-dashed border-erp-border bg-gradient-to-b from-erp-surface to-erp-surface-alt px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-erp-primary-soft text-erp-primary ring-1 ring-erp-primary/10">
        <Icon className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-semibold text-erp-text">{title}</p>
      {insight && <p className="mt-2 max-w-md text-[13px] leading-relaxed text-erp-muted">{insight}</p>}
      {healthNote && (
        <p className="mt-3 rounded-sm bg-erp-success-soft px-3 py-1.5 text-[12px] font-medium text-erp-success">
          {healthNote}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
