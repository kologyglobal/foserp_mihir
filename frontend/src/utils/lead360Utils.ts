import type { Lead, LeadStage } from '../types/sales'
import type { CrmActivity } from '../types/crm'
import type { Enterprise360PipelineStage } from '../design-system/workspace360/types'
import { LEAD_STAGE_OPTIONS, leadStageLabel, resolveLeadStageOptions } from './leadUtils'

/** Same stages as the Lead Stage dropdown (edit + list filters). */
export const LEAD_CRM_PIPELINE = LEAD_STAGE_OPTIONS.map((id) => ({
  id,
  label: leadStageLabel(id),
}))

export type LeadCrmPipelineStageId = LeadStage

/** Happy-path order — terminals are peers in the tracker, not progression steps. */
const HAPPY_PATH: LeadStage[] = [
  'new',
  'contacted',
  'requirement_collected',
  'qualified',
  'converted_to_opportunity',
]

const TERMINAL_STAGES = new Set<LeadStage>(['not_qualified', 'closed'])

/** @deprecated Context no longer advances pipeline; kept for call-site compat. */
export interface LeadPipelineContext {
  hasOpportunity?: boolean
  hasQuotation?: boolean
  inNegotiation?: boolean
  isWon?: boolean
}

/** Index of the lead's current dropdown stage in the tracker. */
export function resolveLeadPipelineIndex(lead: Lead, _ctx: LeadPipelineContext = {}): number {
  const stages = resolveLeadStageOptions()
  const idx = stages.indexOf(lead.stage)
  return idx >= 0 ? idx : 0
}

export function leadPipelineCurrentLabel(index: number): string {
  const stages = resolveLeadStageOptions()
  const stage = stages[Math.min(Math.max(index, 0), stages.length - 1)]
  return stage ? leadStageLabel(stage) : 'New'
}

function isHappyPathPast(stageId: LeadStage, current: LeadStage): boolean {
  if (TERMINAL_STAGES.has(stageId) || TERMINAL_STAGES.has(current)) return false
  const stageIdx = HAPPY_PATH.indexOf(stageId)
  const currentIdx = HAPPY_PATH.indexOf(current)
  return stageIdx >= 0 && currentIdx > stageIdx
}

function completedAtForStage(stageId: LeadStage, lead: Lead, activities: CrmActivity[]): string | null {
  const contactDate = activities.find((a) => a.subject.toLowerCase().includes('contact'))?.activityDate.slice(0, 10)
  const qualifyDate = activities.find((a) => a.subject.toLowerCase().includes('qualif'))?.activityDate.slice(0, 10)

  if (stageId === 'new') return lead.createdDate
  if (stageId === 'contacted') {
    return contactDate
      ?? (HAPPY_PATH.indexOf(lead.stage) > 0 || TERMINAL_STAGES.has(lead.stage) ? lead.createdDate : null)
  }
  if (stageId === 'requirement_collected') {
    return ['requirement_collected', 'qualified', 'converted_to_opportunity'].includes(lead.stage)
      ? lead.modifiedAt?.slice(0, 10) ?? lead.createdDate
      : null
  }
  if (stageId === 'qualified') {
    return qualifyDate
      ?? (['qualified', 'converted_to_opportunity'].includes(lead.stage)
        ? lead.expectedCloseDate ?? lead.createdDate
        : null)
  }
  if (stageId === 'converted_to_opportunity' && lead.stage === 'converted_to_opportunity') {
    return lead.modifiedAt?.slice(0, 10) ?? lead.closedDate ?? lead.createdDate
  }
  return null
}

export function buildLeadCrmPipeline(
  lead: Lead,
  activities: CrmActivity[],
  _ctx: LeadPipelineContext = {},
): {
  stages: Enterprise360PipelineStage[]
  currentLabel: string
  recordStatusLabel: string
  statusNote: string | null
  tone: 'default' | 'lost'
} {
  const isLostOutcome = TERMINAL_STAGES.has(lead.stage)
  const currentLabel = leadStageLabel(lead.stage)
  const recordStatusLabel = currentLabel

  const stages = resolveLeadStageOptions().map((id) => ({
    id,
    label: leadStageLabel(id),
  })).map((stage) => {
    const isCurrent = stage.id === lead.stage
    const isLost = isLostOutcome && isCurrent
    const isPast = !isCurrent && isHappyPathPast(stage.id, lead.stage)

    let completedAt: string | null = null
    if (isPast || (isCurrent && stage.id === 'converted_to_opportunity')) {
      completedAt = completedAtForStage(stage.id, lead, activities)
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

  return {
    stages,
    currentLabel,
    recordStatusLabel,
    statusNote: explainLeadFunnelStatus(lead.stage, currentLabel, recordStatusLabel),
    tone: isLostOutcome ? 'lost' : 'default',
  }
}

/** Optional note under the stage tracker (status === tracker when using dropdown stages). */
export function explainLeadFunnelStatus(
  stage: LeadStage,
  _funnelLabel: string,
  _recordStatusLabel: string,
): string | null {
  if (stage === 'not_qualified') {
    return 'Lead is not qualified — pipeline stopped at this stage.'
  }
  if (stage === 'closed') {
    return 'Lead is closed.'
  }
  return null
}

export function buildLeadAiInsights(lead: Lead, healthScore: number) {
  const nextActionByStage: Partial<Record<LeadStage, string>> = {
    new: 'Make first contact call',
    contacted: 'Capture product requirements',
    requirement_collected: 'Qualify the lead',
    qualified: 'Convert to opportunity',
    not_qualified: 'Close or archive the lead',
    converted_to_opportunity: 'Continue on the linked opportunity',
    closed: 'No further lead action',
  }
  const nextAction = nextActionByStage[lead.stage] ?? 'Review lead status'

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

/** Explicit qualification outcome for summary cards (separate from pipeline stage). */
export function leadQualificationLabel(lead: Lead): string {
  if (lead.stage === 'not_qualified') return 'Not Qualified'
  if (lead.stage === 'qualified' || lead.lifecycleStatus === 'qualified') return 'Qualified'
  if (lead.stage === 'converted_to_opportunity' || lead.lifecycleStatus === 'converted') return 'Converted'
  if (lead.stage === 'requirement_collected') return 'Pending Qualification'
  if (lead.stage === 'closed') return 'Closed'
  return 'Unqualified'
}

export function leadHeroStageLabel(lead: Lead): string {
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
