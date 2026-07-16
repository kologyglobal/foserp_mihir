import { useMemo, useState } from 'react'
import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  Paperclip,
  Phone,
  Sparkles,
} from 'lucide-react'
import type { Lead } from '../../types/sales'
import type { CrmActivity, FollowUp } from '../../types/crm'
import type { DemoEntityNote } from '../../types/crmEntity'
import { EntityNotesPanel } from '../../components/crm/shared/EntityNotesPanel'
import { useCrmStore } from '../../store/crmStore'
import {
  filterActivitiesForLead,
  filterFollowUpsForLead,
  linkedOpportunityIdsForLead,
} from '../../utils/leadEngagement'
import {
  buildLeadEngagementTimeline,
  leadEngagementSummary,
  type LeadTimelineEntry,
} from '../../utils/leadEngagementTimeline'
import { ActivityTimeline } from '../../components/crm/ActivityTimeline'
import { LiveStatusBadge } from '../../components/premium/LiveStatusBadge'
import { Button } from '../../components/ui/Button'
import { cn } from '../../utils/cn'
import { formatRelativeTime } from '../../utils/dates/format'
const ACTIVITY_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  meeting: Calendar,
  site_visit: MapPin,
  note: FileText,
  follow_up_completed: CheckCircle2,
  sms: MessageCircle,
}

type EngagementFilter =
  | 'all'
  | 'timeline'
  | 'calls'
  | 'meetings'
  | 'emails'
  | 'whatsapp'
  | 'notes'
  | 'tasks'
  | 'attachments'

