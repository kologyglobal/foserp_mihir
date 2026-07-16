import type { CrmActivity, FollowUp } from '../types/crm'

export type LeadTimelineEntryKind = 'activity' | 'follow_up'

export interface LeadTimelineEntry {
  id: string
  kind: LeadTimelineEntryKind
  timestamp: string
  sortKey: string
  activity?: CrmActivity
  followUp?: FollowUp
}

/** Merge activities and follow-ups into one chronological feed (newest first). */
export function buildLeadEngagementTimeline(
  activities: CrmActivity[],
  followUps: FollowUp[],
): LeadTimelineEntry[] {
  const entries: LeadTimelineEntry[] = []

  for (const activity of activities) {
    entries.push({
      id: `act-${activity.id}`,
      kind: 'activity',
      timestamp: activity.activityDate,
      sortKey: activity.activityDate,
      activity,
    })
  }

  for (const followUp of followUps) {
    const ts =
      followUp.status === 'completed' && followUp.modifiedAt
        ? followUp.modifiedAt
        : `${followUp.dueDate}T${followUp.dueTime || '09:00'}:00`
    entries.push({
      id: `fu-${followUp.id}`,
      kind: 'follow_up',
      timestamp: ts,
      sortKey: ts,
      followUp,
    })
  }

  return entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey))
}

export function leadEngagementSummary(activities: CrmActivity[], followUps: FollowUp[]) {
  const openFollowUps = followUps.filter((f) => f.status === 'pending' || f.status === 'overdue')
  const overdueFollowUps = followUps.filter((f) => f.status === 'overdue')
  const completedFollowUps = followUps.filter((f) => f.status === 'completed')
  const lastActivity = activities.length
    ? [...activities].sort((a, b) => b.activityDate.localeCompare(a.activityDate))[0]?.activityDate
    : null
  const lastTouch = lastActivity ?? followUps[followUps.length - 1]?.dueDate ?? null

  return {
    activityCount: activities.length,
    followUpCount: followUps.length,
    openFollowUps: openFollowUps.length,
    overdueFollowUps: overdueFollowUps.length,
    completedFollowUps: completedFollowUps.length,
    lastTouch,
  }
}
