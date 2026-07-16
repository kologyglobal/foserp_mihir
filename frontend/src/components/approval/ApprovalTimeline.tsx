import { Timeline, type TimelineEvent } from '../design-system/Timeline'

export function ApprovalTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-erp-muted">No approval events recorded.</p>
  }
  return <Timeline events={events} />
}

export { type TimelineEvent as ApprovalTimelineEvent }
