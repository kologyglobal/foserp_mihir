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
  lineCount: number
  hasValidLine: boolean
  expectedCloseDate?: string | null
  nextFollowUpDate?: string | null
  quotationId?: string | null
  salesOrderId?: string | null
  healthScore?: number
  overdueFollowUp?: boolean
  isOpen?: boolean
  lastSavedLabel?: string
}

export function computeOpportunityCompleteness(input: OpportunitySmartOverviewInput): number {
  const checks = [
    Boolean(input.opportunityName.trim()),
    Boolean(input.customerId),
    input.hasValidLine,
    input.dealValue > 0,
    Boolean(input.expectedCloseDate),
    Boolean(input.nextFollowUpDate) || Boolean(input.quotationId),
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

export function buildOpportunitySmartSignals(input: OpportunitySmartOverviewInput): CrmSmartSignal[] {
  const missing: CrmSmartSignal[] = []
  const ok: CrmSmartSignal[] = []

  if (!input.customerId) missing.push({ id: 'company', label: 'Company not linked', tone: 'warn' })
  else ok.push({ id: 'company', label: 'Company linked', tone: 'ok' })

  if (!input.hasValidLine) missing.push({ id: 'lines', label: 'Product lines incomplete', tone: 'warn' })
  else ok.push({ id: 'lines', label: `${input.lineCount} line item(s)`, tone: 'ok' })

  if (input.dealValue <= 0) missing.push({ id: 'value', label: 'Deal value not set', tone: 'warn' })
  else ok.push({ id: 'value', label: 'Deal value set', tone: 'ok' })

  if (input.overdueFollowUp) missing.push({ id: 'followup', label: 'Follow-up overdue', tone: 'warn' })
  else if (!input.nextFollowUpDate) missing.push({ id: 'followup', label: 'Follow-up not scheduled', tone: 'warn' })
  else ok.push({ id: 'followup', label: 'Follow-up scheduled', tone: 'ok' })

  if (!input.quotationId && input.isOpen !== false) {
    missing.push({ id: 'quote', label: 'No quotation yet', tone: 'warn' })
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
    }
  }
  if (!input.hasValidLine) {
    return {
      id: 'add_lines',
      title: 'Add Product Lines',
      description: 'Capture at least one product or item line to size the opportunity.',
      ctaLabel: 'Add Lines',
    }
  }
  if (input.dealValue <= 0) {
    return {
      id: 'set_value',
      title: 'Set Deal Value',
      description: 'Enter commercial value so pipeline and forecast stay accurate.',
      ctaLabel: 'Set Value',
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
    return {
      id: 'create_quotation',
      title: 'Create Quotation',
      description: 'Lines and value look ready — issue a quotation to advance the deal.',
      ctaLabel: 'Create Quotation',
    }
  }
  if (input.quotationId && !input.salesOrderId && input.isOpen !== false) {
    return {
      id: 'create_so',
      title: 'Create Sales Order',
      description: 'Quotation is in place. Convert to a sales order when the customer confirms.',
      ctaLabel: 'Create Sales Order',
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
  if (input.quotationId && !input.salesOrderId) {
    return 'Quotation is linked. Follow up on acceptance and convert to a sales order when ready.'
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
