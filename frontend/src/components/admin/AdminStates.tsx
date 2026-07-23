import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { AlertTriangle, Inbox } from 'lucide-react'
import { EmptyState } from '../ui/EmptyState'
import { cn } from '../../utils/cn'

export function AdminEmptyState({
  icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return <EmptyState icon={icon} title={title} description={description} action={action} className={className} />
}

export function AdminErrorState({
  title = 'Something went wrong',
  description,
  action,
  className,
}: {
  title?: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title={title}
      description={description ?? 'Try again, or contact your administrator if the problem continues.'}
      action={action}
      className={className}
    />
  )
}

export function AdminSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-erp-surface-alt" />
      ))}
    </div>
  )
}
