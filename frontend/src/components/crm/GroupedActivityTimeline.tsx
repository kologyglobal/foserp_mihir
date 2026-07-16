import { useMemo } from 'react'
import { Phone, Mail, MessageCircle, Calendar, MapPin, FileText, Clock } from 'lucide-react'
import type { CrmActivity } from '../../types/crm'
import { formatDateTime } from '../../utils/dates/format'
const TYPE_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  meeting: Calendar,
  site_visit: MapPin,
  note: FileText,
  stage_change: Clock,
  quotation_created: FileText,
  quotation_sent: FileText,
  follow_up_completed: Clock,
}

type ActivityGroup = 'Today' | 'Yesterday' | 'Earlier'

function groupLabel(iso: string): ActivityGroup {
  const d = iso.slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (d === today) return 'Today'
  if (d === yesterday) return 'Yesterday'
  return 'Earlier'
}

interface GroupedActivityTimelineProps {
  activities: CrmActivity[]
  limit?: number
  emptyMessage?: string
  lookup?: {
    customerName: (id: string) => string
    productName?: (id: string) => string
  }
}

export function GroupedActivityTimeline({
  activities,
  limit,
  emptyMessage = 'No activities yet.',
  lookup,
}: GroupedActivityTimelineProps) {
  const grouped = useMemo(() => {
    const sorted = [...activities].sort((a, b) => b.activityDate.localeCompare(a.activityDate))
    const slice = limit ? sorted.slice(0, limit) : sorted
    const map = new Map<ActivityGroup, CrmActivity[]>()
    for (const act of slice) {
      const g = groupLabel(act.activityDate)
      const list = map.get(g) ?? []
      list.push(act)
      map.set(g, list)
    }
    return (['Today', 'Yesterday', 'Earlier'] as ActivityGroup[])
      .filter((g) => map.has(g))
      .map((g) => ({ group: g, items: map.get(g)! }))
  }, [activities, limit])

  if (!grouped.length) {
    return <p className="crm-helper-text py-2">{emptyMessage}</p>
  }

  return (
    <div className="crm-activity-timeline">
      {grouped.map(({ group, items }) => (
        <section key={group} className="crm-activity-group">
          <h3 className="crm-activity-group-title">{group}</h3>
          <ul className="crm-activity-group-list">
            {items.map((act, idx) => {
              const Icon = TYPE_ICONS[act.type] ?? FileText
              const cust = act.customerId && lookup ? lookup.customerName(act.customerId) : null
              return (
                <li key={act.id} className="crm-activity-item">
                  {idx < items.length - 1 ? <span className="crm-activity-line" aria-hidden /> : null}
                  <div className="crm-activity-icon">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="crm-activity-body">
                    <div className="crm-activity-header">
                      <span className="crm-card-title">{act.subject}</span>
                      <span className="crm-helper-text capitalize">{act.type.replace(/_/g, ' ')}</span>
                    </div>
                    {cust ? <p className="crm-helper-text">{cust}</p> : null}
                    {act.description ? (
                      <p className="crm-body-text line-clamp-2">{act.description}</p>
                    ) : null}
                    <p className="crm-helper-text">
                      {act.ownerName} · {formatDateTime(act.activityDate)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
