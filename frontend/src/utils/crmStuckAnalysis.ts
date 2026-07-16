import type { Opportunity, OpportunityStage } from '../types/crm'
import { opportunityStageLabel } from './opportunityUtils'

const STUCK_DAYS = 14
const MID_STAGES = new Set<OpportunityStage>([
  'requirement_discussion',
  'technical_review',
  'negotiation',
  'quotation_sent',
])

function daysSince(iso: string): number {
  const d = new Date(iso.slice(0, 10))
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

export interface StuckOpportunityInsight {
  opportunity: Opportunity
  daysStuck: number
  riskReason: string
  riskTone: 'critical' | 'warning' | 'neutral'
}

export function analyzeStuckOpportunity(opp: Opportunity, now = new Date()): StuckOpportunityInsight | null {
  if (opp.status !== 'open') return null

  const lastTouch = opp.lastActivityAt ?? opp.createdAt
  const idleDays = daysSince(lastTouch)
  const ageDays = daysSince(opp.createdAt)
  const closeOverdue =
    opp.expectedCloseDate && opp.expectedCloseDate.slice(0, 10) < now.toISOString().slice(0, 10)

  const reasons: { text: string; tone: StuckOpportunityInsight['riskTone']; weight: number }[] = []

  if (idleDays >= 7) {
    reasons.push({
      text: `No activity for ${idleDays} days`,
      tone: idleDays >= 14 ? 'critical' : 'warning',
      weight: idleDays,
    })
  }

  if (opp.stage === 'quotation_sent' && idleDays >= 5) {
    reasons.push({
      text: 'Quotation sent but no follow-up',
      tone: 'warning',
      weight: idleDays + 5,
    })
  }

  if (closeOverdue) {
    reasons.push({
      text: 'Expected close date missed',
      tone: 'critical',
      weight: 100,
    })
  }

  if (MID_STAGES.has(opp.stage) && ageDays >= STUCK_DAYS) {
    reasons.push({
      text: `${opportunityStageLabel(opp.stage)} ageing ${ageDays} days`,
      tone: 'warning',
      weight: ageDays,
    })
  }

  if (!opp.nextFollowUpDate && opp.status === 'open') {
    reasons.push({
      text: 'No next action scheduled',
      tone: 'warning',
      weight: 20,
    })
  }

  if (opp.value >= 3000000 && opp.probability < 40) {
    reasons.push({
      text: 'High value with low probability',
      tone: 'critical',
      weight: 80,
    })
  }

  if (reasons.length === 0) {
    if (MID_STAGES.has(opp.stage) && idleDays >= STUCK_DAYS) {
      reasons.push({
        text: `Stuck in ${opportunityStageLabel(opp.stage)} for ${idleDays} days`,
        tone: 'warning',
        weight: idleDays,
      })
    } else {
      return null
    }
  }

  const top = [...reasons].sort((a, b) => b.weight - a.weight)[0]
  return {
    opportunity: opp,
    daysStuck: Math.max(idleDays, ageDays),
    riskReason: top.text,
    riskTone: top.tone,
  }
}

export function buildStuckOpportunityInsights(opportunities: Opportunity[]): StuckOpportunityInsight[] {
  return opportunities
    .map((o) => analyzeStuckOpportunity(o))
    .filter((x): x is StuckOpportunityInsight => x !== null)
    .sort((a, b) => b.opportunity.value - a.opportunity.value)
}
