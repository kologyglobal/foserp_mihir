import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'

export type FioriTabItem<T extends string = string> = {
  id: T
  label: string
  icon?: LucideIcon
}

export function FioriSegmentedView<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  tabs: FioriTabItem<T>[]
  value: T
  onChange: (id: T) => void
  ariaLabel: string
  className?: string
}) {
  return (
    <div className={cn('fiori-icon-tab-bar', className)} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = tab.id === value
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn('fiori-icon-tab', active && 'fiori-icon-tab--active')}
            onClick={() => onChange(tab.id)}
          >
            {Icon ? <Icon className="fiori-icon-tab__icon h-4 w-4" aria-hidden /> : null}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function FioriToolbarShell({
  tabs,
  actions,
}: {
  tabs: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="fiori-toolbar-shell">
      {tabs}
      {actions ? <div className="fiori-toolbar-actions">{actions}</div> : null}
    </div>
  )
}
