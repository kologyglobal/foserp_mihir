import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface SectionCardProps {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  noPadding?: boolean
  variant?: 'default' | 'flat'
}

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  noPadding,
  variant = 'default',
}: SectionCardProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-erp border border-erp-border bg-erp-surface',
        variant === 'default' && 'shadow-erp',
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-erp-border bg-gradient-to-r from-erp-surface-alt/80 to-erp-surface px-3 py-2">
          <div>
            {title && <h2 className="erp-section-title">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-erp-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(!noPadding && 'p-3', bodyClassName)}>{children}</div>
    </section>
  )
}
