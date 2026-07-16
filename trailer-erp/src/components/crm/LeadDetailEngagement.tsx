import { useMemo, useState } from 'react'
import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  FileText,
} from 'lucide-react'
import type { Lead } from '../../types/sales'
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
import { ActivityTimeline } from './ActivityTimeline'
import { LiveStatusBadge } from '../premium/LiveStatusBadge'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'

const ACTIVITY_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  meeting: Calendar,
  site_visit: MapPin,
  note: FileText,
  follow_up_completed: CheckCircle2,
}

type EngagementView = 'timeline' | 'activities' | 'followups'

interface LeadDetailEngagementProps {
  lead: Lead
  onLogActivity: () => void
  onScheduleFollowUp: () => void
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function TimelineEntryRow({ entry, onCompleteFollowUp }: { entry: LeadTimelineEntry; onCompleteFollowUp?: (id: string) => void }) {
  if (entry.kind === 'activity' && entry.activity) {
    const act = entry.activity
    const Icon = ACTIVITY_ICONS[act.type] ?? Activity
    return (
      <div className="lead-timeline-entry">
        <div className="lead-timeline-icon lead-timeline-icon-activity">
          <Icon className="h-4 w-4" />
        </div>
        <div className="lead-timeline-body">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-erp-text">{act.subject}</span>
            <span className="rounded-full bg-erp-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-erp-primary">
              {act.type.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-erp-muted">{formatWhen(act.activityDate)} · {act.ownerName}</p>
          {act.description ? <p className="mt-1.5 text-[13px] text-erp-text">{act.description}</p> : null}
          {act.outcome ? (
            <span className="mt-2 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              {act.outcome}
            </span>
          ) : null}
        </div>
      </div>
    )
  }

  if (entry.kind === 'follow_up' && entry.followUp) {
    const fu = entry.followUp
    const isOpen = fu.status === 'pending' || fu.status === 'overdue'
    return (
      <div className={cn('lead-timeline-entry', fu.status === 'overdue' && 'lead-timeline-entry-risk')}>
        <div className={cn('lead-timeline-icon', isOpen ? 'lead-timeline-icon-followup' : 'lead-timeline-icon-done')}>
          <Calendar className="h-4 w-4" />
        </div>
        <div className="lead-timeline-body">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold capitalize text-erp-text">
              {fu.followUpType.replace(/_/g, ' ')}
            </span>
            <LiveStatusBadge
              label={fu.status}
              tone={fu.status === 'overdue' ? 'critical' : fu.status === 'completed' ? 'healthy' : 'warning'}
              pulse={false}
            />
          </div>
          <p className="mt-0.5 text-[11px] text-erp-muted">
            Due {fu.dueDate} {fu.dueTime} · {fu.assignedToName}
          </p>
          {fu.notes ? <p className="mt-1.5 text-[13px] text-erp-text">{fu.notes}</p> : null}
          {fu.outcome ? (
            <p className="mt-1 text-[11px] font-medium text-emerald-700">Outcome: {fu.outcome}</p>
          ) : null}
          {isOpen && onCompleteFollowUp ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={() => onCompleteFollowUp(fu.id)}
            >
              Mark done
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  return null
}

export function LeadDetailEngagement({ lead, onLogActivity, onScheduleFollowUp }: LeadDetailEngagementProps) {
  const activities = useCrmStore((s) => s.activities)
  const followUps = useCrmStore((s) => s.followUps)
  const opportunities = useCrmStore((s) => s.opportunities)
  const completeFollowUp = useCrmStore((s) => s.completeFollowUp)
  const [view, setView] = useState<EngagementView>('timeline')

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

  const upcoming = leadFollowUps.filter((f) => f.status === 'pending' || f.status === 'overdue')

  function handleCompleteFollowUp(id: string) {
    completeFollowUp(id, 'Completed from lead detail')
  }

  const tabs: { id: EngagementView; label: string; count: number }[] = [
    { id: 'timeline', label: 'Timeline', count: timeline.length },
    { id: 'activities', label: 'Activities', count: leadActivities.length },
    { id: 'followups', label: 'Follow-ups', count: leadFollowUps.length },
  ]

  return (
    <div className="lead-engagement-panel">
      <div className="lead-engagement-toolbar">
        <div>
          <h2 className="text-[15px] font-semibold text-erp-text">Engagement & activity log</h2>
          <p className="text-[12px] text-erp-muted">
            {summary.lastTouch
              ? `Last touch ${new Date(summary.lastTouch).toLocaleDateString('en-IN')}`
              : 'No engagement logged yet'}
            {summary.overdueFollowUps > 0 ? ` · ${summary.overdueFollowUps} overdue` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={onScheduleFollowUp}>
            <Calendar className="h-3.5 w-3.5" />
            Schedule follow-up
          </Button>
          <Button type="button" size="sm" onClick={onLogActivity}>
            <Activity className="h-3.5 w-3.5" />
            Log activity
          </Button>
        </div>
      </div>

      <div className="lead-engagement-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            className={cn('lead-engagement-tab', view === tab.id && 'lead-engagement-tab-active')}
            onClick={() => setView(tab.id)}
          >
            {tab.label}
            <span className="lead-engagement-tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      {upcoming.length > 0 && view === 'timeline' ? (
        <section className="lead-engagement-upcoming">
          <h3 className="lead-engagement-section-title">
            <Clock className="h-3.5 w-3.5" />
            Upcoming & overdue ({upcoming.length})
          </h3>
          <div className="space-y-2">
            {upcoming.map((fu) => (
              <div
                key={fu.id}
                className={cn(
                  'rounded-lg border px-3 py-2.5',
                  fu.status === 'overdue' ? 'border-red-200 bg-red-50/70' : 'border-erp-border bg-erp-surface-alt/50',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium capitalize text-erp-text">
                    {fu.followUpType.replace(/_/g, ' ')}
                  </span>
                  <LiveStatusBadge
                    label={fu.status}
                    tone={fu.status === 'overdue' ? 'critical' : 'warning'}
                    pulse={false}
                  />
                </div>
                <p className="mt-0.5 text-[11px] text-erp-muted">
                  {fu.dueDate} · {fu.dueTime}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="lead-engagement-content">
        {view === 'timeline' && (
          timeline.length === 0 ? (
            <div className="lead-engagement-empty">
              <Activity className="h-8 w-8 text-erp-muted/50" />
              <p className="font-medium text-erp-text">No engagement yet</p>
              <p className="text-[13px] text-erp-muted">Log a call or schedule a follow-up to start the timeline.</p>
              <div className="mt-3 flex gap-2">
                <Button type="button" size="sm" onClick={onLogActivity}>Log activity</Button>
                <Button type="button" size="sm" variant="secondary" onClick={onScheduleFollowUp}>Schedule follow-up</Button>
              </div>
            </div>
          ) : (
            <div className="lead-timeline-list">
              {timeline.map((entry) => (
                <TimelineEntryRow key={entry.id} entry={entry} onCompleteFollowUp={handleCompleteFollowUp} />
              ))}
            </div>
          )
        )}

        {view === 'activities' && (
          <ActivityTimeline
            activities={leadActivities}
            emptyMessage="No activities logged for this lead."
          />
        )}

        {view === 'followups' && (
          leadFollowUps.length === 0 ? (
            <div className="lead-engagement-empty">
              <Calendar className="h-8 w-8 text-erp-muted/50" />
              <p className="font-medium text-erp-text">No follow-ups scheduled</p>
              <Button type="button" size="sm" className="mt-3" onClick={onScheduleFollowUp}>
                Schedule follow-up
              </Button>
            </div>
          ) : (
            <ul className="space-y-2">
              {leadFollowUps.map((fu) => (
                <li
                  key={fu.id}
                  className={cn(
                    'rounded-lg border p-3',
                    fu.status === 'overdue' ? 'border-red-200 bg-red-50/60' : 'border-erp-border bg-erp-surface',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium capitalize text-erp-text">{fu.followUpType.replace(/_/g, ' ')}</span>
                    <LiveStatusBadge
                      label={fu.status}
                      tone={fu.status === 'overdue' ? 'critical' : fu.status === 'completed' ? 'healthy' : 'warning'}
                      pulse={false}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-erp-muted">
                    {fu.dueDate} · {fu.dueTime} · {fu.assignedToName}
                  </p>
                  {fu.notes ? <p className="mt-1.5 text-[13px] text-erp-text">{fu.notes}</p> : null}
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  )
}
