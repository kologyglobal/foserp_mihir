import type { LeadLifecycleStatus, LeadPriority, LeadStage } from '../types/sales'
import { leadPriorityLabel, leadStageLabel } from './leadUtils'
import { formatCurrency } from './formatters/currency'
import { formatDate } from './dates/format'
import { formatStatus } from '../components/ui/Badge'

export type LeadSmartSignalTone = 'ok' | 'warn'

export interface LeadSmartSignal {
  id: string
  label: string
  tone: LeadSmartSignalTone
}

export type LeadNextActionId =
  | 'link_company'
  | 'complete_contact'
  | 'add_requirement'
  | 'add_commercial'
  | 'schedule_followup'
  | 'create_opportunity'
  | 'create_quotation'

export interface LeadNextBestAction {
  id: LeadNextActionId
  title: string
  description: string
  ctaLabel: string
  /** Form section to expand/scroll, or null for conversion action */
  sectionId: string | null
}

export interface LeadSmartOverviewInput {
  prospectName: string
  customerId: string | null
  contactPerson: string
  mobile: string
  email: string
  productRequirement: string
  remarks: string
  expectedValue: number
  expectedCloseDate: string
  nextFollowUpDate: string
  leadStage: LeadStage
  lifecycleStatus: LeadLifecycleStatus
  priority: LeadPriority
  ownerName: string
  lastSavedLabel: string
  /** When true, next commercial step is quote from the linked opportunity. */
  hasLinkedOpportunity?: boolean
}

function hasCompany(input: LeadSmartOverviewInput) {
  return Boolean(input.customerId || input.prospectName.trim())
}

function hasContact(input: LeadSmartOverviewInput) {
  return Boolean(input.contactPerson.trim() || input.mobile.trim() || input.email.trim())
}

function hasRequirement(input: LeadSmartOverviewInput) {
  return Boolean(input.productRequirement.trim() || input.remarks.trim())
}

function hasCommercial(input: LeadSmartOverviewInput) {
  return input.expectedValue > 0
}

function hasFollowUp(input: LeadSmartOverviewInput) {
  return Boolean(input.nextFollowUpDate)
}

