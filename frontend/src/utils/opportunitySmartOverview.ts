import type {
  CrmSmartChip,
  CrmSmartKeyDetail,
  CrmSmartNextAction,
  CrmSmartSignal,
} from '../components/crm/CrmSmartOverviewPanel'
import { opportunityPriorityLabel, opportunityStageLabel } from './opportunityUtils'
import { formatCurrency } from './formatters/currency'
import { formatDate } from './dates/format'
import type { OpportunityPriority, OpportunityStage } from '../types/crm'

export interface OpportunitySmartOverviewInput {
  opportunityName: string
  customerName: string
  customerId: string | null
  stage: OpportunityStage
  priority: OpportunityPriority
  status?: string
  ownerName: string
  dealValue: number
  weightedValue: number
  probability?: number
  lineCount: number
  hasValidLine: boolean
  expectedCloseDate?: string | null
  nextFollowUpDate?: string | null
  quotationId?: string | null
  salesOrderId?: string | null
  healthScore?: number
  activityCount?: number
  openFollowUpCount?: number
  overdueFollowUp?: boolean
  isOpen?: boolean
  /** Ready for Create Sales Order (quotation accepted + Won / Order Confirmed). */
  canCreateSalesOrder?: boolean
  createSalesOrderLockedReason?: string
  /** Ready for Create Quotation (stage + mandatory fields). */
  canCreateQuotation?: boolean
  createQuotationLockedReason?: string
  lastSavedLabel?: string
}

export const OPPORTUNITY_HEALTH_SCORE_TOOLTIP =
  'Measures deal risk, engagement, and momentum.'

export const OPPORTUNITY_DEAL_READINESS_TOOLTIP =
  'Measures completion of required qualification and commercial information.'

export interface OpportunityScoreFactor {
  id: string
  label: string
  ok: boolean
  detail: string
}

export interface OpportunityScoreBreakdown {
  score: number
  tooltip: string
  factors: OpportunityScoreFactor[]
}

export function computeOpportunityCompleteness(input: OpportunitySmartOverviewInput): number {
  return buildOpportunityReadinessBreakdown(input).score
}

/** Deal Readiness — checklist of qualification / commercial fields. */
export function buildOpportunityReadinessBreakdown(
  input: OpportunitySmartOverviewInput,
): OpportunityScoreBreakdown {
  const factors: OpportunityScoreFactor[] = [
    {
      id: 'name',
      label: 'Opportunity name',
      ok: Boolean(input.opportunityName.trim()),
      detail: 'Deal identity is set',
    },
    {
      id: 'company',
      label: 'Company linked',
      ok: Boolean(input.customerId),
      detail: 'Customer account required for qualification',
    },
    {
      id: 'lines',
      label: 'Product lines',
      ok: input.hasValidLine,
      detail: 'At least one priced product / item line',
    },
    {
      id: 'value',
      label: 'Deal value',
      ok: input.dealValue > 0,
      detail: 'Commercial value greater than zero',
    },
    {
      id: 'close',
      label: 'Expected close date',
      ok: Boolean(input.expectedCloseDate),
      detail: 'Forecast timing captured',
    },
    {
      id: 'next',
      label: 'Follow-up or quotation',
      ok: Boolean(input.nextFollowUpDate) || Boolean(input.quotationId),
      detail: 'Next touch planned, or quotation already linked',
    },
  ]
  const done = factors.filter((f) => f.ok).length
  return {
    score: Math.round((done / factors.length) * 100),
    tooltip: OPPORTUNITY_DEAL_READINESS_TOOLTIP,
    factors,
  }
}

/**
 * Health Score — risk / engagement / momentum (not the same as form completeness).
 */
