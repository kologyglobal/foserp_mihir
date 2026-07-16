export interface TimelineEvent {
  id: string
  label: string
  timestamp?: string
  description?: string
  status?: 'done' | 'current' | 'pending'
  actor?: string
}

export function Timeline({ events, className }: { events: TimelineEvent[]; className?: string }) {
  return (
    <ol className={`relative space-y-0 ${className ?? ''}`}>
      {events.map((event, i) => {
        const isLast = i === events.length - 1
        const dotColor =
          event.status === 'done'
            ? 'bg-emerald-500 ring-emerald-100'
            : event.status === 'current'
              ? 'bg-[var(--erp-primary)] ring-blue-100'
              : 'bg-gray-300 ring-gray-100'
        return (
          <li key={event.id} className="relative flex gap-3 pb-5">
            {!isLast && (
              <span className="absolute left-[7px] top-4 h-[calc(100%-8px)] w-px bg-erp-border" aria-hidden />
            )}
            <span className={`relative z-10 mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ${dotColor}`} />
            <div className="min-w-0 flex-1 pt-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold text-erp-text">{event.label}</span>
                {event.timestamp && <span className="text-[11px] text-erp-muted">{event.timestamp}</span>}
              </div>
              {event.description && <p className="mt-0.5 text-[12px] text-erp-muted">{event.description}</p>}
              {event.actor && <p className="mt-0.5 text-[11px] text-erp-muted">by {event.actor}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function ActivityFeed({
  items,
  emptyMessage = 'No recent activity',
}: {
  items: { id: string; title: string; meta: string; time: string }[]
  emptyMessage?: string
}) {
  if (items.length === 0) {
    return <p className="py-4 text-center text-[13px] text-erp-muted">{emptyMessage}</p>
  }
  return (
    <ul className="divide-y divide-erp-border">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-erp-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-erp-text">{item.title}</p>
            <p className="text-[12px] text-erp-muted">{item.meta}</p>
          </div>
          <span className="shrink-0 text-[11px] text-erp-muted">{item.time}</span>
        </li>
      ))}
    </ul>
  )
}