/** Sales-facing qualification % from live form fields (presentation only). */
export function computeLeadQualificationPercent(input: LeadSmartOverviewInput): number {
  const checks = [
    hasCompany(input),
    Boolean(input.customerId),
    hasContact(input),
    hasRequirement(input),
    hasCommercial(input),
    Boolean(input.expectedCloseDate),
    hasFollowUp(input),
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

/** Missing gaps only — lean rail shows warnings, not green checklists. */
export function buildLeadSmartSignals(input: LeadSmartOverviewInput): LeadSmartSignal[] {
  const missing: LeadSmartSignal[] = []

  if (!hasCompany(input)) {
    missing.push({ id: 'company', label: 'Company / prospect missing', tone: 'warn' })
  } else if (!input.customerId) {
    missing.push({ id: 'company-link', label: 'Not linked to Company Master', tone: 'warn' })
  }

  if (!hasContact(input)) {
    missing.push({ id: 'contact', label: 'Contact details incomplete', tone: 'warn' })
  }

  if (!hasRequirement(input)) {
    missing.push({ id: 'requirement', label: 'Requirement not captured', tone: 'warn' })
  }

  if (!hasCommercial(input)) {
    missing.push({ id: 'commercial', label: 'Expected value missing', tone: 'warn' })
  }

  if (!hasFollowUp(input)) {
    missing.push({ id: 'followup', label: 'Follow-up not scheduled', tone: 'warn' })
  }

  return missing.slice(0, 3)
}

export function resolveLeadNextBestAction(input: LeadSmartOverviewInput): LeadNextBestAction {
  if (!hasCompany(input)) {
    return {
      id: 'link_company',
      title: 'Link Company',
      description: 'Add or select a company so this lead can be worked and converted.',
      ctaLabel: 'Link Company',
      sectionId: 'quick',
    }
  }
  if (!hasContact(input)) {
    return {
      id: 'complete_contact',
      title: 'Complete Contact',
      description: 'Add a contact person, mobile, or email to reach this lead.',
      ctaLabel: 'Complete Contact',
      sectionId: 'quick',
    }
  }
  if (!hasRequirement(input)) {
    return {
      id: 'add_requirement',
      title: 'Add Requirement',
      description: 'Capture what the customer needs before you qualify this lead.',
      ctaLabel: 'Add Requirement',
      sectionId: 'quick',
    }
  }
  if (!hasCommercial(input)) {
    return {
      id: 'add_commercial',
      title: 'Add Commercial Details',
      description: 'Enter expected value so pipeline forecasting stays accurate.',
      ctaLabel: 'Add Commercial Details',
      sectionId: 'commercial',
    }
  }
  if (!hasFollowUp(input)) {
    return {
      id: 'schedule_followup',
      title: 'Schedule Follow-up',
      description: 'No follow-up is currently planned for this lead.',
      ctaLabel: 'Schedule Follow-up',
      sectionId: 'followup',
    }
  }
  if (input.hasLinkedOpportunity) {
    return {
      id: 'create_quotation',
      title: 'Create Quotation',
      description: 'This lead has an opportunity — create a quotation from that deal.',
      ctaLabel: 'Create Quotation',
      sectionId: null,
    }
  }
  if (input.leadStage === 'qualified' && input.customerId) {
    return {
      id: 'create_opportunity',
      title: 'Create Opportunity',
      description: 'This lead is qualified and linked — continue in the opportunity pipeline.',
      ctaLabel: 'Create Opportunity',
      sectionId: null,
    }
  }
  return {
    id: 'schedule_followup',
    title: 'Keep Momentum',
    description: 'Basics look solid. Review stage and next follow-up to move the deal forward.',
    ctaLabel: 'Review Follow-up',
    sectionId: 'followup',
  }
}

/**
 * Only when health is complete and the insight is not a restatement of missing/NBA.
 * Gaps are already shown as warning signals + next best action.
 */
export function buildLeadAiInsight(input: LeadSmartOverviewInput): string | null {
  const complete =
    hasCompany(input)
    && hasContact(input)
    && hasRequirement(input)
    && hasCommercial(input)
    && hasFollowUp(input)

  if (!complete) return null
  if (input.hasLinkedOpportunity) return null
  if (input.leadStage === 'qualified' && input.customerId) return null
  if (input.leadStage === 'new') {
    return 'Basics look complete. Advance the stage after your next meaningful conversation.'
  }
  return null
}

export interface LeadKeyDetailRow {
  label: string
  value: string
  muted?: boolean
}

export function buildLeadKeyDetails(input: LeadSmartOverviewInput): LeadKeyDetailRow[] {
  const rows: LeadKeyDetailRow[] = [
    { label: 'Stage', value: leadStageLabel(input.leadStage) },
    {
      label: 'Expected Value',
      value: input.expectedValue > 0 ? formatCurrency(input.expectedValue) : 'Not added',
      muted: input.expectedValue <= 0,
    },
    {
      label: 'Next Follow-up',
      value: input.nextFollowUpDate ? formatDate(input.nextFollowUpDate) : 'Not scheduled',
      muted: !input.nextFollowUpDate,
    },
  ]
  if (input.expectedCloseDate) {
    rows.push({ label: 'Expected Close', value: formatDate(input.expectedCloseDate) })
  }
  return rows.slice(0, 4)
}

export function leadOverviewStatusChips(input: LeadSmartOverviewInput): { label: string; tone: 'info' | 'success' | 'warning' | 'critical' | 'neutral' }[] {
  const statusTone =
    input.leadStage === 'closed' ? 'critical' as const
      : input.leadStage === 'qualified' ? 'success' as const
        : 'info' as const
  return [
    { label: formatStatus(input.lifecycleStatus), tone: statusTone },
    { label: leadPriorityLabel(input.priority), tone: 'neutral' },
  ]
}

export function leadOverviewTitle(input: LeadSmartOverviewInput): string {
  return input.prospectName.trim() || 'New Lead'
}
