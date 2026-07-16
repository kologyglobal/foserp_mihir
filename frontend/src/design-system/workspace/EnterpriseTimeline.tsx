import { cn } from '../../utils/cn'
import type { EnterpriseTimelineEvent } from './types'

export function EnterpriseTimeline({ events, title = 'Timeline' }: { events: EnterpriseTimelineEvent[]; title?: string }) {
  if (!events.length) return null

  return (
    <div className="ent-ws-timeline">
      <p className="ent-ws-timeline__title">{title}</p>
      <ol className="ent-ws-timeline__list">
        {events.map((event) => (
          <li key={event.id} className={cn('ent-ws-timeline__item', event.status === 'current' && 'ent-ws-timeline__item--current')}>
            <span className="ent-ws-timeline__dot" aria-hidden />
            <div className="ent-ws-timeline__body">
              <p className="ent-ws-timeline__label">{event.label}</p>
              <p className="ent-ws-timeline__meta">
                {event.time}
                {event.actor ? ` · ${event.actor}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
