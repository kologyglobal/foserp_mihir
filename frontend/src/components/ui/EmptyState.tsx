import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-erp-primary-soft to-erp-surface-alt ring-1 ring-erp-primary/10">
        <Icon className="h-8 w-8 text-erp-primary" strokeWidth={1.5} />
      </div>
      <p className="text-[15px] font-semibold text-erp-text">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-erp-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