export function buildOpportunityHealthBreakdown(
  input: OpportunitySmartOverviewInput,
): OpportunityScoreBreakdown {
  const activityCount = input.activityCount ?? 0
  const openFollowUps = input.openFollowUpCount ?? 0
  let score = 35
  const factors: OpportunityScoreFactor[] = []

  const engaged = activityCount > 0
  if (engaged) score += Math.min(20, 8 + activityCount * 4)
  factors.push({
    id: 'engagement',
    label: 'Engagement',
    ok: engaged,
    detail: engaged
      ? `${activityCount} recent activit${activityCount === 1 ? 'y' : 'ies'}`
      : 'No activities logged yet — deal momentum is weak',
  })

  const followUpOk = !input.overdueFollowUp && Boolean(input.nextFollowUpDate)
  if (input.overdueFollowUp) score -= 15
  else if (input.nextFollowUpDate) score += 12
  else score -= 5
  if (openFollowUps > 2) score -= 5
  factors.push({
    id: 'followup',
    label: 'Follow-up discipline',
    ok: followUpOk,
    detail: input.overdueFollowUp
      ? 'Overdue follow-up increases risk'
      : input.nextFollowUpDate
        ? 'Next follow-up is scheduled'
        : 'No follow-up scheduled',
  })

  const stage = input.stage
  const midLate = ['quotation_prepared', 'quotation_sent', 'negotiation', 'won'].includes(stage)
  const earlyStuck = stage === 'new_lead' || stage === 'qualified'
  if (stage === 'won') score += 25
  else if (stage === 'lost') score -= 30
  else if (midLate) score += 15
  else if (earlyStuck) score += 2
  factors.push({
    id: 'momentum',
    label: 'Stage momentum',
    ok: midLate || stage === 'won',
    detail: `Current stage: ${opportunityStageLabel(stage)}`,
  })

  const quoteOk = Boolean(input.quotationId)
  if (quoteOk) score += 10
  factors.push({
    id: 'quote',
    label: 'Commercial traction',
    ok: quoteOk,
    detail: quoteOk ? 'Quotation linked' : 'No quotation yet',
  })

  const probability = input.probability ?? 0
  if (probability >= 50) score += 8
  else if (probability < 25) score -= 5
  factors.push({
    id: 'probability',
    label: 'Win probability',
    ok: probability >= 40,
    detail: `${probability}% stated win chance`,
  })

  if (input.priority === 'critical' || input.priority === 'high') {
    score -= 3
    factors.push({
      id: 'priority',
      label: 'Priority pressure',
      ok: false,
      detail: `${opportunityPriorityLabel(input.priority)} priority needs closer attention`,
    })
  } else {
    factors.push({
      id: 'priority',
      label: 'Priority pressure',
      ok: true,
      detail: `${opportunityPriorityLabel(input.priority)} — manageable pressure`,
    })
  }

  return {
    score: Math.min(100, Math.max(0, Math.round(score))),
    tooltip: OPPORTUNITY_HEALTH_SCORE_TOOLTIP,
    factors,
  }
}

export function buildOpportunitySmartSignals(input: OpportunitySmartOverviewInput): CrmSmartSignal[] {
  const missing: CrmSmartSignal[] = []
  const ok: CrmSmartSignal[] = []

  if (!input.customerId) missing.push({ id: 'company', label: 'Link a company', tone: 'warn' })
  else ok.push({ id: 'company', label: 'Company linked', tone: 'ok' })

  if (!input.hasValidLine) missing.push({ id: 'lines', label: 'Add product lines', tone: 'warn' })
  else ok.push({ id: 'lines', label: `${input.lineCount} line item(s)`, tone: 'ok' })

  if (input.dealValue <= 0) missing.push({ id: 'value', label: 'Set deal value', tone: 'warn' })
  else ok.push({ id: 'value', label: 'Deal value set', tone: 'ok' })

  if (input.overdueFollowUp) missing.push({ id: 'followup', label: 'Follow-up is overdue', tone: 'warn' })
  else if (!input.nextFollowUpDate) missing.push({ id: 'followup', label: 'Plan a follow-up', tone: 'warn' })
  else ok.push({ id: 'followup', label: 'Follow-up scheduled', tone: 'ok' })

  if (!input.quotationId && input.isOpen !== false) {
    missing.push({ id: 'quote', label: 'Create a quotation when ready', tone: 'warn' })
  } else if (input.quotationId) {
    ok.push({ id: 'quote', label: 'Quotation linked', tone: 'ok' })
  }

  return [...missing, ...ok].slice(0, 3)
}

