import type { CrmActivity, FollowUp, Opportunity } from '../types/crm'
import { buildPipelineFunnelData } from './crmMetrics'
import { CLOSED_STAGES, resolveStageFunnelColor } from './crmStageTheme'
import { resolveOpportunityStages } from './opportunityUtils'

export interface PipelineChartPoint {
  id: string
  label: string
  shortLabel: string
  count: number
  value: number
  weighted: number
  color: string
}

export interface OutcomeChartPoint {
  name: string
  value: number
  color: string
}

export interface ActivityTrendPoint {
  day: string
  label: string
  count: number
}

export interface FollowUpUrgencyPoint {
  name: string
  value: number
  color: string
}

export interface OwnerPipelinePoint {
  owner: string
  value: number
  count: number
}

const STAGE_SHORT: Record<string, string> = {
  new_lead: 'New Lead',
  qualified: 'Qualified',
  requirement_discussion: 'Req. Disc.',
  technical_review: 'Tech Rev.',
  quotation_prepared: 'Quo. Prep',
  quotation_sent: 'Quo. Sent',
  negotiation: 'Negotiation',
}

export function buildPipelineChartData(opportunities: Opportunity[]): PipelineChartPoint[] {
  const funnel = buildPipelineFunnelData(opportunities, { includeClosed: false })
  return funnel.stages
    .filter((s) => !CLOSED_STAGES.has(s.id) && s.id !== 'on_hold')
    .map((s) => ({
      id: s.id,
      label: s.label,
      shortLabel: STAGE_SHORT[s.id] ?? s.label,
      count: s.count,
      value: s.value,
      weighted: s.weightedValue,
      color: resolveStageFunnelColor(s.id),
    }))
}

export function buildOutcomeChartData(
  openCount: number,
  wonCount: number,
  lostCount: number,
): OutcomeChartPoint[] {
  return [
    { name: 'Open', value: openCount, color: '#3b82f6' },
    { name: 'Won', value: wonCount, color: '#10b981' },
    { name: 'Lost', value: lostCount, color: '#ef4444' },
  ].filter((d) => d.value > 0)
}

export function buildActivityTrendData(activities: CrmActivity[], days = 7): ActivityTrendPoint[] {
  const points: ActivityTrendPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('en-IN', { weekday: 'short' })
    const count = activities.filter((a) => a.activityDate.slice(0, 10) === key).length
    points.push({ day: key, label, count })
  }
  return points
}

export function buildFollowUpUrgencyData(followUps: FollowUp[]): FollowUpUrgencyPoint[] {
  const today = new Date().toISOString().slice(0, 10)
  let overdue = 0
  let dueToday = 0
  let upcoming = 0
  for (const f of followUps) {
    if (f.status === 'completed') continue
    if (f.status === 'overdue') overdue++
    else if (f.dueDate.slice(0, 10) === today) dueToday++
    else if (f.status === 'pending') upcoming++
  }
  return [
    { name: 'Overdue', value: overdue, color: '#ef4444' },
    { name: 'Due today', value: dueToday, color: '#f59e0b' },
    { name: 'Upcoming', value: upcoming, color: '#3b82f6' },
  ].filter((d) => d.value > 0)
}

export function buildOwnerPipelineData(opportunities: Opportunity[]): OwnerPipelinePoint[] {
  const open = opportunities.filter((o) => o.status === 'open')
  const byOwner = new Map<string, { value: number; count: number }>()
  for (const o of open) {
    const cur = byOwner.get(o.ownerName) ?? { value: 0, count: 0 }
    byOwner.set(o.ownerName, { value: cur.value + o.value, count: cur.count + 1 })
  }
  return [...byOwner.entries()]
    .map(([owner, { value, count }]) => ({ owner, value, count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
}

export function buildStageCountFunnel(opportunities: Opportunity[]) {
  return resolveOpportunityStages().filter((s) => !CLOSED_STAGES.has(s.id) && s.id !== 'on_hold').map((s) => {
    const count = opportunities.filter((o) => o.stage === s.id && o.status === 'open').length
    return {
      id: s.id,
      stage: s.label,
      short: STAGE_SHORT[s.id] ?? s.label,
      count,
      fill: resolveStageFunnelColor(s.id),
    }
  })
}
