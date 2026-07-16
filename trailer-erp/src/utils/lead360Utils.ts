import type { Lead, LeadStage } from '../types/sales'
import type { CrmActivity } from '../types/crm'
import type { Enterprise360PipelineStage } from '../design-system/workspace360/types'
import { leadStageLabel } from './leadUtils'

export const LEAD_CRM_PIPELINE = [
  { id: 'opportunity', label: 'Opportunity' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'won', label: 'Won' },
] as const

export type LeadCrmPipelineStageId = (typeof LEAD_CRM_PIPELINE)[number]['id']

export interface LeadPipelineContext {
  hasOpportunity?: boolean
  hasQuotation?: boolean
  inNegotiation?: boolean
  isWon?: boolean
}

const STAGE_BASE_INDEX: Record<LeadStage, number> = {
  new: 0,
  contacted: 1,
  requirement_collected: 2,
  qualified: 2,
  not_qualified: 2,
  converted_to_opportunity: 5,
  /** Closed without win maps via resolveLeadPipelineIndex — not Won by default */
  closed: 2,
}

/** Map lead stage + commercial context to the 6-step CRM cycle index. */
export function resolveLeadPipelineIndex(lead: Lead, ctx: LeadPipelineContext = {}): number {
  if (ctx.isWon || lead.stage === 'converted_to_opportunity') return 5

  if (lead.stage === 'closed') {
    if (ctx.inNegotiation) return 4
    if (ctx.hasQuotation) return 3
    return 2
  }

  let idx = STAGE_BASE_INDEX[lead.stage] ?? 0

  if (ctx.inNegotiation) idx = Math.max(idx, 4)
  else if (ctx.hasQuotation) idx = Math.max(idx, 3)

  if (lead.stage === 'qualified') {
    if (ctx.inNegotiation) idx = 4
    else if (ctx.hasQuotation) idx = 3
  }

  return Math.min(Math.max(idx, 0), 5)
}

export function leadPipelineCurrentLabel(index: number): string {
  return LEAD_CRM_PIPELINE[Math.min(index, LEAD_CRM_PIPELINE.length - 1)]?.label ?? 'Opportunity'
}

export function buildLeadCrmPipeline(
  lead: Lead,
  activities: CrmActivity[],
  ctx: LeadPipelineContext = {},
): {
  stages: Enterprise360PipelineStage[]
  currentLabel: string
  recordStatusLabel: string
  statusNote: string | null
  tone: 'default' | 'lost'
} {
  const isLostOutcome = lead.stage === 'not_qualified'
    || (lead.stage === 'closed' && !ctx.isWon && lead.lifecycleStatus !== 'converted')
  const currentIdx = resolveLeadPipelineIndex(lead, ctx)

  const stageActivityDates: Partial<Record<LeadCrmPipelineStageId, string>> = {}
  for (const act of activities) {
    const subj = act.subject.toLowerCase()
    if (subj.includes('contact')) stageActivityDates.contacted = act.activityDate.slice(0, 10)
    if (subj.includes('qualified')) stageActivityDates.qualified = act.activityDate.slice(0, 10)
    if (subj.includes('proposal') || subj.includes('quotation')) stageActivityDates.proposal = act.activityDate.slice(0, 10)
    if (subj.includes('negotiat')) stageActivityDates.negotiation = act.activityDate.slice(0, 10)
  }

  const stages = LEAD_CRM_PIPELINE.map((stage, index) => {
    const isPast = !isLostOutcome && currentIdx > index
    const isCurrent = currentIdx === index
    const isLost = isLostOutcome && isCurrent

    let completedAt: string | null = null
    if (isPast) {
      if (stage.id === 'opportunity') completedAt = lead.createdDate
      else if (stage.id === 'contacted') {
        completedAt = stageActivityDates.contacted
          ?? (['contacted', 'requirement_collected', 'qualified', 'converted_to_opportunity', 'closed'].includes(lead.stage) ? lead.createdDate : null)
      }
      else if (stage.id === 'qualified') {
        completedAt = stageActivityDates.qualified
          ?? (['requirement_collected', 'qualified', 'converted_to_opportunity', 'closed'].includes(lead.stage) ? lead.expectedCloseDate ?? lead.createdDate : null)
      }
      else if (stage.id === 'proposal') {
        completedAt = stageActivityDates.proposal ?? lead.expectedCloseDate ?? null
      }
      else if (stage.id === 'negotiation') {
        completedAt = stageActivityDates.negotiation ?? null
      }
      else if (stage.id === 'won' && lead.stage === 'converted_to_opportunity') {
        completedAt = lead.modifiedAt?.slice(0, 10) ?? lead.closedDate ?? lead.createdDate
      }
    }

    if (isCurrent && stage.id === 'won' && !isLostOutcome) {
      completedAt = lead.modifiedAt?.slice(0, 10) ?? lead.closedDate ?? null
    }

    return {
      id: stage.id,
      label: stage.label,
      completedAt,
      isCurrent,
      isPast,
      isLost,
    }
  })

  const currentLabel = leadPipelineCurrentLabel(currentIdx)
  const recordStatusLabel = leadStageLabel(lead.stage)
  const statusNote = explainLeadFunnelStatus(lead.stage, currentLabel, recordStatusLabel)

  return {
    stages,
    currentLabel,
    recordStatusLabel,
    statusNote,
    tone: isLostOutcome ? 'lost' : 'default',
  }
}

