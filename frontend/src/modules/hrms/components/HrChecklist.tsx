import type { ReactNode } from 'react'
import { Check, Clock, X } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface HrChecklistItem {
  id: string
  title: string
  subtitle?: ReactNode
  state: 'done' | 'pending' | 'waived'
  actions?: ReactNode
}

interface HrChecklistProps {
  items: HrChecklistItem[]
  className?: string
}

const iconByState: Record<HrChecklistItem['state'], ReactNode> = {
  done: <Check className="h-3.5 w-3.5" />,
  pending: <Clock className="h-3.5 w-3.5" />,
  waived: <X className="h-3.5 w-3.5" />,
}

/** Visual checklist for exit clearance / asset return lines — status icon + title + inline actions. */
export function HrChecklist({ items, className }: HrChecklistProps) {
  return (
    <ul className={cn('hr-checklist', className)}>
      {items.map((item) => (
        <li key={item.id} className={cn('hr-checklist__item', `hr-checklist__item--${item.state}`)}>
          <span className="hr-checklist__icon" aria-hidden>
            {iconByState[item.state]}
          </span>
          <div className="hr-checklist__body">
            <div className="hr-checklist__title">{item.title}</div>
            {item.subtitle ? <div className="hr-checklist__subtitle">{item.subtitle}</div> : null}
          </div>
          {item.actions ? <div className="hr-checklist__actions">{item.actions}</div> : null}
        </li>
      ))}
    </ul>
  )
}
