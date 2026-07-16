import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

export function DynamicsDashboardPanel({
  title,
  actions,
  children,
  className,
  noPadding,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  noPadding?: boolean
}) {
  return (
    <section className={cn('dyn-panel', className)}>
      <div className="dyn-panel-header">
        <h3 className="dyn-panel-title">{title}</h3>
        {actions}
      </div>
      <div className={cn(!noPadding && 'dyn-panel-body')}>{children}</div>
    </section>
  )
}

export function DynamicsDashboardGrid({ children }: { children: ReactNode }) {
  return <div className="dyn-dashboard-grid">{children}</div>
}