/** When funnel label and lead status diverge, explain the relationship. */
export function explainLeadFunnelStatus(
  stage: LeadStage,
  funnelLabel: string,
  recordStatusLabel: string,
): string | null {
  if (stage === 'requirement_collected') {
    return 'Requirement Collected is the lead status inside the Qualified sales stage (requirements captured; not yet fully qualified).'
  }
  if (stage === 'new' && funnelLabel === 'Opportunity') {
    return 'New leads sit at the Opportunity sales stage until first meaningful contact.'
  }
  if (stage === 'not_qualified') {
    return 'Lead is disqualified — sales stage stopped at this point.'
  }
  if (stage === 'closed' && funnelLabel !== 'Won') {
    return 'Lead is closed without a win.'
  }
  if (stage === 'converted_to_opportunity') {
    return null
  }
  if (recordStatusLabel !== funnelLabel) {
    return `Sales stage tracker shows ${funnelLabel}; lead record status is ${recordStatusLabel}.`
  }
  return null
}

export function buildLeadAiInsights(lead: Lead, healthScore: number) {
  const pipelineIdx = resolveLeadPipelineIndex(lead)
  const nextAction =
    pipelineIdx >= 4
      ? 'Close the deal'
      : pipelineIdx === 3
        ? 'Follow up on proposal'
        : pipelineIdx === 2
          ? 'Create quotation or convert'
          : pipelineIdx === 1
            ? 'Qualify requirement'
            : 'Make first contact call'

  const followUpDays = lead.probability >= 70 ? 2 : lead.probability >= 40 ? 5 : 7

  return {
    score: healthScore,
    insights: [
      { id: 'nba', label: 'Next Best Action', value: nextAction, tone: 'info' as const },
      { id: 'dup', label: 'Duplicate Risk', value: lead.customerId ? 'None' : 'Review prospect match', tone: lead.customerId ? ('success' as const) : ('warning' as const) },
      { id: 'fu', label: 'Suggested Follow-up', value: `Call within ${followUpDays} days`, tone: 'info' as const },
      { id: 'conv', label: 'Conversion Probability', value: `${lead.probability}%`, tone: 'success' as const },
    ],
  }
}

export function computeLeadHealthScore(lead: Lead, activityCount: number, openFollowUps: number): number {
  let score = 40
  if (lead.customerId) score += 15
  if (lead.mobile || lead.email) score += 10
  if (lead.productRequirement) score += 10
  if (lead.expectedValue > 0) score += 10
  score += Math.min(15, activityCount * 3)
  score += Math.min(10, lead.probability / 10)
  if (openFollowUps > 2) score -= 5
  return Math.min(100, Math.max(0, Math.round(score)))
}

export interface RelationshipEvent {
  id: string
  label: string
  date: string
}

export function buildLeadRelationshipTimeline(
  lead: Lead,
  activities: CrmActivity[],
  hasQuotation: boolean,
  hasSalesOrder: boolean,
  hasInvoice: boolean,
): RelationshipEvent[] {
  const events: RelationshipEvent[] = [
    { id: 'created', label: 'Lead Created', date: lead.createdDate },
  ]

  for (const act of activities) {
    const typeLabel =
      act.type === 'call' ? 'Phone Call'
        : act.type === 'email' ? 'Email Sent'
          : act.type === 'meeting' ? 'Meeting'
            : act.type === 'whatsapp' ? 'WhatsApp'
              : act.subject
    events.push({
      id: act.id,
      label: typeLabel,
      date: act.activityDate.slice(0, 10),
    })
  }

  if (hasQuotation) {
    events.push({ id: 'quotation', label: 'Quotation Shared', date: lead.expectedCloseDate ?? lead.createdDate })
  }
  if (lead.stage === 'converted_to_opportunity') {
    events.push({ id: 'converted', label: 'Converted to Opportunity', date: lead.modifiedAt?.slice(0, 10) ?? lead.createdDate })
  }
  if (hasSalesOrder) {
    events.push({ id: 'so', label: 'Sales Order', date: lead.expectedCloseDate ?? lead.createdDate })
  }
  if (hasInvoice) {
    events.push({ id: 'inv', label: 'Invoice', date: lead.expectedCloseDate ?? lead.createdDate })
  }

  return events.sort((a, b) => b.date.localeCompare(a.date))
}

export function leadStatusLabel(lead: Lead): string {
  if (lead.stage === 'converted_to_opportunity' || lead.lifecycleStatus === 'converted') return 'Converted'
  if (lead.stage === 'closed') return 'Closed'
  if (lead.stage === 'not_qualified') return 'Not Qualified'
  return lead.lifecycleStatus === 'qualified' ? 'Qualified' : 'Open'
}

export function leadHeroStageLabel(lead: Lead): string {
  if (lead.stage === 'converted_to_opportunity') return 'Opportunity'
  return leadStageLabel(lead.stage)
}

export function relationshipAgeDays(createdDate: string): number {
  const created = new Date(createdDate)
  const now = new Date()
  return Math.max(0, Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)))
}

export function formatRelationshipAge(days: number): string {
  if (days < 30) return `${days} days`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} mo`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem > 0 ? `${years}y ${rem}mo` : `${years}y`
}
