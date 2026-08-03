import { cn } from '@/utils/cn'

export interface HrTimelineItem {
  id: string
  label: string
  timestamp?: string | null
  description?: string | null
  tone?: 'success' | 'warning' | 'critical' | 'info' | 'neutral'
}

interface HrTimelineProps {
  items: HrTimelineItem[]
  emptyLabel?: string
  className?: string
}

const dotToneClass: Record<NonNullable<HrTimelineItem['tone']>, string> = {
  success: 'hr-timeline__dot--success',
  warning: 'hr-timeline__dot--warning',
  critical: 'hr-timeline__dot--critical',
  info: 'hr-timeline__dot--info',
  neutral: 'hr-timeline__dot--neutral',
}

/** Simple vertical timeline — attendance exception history, approval trails, etc. */
export function HrTimeline({ items, emptyLabel = 'Nothing to show', className }: HrTimelineProps) {
  if (items.length === 0) {
    return <p className="hr-timeline__empty">{emptyLabel}</p>
  }
  return (
    <ol className={cn('hr-timeline', className)}>
      {items.map((item) => (
        <li key={item.id} className="hr-timeline__item">
          <span className={cn('hr-timeline__dot', dotToneClass[item.tone ?? 'neutral'])} aria-hidden />
          <div className="hr-timeline__content">
            <div className="hr-timeline__row">
              <span className="hr-timeline__label">{item.label}</span>
              {item.timestamp ? <span className="hr-timeline__timestamp">{item.timestamp}</span> : null}
            </div>
            {item.description ? <p className="hr-timeline__description">{item.description}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