export function resolveOpportunityNextBestAction(input: OpportunitySmartOverviewInput): CrmSmartNextAction {
  if (!input.customerId) {
    return {
      id: 'link_company',
      title: 'Link Company',
      description: 'Select the customer account before you build the deal.',
      ctaLabel: 'Link Company',
      focusField: 'customerId',
      sectionId: 'general',
    }
  }
  if (!input.hasValidLine) {
    return {
      id: 'add_lines',
      title: 'Add Product Lines',
      description: 'Capture at least one product or item line to size the opportunity.',
      ctaLabel: 'Add Lines',
      focusField: 'products',
      sectionId: 'products',
    }
  }
  if (input.dealValue <= 0) {
    return {
      id: 'set_value',
      title: 'Set Deal Value',
      description: 'Enter commercial value so pipeline and forecast stay accurate.',
      ctaLabel: 'Set Value',
      focusField: 'products',
      sectionId: 'products',
    }
  }
  if (input.overdueFollowUp || !input.nextFollowUpDate) {
    return {
      id: 'schedule_followup',
      title: input.overdueFollowUp ? 'Follow Up Today' : 'Schedule Follow-up',
      description: input.overdueFollowUp
        ? 'This deal has an overdue follow-up. Re-engage before it goes cold.'
        : 'No follow-up is planned. Schedule the next touchpoint.',
      ctaLabel: 'Schedule Follow-up',
    }
  }
  if (!input.quotationId && input.isOpen !== false) {
    if (input.canCreateQuotation === false) {
      return {
        id: 'create_quotation',
        title: 'Quotation Blocked',
        description: input.createQuotationLockedReason
          ?? 'Complete stage requirements (lines, value, contact) before creating a quotation.',
        ctaLabel: 'Review Deal',
        sectionId: 'products',
      }
    }
    return {
      id: 'create_quotation',
      title: 'Create Quotation',
      description: 'Lines and value look ready — issue a quotation to advance the deal.',
      ctaLabel: 'Create Quotation',
    }
  }
  if (input.quotationId && !input.salesOrderId && input.canCreateSalesOrder) {
    return {
      id: 'create_so',
      title: 'Create Sales Order',
      description: 'Quotation is accepted and the deal is won. Create the sales order to hand over to ops.',
      ctaLabel: 'Create Sales Order',
    }
  }
  if (input.quotationId && !input.salesOrderId) {
    return {
      id: 'await_so',
      title: 'Sales Order Blocked',
      description: input.createSalesOrderLockedReason
        ?? 'Create Sales Order becomes available after Send → Customer Approve.',
      ctaLabel: 'Review Deal',
    }
  }
  return {
    id: 'review',
    title: 'Keep Momentum',
    description: 'Basics look solid. Review stage and next activity to move the deal forward.',
    ctaLabel: 'Review Deal',
  }
}

export function buildOpportunityAiInsight(input: OpportunitySmartOverviewInput): string | null {
  if (!input.customerId) return 'Start by linking a company so ownership, credit, and history stay on the account.'
  if (!input.hasValidLine) return 'Company is set. Add product lines so the deal has a clear commercial scope.'
  if (input.overdueFollowUp) return 'Follow-up is overdue. Reach out today to protect this opportunity.'
  if (!input.quotationId && input.hasValidLine && input.dealValue > 0) {
    return 'Deal looks quotation-ready. Create a quote while requirements are fresh.'
  }
  if (input.healthScore != null && input.healthScore < 40) {
    return 'Deal health is low. Confirm stage, value, and next follow-up before forecasting this deal.'
  }
  if (input.quotationId && !input.salesOrderId && input.canCreateSalesOrder) {
    return 'Quotation is accepted. Create the sales order to hand over to operations.'
  }
  if (input.quotationId && !input.salesOrderId) {
    return 'Deal looks quotation-ready. Follow up until the customer accepts — then Create Sales Order unlocks.'
  }
  return null
}

export function buildOpportunityKeyDetails(input: OpportunitySmartOverviewInput): CrmSmartKeyDetail[] {
  return [
    { label: 'Stage', value: opportunityStageLabel(input.stage) },
    {
      label: 'Deal Value',
      value: input.dealValue > 0 ? formatCurrency(input.dealValue) : 'Not set',
      muted: input.dealValue <= 0,
    },
    {
      label: 'Weighted',
      value: input.weightedValue > 0 ? formatCurrency(input.weightedValue) : '—',
      muted: input.weightedValue <= 0,
    },
    {
      label: 'Next Follow-up',
      value: input.nextFollowUpDate ? formatDate(input.nextFollowUpDate) : 'Not scheduled',
      muted: !input.nextFollowUpDate,
    },
  ].slice(0, 4)
}

export function opportunityOverviewChips(input: OpportunitySmartOverviewInput): CrmSmartChip[] {
  const status = input.status ?? (input.isOpen === false ? 'Closed' : 'Open')
  const statusTone: CrmSmartChip['tone'] =
    status.toLowerCase() === 'won' ? 'success'
      : status.toLowerCase() === 'lost' || status.toLowerCase() === 'closed' ? 'critical'
        : 'info'
  return [
    { label: status, tone: statusTone },
    { label: opportunityPriorityLabel(input.priority), tone: 'neutral' },
  ]
}

export function opportunityOverviewTitle(input: OpportunitySmartOverviewInput): string {
  return input.opportunityName.trim() || input.customerName.trim() || 'New Opportunity'
}
