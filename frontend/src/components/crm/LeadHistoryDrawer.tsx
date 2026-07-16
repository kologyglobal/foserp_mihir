import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Calendar, ExternalLink } from 'lucide-react'
import type { Lead } from '../../types/sales'
import { useCrmStore } from '../../store/crmStore'
import {
  filterActivitiesForLead,
  filterFollowUpsForLead,
  linkedOpportunityIdsForLead,
} from '../../utils/leadEngagement'
import { buildLeadEngagementTimeline } from '../../utils/leadEngagementTimeline'
import { ActivityTimeline } from './ActivityTimeline'
import { LiveStatusBadge } from '../premium/LiveStatusBadge'
import { formatStatus } from '../ui/Badge'
import { formatDate, formatDateTime } from '../../utils/dates/format'
import { leadStageLabel } from '../../utils/leadUtils'
import { cn } from '../../utils/cn'
import { CrmDrawerShell } from './CrmDrawerShell'
import { ErpButton } from '../erp/ErpButton'

interface LeadHistoryDrawerProps {
  open: boolean
  lead: Lead | null
  leadViewPath?: string
  onClose: () => void
  onScheduleFollowUp?: () => void
  onLogActivity?: () => void
}

export function LeadHistoryDrawer({
  open,
  lead,
  leadViewPath,
  onClose,
  onScheduleFollowUp,
  onLogActivity,
}: LeadHistoryDrawerProps) {
  const navigate = useNavigate()
  const activities = useCrmStore((s) => s.activities)
  const followUps = useCrmStore((s) => s.followUps)
  const opportunities = useCrmStore((s) => s.opportunities)

  const linkedOppIds = useMemo(
    () => (lead ? linkedOpportunityIdsForLead(lead, opportunities) : []),
    [lead, opportunities],
  )
  const leadActivities = useMemo(
    () => (lead ? filterActivitiesForLead(lead, activities, linkedOppIds) : []),
    [lead, activities, linkedOppIds],
  )
  const leadFollowUps = useMemo(
    () => (lead ? filterFollowUpsForLead(lead, followUps, linkedOppIds) : []),
    [lead, followUps, linkedOppIds],
  )
  const timeline = useMemo(
    () => buildLeadEngagementTimeline(leadActivities, leadFollowUps),
    [leadActivities, leadFollowUps],
  )

  if (!lead) return null

  const linkedOpp = lead.opportunityId ? opportunities.find((o) => o.id === lead.opportunityId) : undefined
  const pendingFollowUps = leadFollowUps.filter((f) => f.status === 'pending' || f.status === 'overdue')
  const subtitle = `${lead.leadNo} · ${lead.prospectName}`

  return (
    <CrmDrawerShell
      open={open}
      title="Lead History"
      subtitle={subtitle}
      onClose={onClose}
      width="lg"
      footer={
        <div className="flex w-full justify-end gap-2">
          <ErpButton type="button" variant="ghost" onClick={onClose}>
            Close
          </ErpButton>
          {leadViewPath ? (
            <ErpButton
              type="button"
              variant="primary"
              icon={ExternalLink}
              onClick={() => { navigate(leadViewPath); onClose() }}
            >
              Open Lead
            </ErpButton>
          ) : null}
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {onScheduleFollowUp ? (
          <ErpButton type="button" variant="secondary" size="sm" icon={Calendar} onClick={onScheduleFollowUp}>
            Schedule follow-up
          </ErpButton>
        ) : null}
        {onLogActivity ? (
          <ErpButton type="button" variant="secondary" size="sm" icon={Activity} onClick={onLogActivity}>
            Log activity
          </ErpButton>
        ) : null}
      </div>

      <section className="mb-6 rounded-lg border border-erp-border bg-erp-surface-alt p-3 text-[12px]">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-erp-muted">Record summary</h3>
        <dl className="grid gap-1.5 sm:grid-cols-2">
          <div>
            <dt className="text-erp-muted">Created</dt>
            <dd className="font-medium text-erp-text">{formatDateTime(lead.createdAt)} · {lead.createdByName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-erp-muted">Last modified</dt>
            <dd className="font-medium text-erp-text">{formatDateTime(lead.modifiedAt ?? lead.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-erp-muted">Lead owner</dt>
            <dd className="font-medium text-erp-text">{lead.leadOwnerName}</dd>
          </div>
          <div>
            <dt className="text-erp-muted">Stage</dt>
            <dd className="font-medium text-erp-text">{leadStageLabel(lead.stage)}</dd>
          </div>
          <div>
            <dt className="text-erp-muted">Status</dt>
            <dd className="font-medium text-erp-text">{lead.activityStatus === 'active' ? 'Active' : 'Inactive'} · {formatStatus(lead.lifecycleStatus)}</dd>
          </div>
          {lead.stage === 'closed' && lead.closedDate ? (
            <div>
              <dt className="text-erp-muted">Closed</dt>
              <dd className="font-medium text-erp-text">{formatDate(lead.closedDate)}{lead.closedReason ? ` · ${formatStatus(lead.closedReason)}` : ''}</dd>
            </div>
          ) : null}
          {lead.stage === 'converted_to_opportunity' || linkedOpp ? (
            <div className="sm:col-span-2">
              <dt className="text-erp-muted">Conversion</dt>
              <dd className="font-medium text-emerald-800">
                Converted to Opportunity{linkedOpp ? ` — ${linkedOpp.opportunityNo}` : ''}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-erp-muted">
          Timeline ({timeline.length})
        </h3>
        {timeline.length === 0 ? (
          <p className="text-[13px] text-erp-muted">No engagement history yet.</p>
        ) : (
          <ul className="space-y-2">
            {timeline.slice(0, 12).map((entry) => (
              <li key={entry.id} className="rounded-lg border border-erp-border bg-erp-surface px-3 py-2 text-[12px]">
                <span className="font-semibold text-erp-text capitalize">{entry.kind.replace(/_/g, ' ')}</span>
                <span className="text-erp-muted"> · {formatDateTime(entry.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-erp-muted">
          Follow-ups ({leadFollowUps.length})
        </h3>
        {leadFollowUps.length === 0 ? (
          <p className="text-[13px] text-erp-muted">No follow-ups logged for this lead.</p>
        ) : (
          <ul className="space-y-2">
            {leadFollowUps.map((f) => (
              <li
                key={f.id}
                className={cn(
                  'rounded-lg border p-3 text-[13px]',
                  f.status === 'overdue' ? 'border-red-200 bg-red-50/60' : 'border-erp-border bg-erp-surface',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium capitalize text-erp-text">{f.followUpType.replace(/_/g, ' ')}</span>
                  <LiveStatusBadge
                    label={f.status}
                    tone={f.status === 'overdue' ? 'critical' : f.status === 'completed' ? 'healthy' : 'warning'}
                    pulse={false}
                  />
                </div>
                <p className="mt-1 text-[11px] text-erp-muted">
                  {f.dueDate} · {f.dueTime} · {f.assignedToName}
                </p>
                {f.notes ? <p className="mt-1.5 text-erp-text">{f.notes}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-4">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-erp-muted">
          Activities ({leadActivities.length})
        </h3>
        <ActivityTimeline activities={leadActivities} emptyMessage="No activities logged for this lead yet." />
      </section>

      <p className="text-[12px] text-erp-muted">
        Open follow-ups: <span className="font-semibold text-erp-text">{pendingFollowUps.length}</span>
      </p>
    </CrmDrawerShell>
  )
}
