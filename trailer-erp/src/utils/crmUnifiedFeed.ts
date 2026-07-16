import type { CrmActivity, FollowUp, Opportunity } from '../types/crm'
import type { DemoEntityNote } from '../types/crmEntity'
import type { Lead } from '../types/sales'
import type { RelationshipEvent } from './lead360Utils'
import { opportunityStageLabel } from './opportunityUtils'

export type UnifiedFeedKind = 'activity' | 'note' | 'followup' | 'system'
export type UnifiedFeedFilter = 'all' | UnifiedFeedKind

export interface UnifiedFeedItem {
  id: string
  kind: UnifiedFeedKind
  title: string
  body?: string
  /** ISO-ish string for sorting (date or datetime) */
  at: string
  meta?: string
  badge?: string
  badgeTone?: 'ok' | 'warn' | 'critical' | 'neutral'
  activity?: CrmActivity
  followUp?: FollowUp
}

export const UNIFIED_FEED_FILTERS: { id: UnifiedFeedFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'activity', label: 'Activities' },
  { id: 'note', label: 'Notes' },
  { id: 'followup', label: 'Follow-ups' },
  { id: 'system', label: 'System' },
]

function sortKey(at: string): string {
  return at.length >= 16 ? at : `${at}T00:00:00`
}

/** Relationship timeline without activity duplicates — those live under Activities. */
export function buildLeadSystemEvents(
  lead: Lead,
  hasQuotation: boolean,
  hasSalesOrder: boolean,
  hasInvoice: boolean,
): RelationshipEvent[] {
  const events: RelationshipEvent[] = [
    { id: 'created', label: 'Lead Created', date: lead.createdDate },
  ]
  if (hasQuotation) {
    events.push({ id: 'quotation', label: 'Quotation Shared', date: lead.expectedCloseDate ?? lead.createdDate })
  }
  if (lead.stage === 'converted_to_opportunity') {
    events.push({
      id: 'converted',
      label: 'Converted to Opportunity',
      date: lead.modifiedAt?.slice(0, 10) ?? lead.createdDate,
    })
  }
  if (hasSalesOrder) {
    events.push({ id: 'so', label: 'Sales Order', date: lead.expectedCloseDate ?? lead.createdDate })
  }
  if (hasInvoice) {
    events.push({ id: 'inv', label: 'Invoice', date: lead.expectedCloseDate ?? lead.createdDate })
  }
  return events.sort((a, b) => b.date.localeCompare(a.date))
}

export function buildOpportunitySystemEvents(opp: Opportunity): RelationshipEvent[] {
  const created = opp.createdAt?.slice(0, 10) || opp.expectedCloseDate
  const events: RelationshipEvent[] = [
    { id: 'created', label: 'Opportunity Created', date: created },
    {
      id: `stage:${opp.stage}`,
      label: `Stage · ${opportunityStageLabel(opp.stage)}`,
      date: opp.modifiedAt?.slice(0, 10) ?? created,
    },
  ]
  if (opp.quotationId) {
    events.push({
      id: 'quotation',
      label: 'Quotation Linked',
      date: opp.modifiedAt?.slice(0, 10) ?? created,
    })
  }
  if (opp.stage === 'won') {
    events.push({ id: 'won', label: 'Deal Won', date: opp.modifiedAt?.slice(0, 10) ?? created })
  }
  if (opp.stage === 'lost') {
    events.push({
      id: 'lost',
      label: opp.lostReason ? `Deal Lost · ${opp.lostReason}` : 'Deal Lost',
      date: opp.modifiedAt?.slice(0, 10) ?? created,
    })
  }
  if (opp.salesOrderId) {
    events.push({
      id: 'so',
      label: 'Sales Order Created',
      date: opp.modifiedAt?.slice(0, 10) ?? created,
    })
  }
  return events.sort((a, b) => b.date.localeCompare(a.date))
}

export function buildUnifiedFeed(input: {
  activities: CrmActivity[]
  followUps: FollowUp[]
  notes: DemoEntityNote[]
  systemEvents: RelationshipEvent[]
}): UnifiedFeedItem[] {
  const items: UnifiedFeedItem[] = []

  for (const act of input.activities) {
    items.push({
      id: `activity:${act.id}`,
      kind: 'activity',
      title: act.subject,
      body: act.description || undefined,
      at: act.activityDate,
      meta: `${act.type.replace(/_/g, ' ')} · ${act.ownerName}`,
      badge: act.outcome?.trim() ? act.outcome : undefined,
      badgeTone: act.outcome?.trim() ? 'ok' : 'neutral',
      activity: act,
    })
  }

  for (const f of input.followUps) {
    items.push({
      id: `followup:${f.id}`,
      kind: 'followup',
      title: `Follow-up · ${f.followUpType.replace(/_/g, ' ')}`,
      body: f.notes || undefined,
      at: `${f.dueDate}T${f.dueTime || '09:00'}:00`,
      meta: `${f.dueDate} · ${f.dueTime} · ${f.assignedToName}`,
      badge: f.status,
      badgeTone:
        f.status === 'overdue' ? 'critical'
          : f.status === 'completed' ? 'ok'
            : f.status === 'pending' ? 'warn'
              : 'neutral',
      followUp: f,
    })
  }

  input.notes.forEach((note, index) => {
    items.push({
      id: `note:${note.label ?? 'note'}-${index}-${note.createdAt ?? index}`,
      kind: 'note',
      title: note.label?.trim() || 'Note',
      body: note.content,
      at: note.createdAt ?? '1970-01-01',
      meta: note.authorName || 'User',
    })
  })

  for (const ev of input.systemEvents) {
    items.push({
      id: `system:${ev.id}`,
      kind: 'system',
      title: ev.label,
      at: ev.date,
      meta: 'System',
      badge: 'System',
      badgeTone: 'neutral',
    })
  }

  return items.sort((a, b) => sortKey(b.at).localeCompare(sortKey(a.at)))
}

/** @deprecated Use buildUnifiedFeed */
export const buildLeadUnifiedFeed = buildUnifiedFeed

export function filterUnifiedFeed(items: UnifiedFeedItem[], filter: UnifiedFeedFilter): UnifiedFeedItem[] {
  if (filter === 'all') return items
  return items.filter((item) => item.kind === filter)
}

export function countUnifiedFeedByKind(items: UnifiedFeedItem[]): Record<UnifiedFeedKind | 'all', number> {
  const counts: Record<UnifiedFeedKind | 'all', number> = {
    all: items.length,
    activity: 0,
    note: 0,
    followup: 0,
    system: 0,
  }
  for (const item of items) counts[item.kind] += 1
  return counts
}