interface Enterprise360EngagementPanelProps {
  lead: Lead
  onLogActivity: () => void
  onScheduleFollowUp: () => void
  leadDemoNotes?: DemoEntityNote[]
  onOpenActivityNotes?: (activity: CrmActivity) => void
  onOpenFollowUpNotes?: (followUp: FollowUp) => void
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function matchesFilter(entry: LeadTimelineEntry, filter: EngagementFilter): boolean {
  if (filter === 'all' || filter === 'timeline') return true
  if (entry.kind === 'follow_up') return filter === 'tasks'
  const type = entry.activity?.type ?? ''
  if (filter === 'calls') return type === 'call'
  if (filter === 'meetings') return type === 'meeting' || type === 'site_visit'
  if (filter === 'emails') return type === 'email'
  if (filter === 'whatsapp') return type === 'whatsapp'
  if (filter === 'notes') return type === 'note'
  if (filter === 'attachments') return false
  return true
}

function TimelineEntryRow({
  entry,
  onCompleteFollowUp,
  onOpenActivityNotes,
  onOpenFollowUpNotes,
}: {
  entry: LeadTimelineEntry
  onCompleteFollowUp?: (id: string) => void
  onOpenActivityNotes?: (activity: CrmActivity) => void
  onOpenFollowUpNotes?: (followUp: FollowUp) => void
}) {
  if (entry.kind === 'activity' && entry.activity) {
    const act = entry.activity
    const Icon = ACTIVITY_ICONS[act.type] ?? Activity
    return (
      <div className="ent-360-timeline-entry">
        <div className="ent-360-timeline-entry__icon">
          <Icon className="h-4 w-4" />
        </div>
        <div className="ent-360-timeline-entry__body">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ent-360-timeline-entry__title">{act.subject}</span>
            <span className="ent-360-timeline-entry__badge">{act.type.replace(/_/g, ' ')}</span>
          </div>
          <p className="ent-360-timeline-entry__meta">{formatWhen(act.activityDate)} · {act.ownerName}</p>
          {act.description ? <p className="ent-360-timeline-entry__desc">{act.description}</p> : null}
          {onOpenActivityNotes ? (
            <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => onOpenActivityNotes(act)}>
              Notes
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  if (entry.kind === 'follow_up' && entry.followUp) {
    const fu = entry.followUp
    const isOpen = fu.status === 'pending' || fu.status === 'overdue'
    return (
      <div className={cn('ent-360-timeline-entry', fu.status === 'overdue' && 'ent-360-timeline-entry--risk')}>
        <div className="ent-360-timeline-entry__icon ent-360-timeline-entry__icon--task">
          <Calendar className="h-4 w-4" />
        </div>
        <div className="ent-360-timeline-entry__body">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ent-360-timeline-entry__title capitalize">{fu.followUpType.replace(/_/g, ' ')}</span>
            <LiveStatusBadge
              label={fu.status}
              tone={fu.status === 'overdue' ? 'critical' : fu.status === 'completed' ? 'healthy' : 'warning'}
              pulse={false}
            />
          </div>
          <p className="ent-360-timeline-entry__meta">Due {fu.dueDate} {fu.dueTime} · {fu.assignedToName}</p>
          {fu.notes ? <p className="ent-360-timeline-entry__desc">{fu.notes}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {onOpenFollowUpNotes ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => onOpenFollowUpNotes(fu)}>
                Notes
              </Button>
            ) : null}
            {isOpen && onCompleteFollowUp ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => onCompleteFollowUp(fu.id)}>
                Mark done
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return null
}

export function Enterprise360EngagementPanel({
  lead,
  onLogActivity,
  onScheduleFollowUp,
  leadDemoNotes = [],
  onOpenActivityNotes,
  onOpenFollowUpNotes,
}: Enterprise360EngagementPanelProps) {
  const activities = useCrmStore((s) => s.activities)
  const followUps = useCrmStore((s) => s.followUps)
  const opportunities = useCrmStore((s) => s.opportunities)
  const completeFollowUp = useCrmStore((s) => s.completeFollowUp)
  const [filter, setFilter] = useState<EngagementFilter>('all')

  const linkedOppIds = useMemo(
    () => linkedOpportunityIdsForLead(lead, opportunities),
    [lead, opportunities],
  )
  const leadActivities = useMemo(
    () => filterActivitiesForLead(lead, activities, linkedOppIds),
    [lead, activities, linkedOppIds],
  )
  const leadFollowUps = useMemo(
    () => filterFollowUpsForLead(lead, followUps, linkedOppIds),
    [lead, followUps, linkedOppIds],
  )
  const timeline = useMemo(
    () => buildLeadEngagementTimeline(leadActivities, leadFollowUps),
    [leadActivities, leadFollowUps],
  )
  const summary = useMemo(
    () => leadEngagementSummary(leadActivities, leadFollowUps),
    [leadActivities, leadFollowUps],
  )

  const filteredTimeline = useMemo(
    () => timeline.filter((e) => matchesFilter(e, filter)),
    [timeline, filter],
  )

  const upcoming = leadFollowUps.filter((f) => f.status === 'pending' || f.status === 'overdue')
  const recentCalls = leadActivities.filter((a) => a.type === 'call').slice(0, 3)
  const recentEmails = leadActivities.filter((a) => a.type === 'email').slice(0, 3)
  const openTasks = leadFollowUps.filter((f) => f.status === 'pending' || f.status === 'overdue')

  const tabs: { id: EngagementFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: timeline.length },
    { id: 'timeline', label: 'Timeline', count: timeline.length },
    { id: 'calls', label: 'Calls', count: leadActivities.filter((a) => a.type === 'call').length },
    { id: 'meetings', label: 'Meetings', count: leadActivities.filter((a) => a.type === 'meeting' || a.type === 'site_visit').length },
    { id: 'emails', label: 'Emails', count: leadActivities.filter((a) => a.type === 'email').length },
    { id: 'whatsapp', label: 'WhatsApp', count: leadActivities.filter((a) => a.type === 'whatsapp').length },
    { id: 'notes', label: 'Notes', count: leadActivities.filter((a) => a.type === 'note').length + (lead.remarks ? 1 : 0) },
    { id: 'tasks', label: 'Tasks', count: leadFollowUps.length },
  ]

  function handleCompleteFollowUp(id: string) {
    completeFollowUp(id, 'Completed from 360 workspace')
  }

  const hasSidebarContent =
    upcoming.length > 0 || openTasks.length > 0 || recentCalls.length > 0 || recentEmails.length > 0

  return (
    <div className="ent-360-engagement">
      <div className="ent-360-engagement__head">
        <div>
          <h2 className="ent-360-engagement__title">Activity Workspace</h2>
          <p className="ent-360-engagement__subtitle">
            {summary.lastTouch
              ? `Last touch ${formatRelativeTime(summary.lastTouch)}`
              : 'No engagement logged yet'}
          </p>
        </div>
        <div className="ent-360-engagement__head-actions">
          <Button type="button" size="sm" variant="secondary" onClick={onScheduleFollowUp}>
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            Follow-up
          </Button>
          <Button type="button" size="sm" onClick={onLogActivity}>
            <Activity className="h-3.5 w-3.5 shrink-0" />
            Log activity
          </Button>
        </div>
      </div>

      {hasSidebarContent ? (
        <div className="ent-360-engagement__widgets">
          {upcoming.length > 0 ? (
            <Widget title="Upcoming follow-ups" icon={Clock} count={upcoming.length}>
              {upcoming.slice(0, 3).map((fu) => (
                <p key={fu.id} className="ent-360-widget__line">
                  <span className="capitalize">{fu.followUpType.replace(/_/g, ' ')}</span>
                  <span className="text-erp-muted"> · {fu.dueDate}</span>
                </p>
              ))}
            </Widget>
          ) : null}
          {openTasks.length > 0 ? (
            <Widget title="Pending tasks" icon={CheckCircle2} count={openTasks.length}>
              {openTasks.slice(0, 3).map((fu) => (
                <p key={fu.id} className="ent-360-widget__line capitalize">{fu.followUpType.replace(/_/g, ' ')}</p>
              ))}
            </Widget>
          ) : null}
          {recentCalls.length > 0 ? (
            <Widget title="Recent calls" icon={Phone} count={recentCalls.length}>
              {recentCalls.map((a) => (
                <p key={a.id} className="ent-360-widget__line">{a.subject}</p>
              ))}
            </Widget>
          ) : null}
          {recentEmails.length > 0 ? (
            <Widget title="Recent emails" icon={Mail} count={recentEmails.length}>
              {recentEmails.map((a) => (
                <p key={a.id} className="ent-360-widget__line">{a.subject}</p>
              ))}
            </Widget>
          ) : null}
          <Widget title="AI suggestions" icon={Sparkles}>
            <p className="ent-360-widget__line text-violet-700">Schedule a follow-up within 2 days</p>
            <p className="ent-360-widget__line text-violet-700">Send product brochure via email</p>
          </Widget>
        </div>
      ) : (
        <div className="ent-360-engagement__empty-widgets">
          <Widget title="Get started" icon={Sparkles}>
            <p className="ent-360-widget__line">Log your first call or schedule a follow-up to build the relationship timeline.</p>
            <div className="ent-360-widget__actions">
              <Button type="button" size="sm" onClick={onLogActivity}>
                <Phone className="h-3.5 w-3.5 shrink-0" />
                Log call
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={onScheduleFollowUp}>
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                Schedule follow-up
              </Button>
            </div>
          </Widget>
        </div>
      )}

      <div className="ent-360-engagement__tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            className={cn('ent-360-engagement__tab', filter === tab.id && 'ent-360-engagement__tab--active')}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
            <span className="ent-360-engagement__tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="ent-360-engagement__content">
        {filter === 'notes' ? (
          <EntityNotesPanel entityType="LEAD" entityId={lead.id} demoNotes={leadDemoNotes} title="Lead notes" />
        ) : filter === 'attachments' ? (
          <div className="ent-360-engagement__empty">
            <Paperclip className="h-8 w-8 text-erp-muted/50" />
            <p className="font-medium">No attachments yet</p>
            <p className="text-[13px] text-erp-muted">Upload drawings, RFQs, or PDFs from the documents section.</p>
          </div>
        ) : filteredTimeline.length === 0 ? (
          <div className="ent-360-engagement__empty">
            <Activity className="h-8 w-8 text-erp-muted/50" />
            <p className="font-medium">No activity in this view</p>
            <p className="text-[13px] text-erp-muted">Try another filter or log a new interaction.</p>
          </div>
        ) : (
          <div className="ent-360-timeline">
            {filteredTimeline.map((entry) => (
              <TimelineEntryRow
                key={entry.id}
                entry={entry}
                onCompleteFollowUp={handleCompleteFollowUp}
                onOpenActivityNotes={onOpenActivityNotes}
                onOpenFollowUpNotes={onOpenFollowUpNotes}
              />
            ))}
          </div>
        )}

        {filter === 'calls' && leadActivities.filter((a) => a.type === 'call').length > 0 ? (
          <ActivityTimeline activities={leadActivities.filter((a) => a.type === 'call')} emptyMessage="" />
        ) : null}
      </div>
    </div>
  )
}

function Widget({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string
  icon: typeof Clock
  count?: number
  children: React.ReactNode
}) {
  return (
    <div className="ent-360-widget">
      <p className="ent-360-widget__title">
        <Icon className="h-3.5 w-3.5" />
        {title}
        {count != null ? <span className="ent-360-widget__count">{count}</span> : null}
      </p>
      <div className="ent-360-widget__body">{children}</div>
    </div>
  )
}
