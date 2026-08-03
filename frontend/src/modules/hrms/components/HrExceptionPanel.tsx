import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface HrExceptionItem {
  id: string
  label: string
  /** Real count only — omit rather than fabricate a number. */
  count?: number
  to: string
  icon?: LucideIcon
  tone?: 'warning' | 'critical' | 'info'
}

interface HrExceptionPanelProps {
  title: string
  items: HrExceptionItem[]
  emptyLabel?: string
  className?: string
}

const toneClass: Record<NonNullable<HrExceptionItem['tone']>, string> = {
  warning: 'hr-exception-panel__count--warning',
  critical: 'hr-exception-panel__count--critical',
  info: 'hr-exception-panel__count--info',
}

/** "Needs attention" list — permission-gated links with optional real counts, never fabricated numbers. */
export function HrExceptionPanel({ title, items, emptyLabel = 'Nothing needs attention right now', className }: HrExceptionPanelProps) {
  return (
    <section className={cn('hr-exception-panel', className)}>
      <h3 className="hr-exception-panel__title">{title}</h3>
      {items.length === 0 ? (
        <p className="hr-exception-panel__empty">{emptyLabel}</p>
      ) : (
        <ul className="hr-exception-panel__list">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.id}>
                <Link to={item.to} className="hr-exception-panel__row">
                  <span className="hr-exception-panel__row-main">
                    {Icon ? <Icon className="hr-exception-panel__icon" aria-hidden /> : null}
                    <span>{item.label}</span>
                  </span>
                  <span className="hr-exception-panel__row-end">
                    {item.count != null ? (
                      <span className={cn('hr-exception-panel__count', item.tone ? toneClass[item.tone] : undefined)}>
                        {item.count}
                      </span>
                    ) : (
                      <span className="hr-exception-panel__open">Open</span>
                    )}
                    <ChevronRight className="hr-exception-panel__chevron" aria-hidden />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
