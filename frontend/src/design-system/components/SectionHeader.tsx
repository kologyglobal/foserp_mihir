import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export interface SectionHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function SectionHeader({ title, description, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn('ds-section-header flex flex-wrap items-start justify-between gap-3 border-b border-[var(--dyn-border)] pb-3', className)}>
      <div className="min-w-0">
        <h2 className="ds-type-section-title font-semibold text-[var(--dyn-text)]">{title}</h2>
        {description ? <p className="ds-type-caption mt-1 text-[var(--dyn-text-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
