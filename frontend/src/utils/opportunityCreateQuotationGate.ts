import { useCrmStore } from '../store/crmStore'
import { canCrmPermission } from './permissions/crm'
import {
  getMissingOpportunityStageFields,
  getOpportunityStageCompleteness,
} from '../config/crmStageRequirements'
import { opportunityStageLabel } from './opportunityUtils'
import type { Opportunity, OpportunityStage } from '../types/crm'

/** Stages where creating a quotation is the expected commercial next step. */
const QUOTATION_READY_STAGES = new Set<OpportunityStage>([
  'requirement_discussion',
  'technical_review',
  'quotation_prepared',
  'quotation_sent',
  'negotiation',
])

const EARLY_STAGES = new Set<OpportunityStage>(['new_lead', 'qualified'])

export const CREATE_QUOTATION_LOCKED_REASON =
  'Complete opportunity requirements before creating a quotation.'

const REASON_PERMISSION = 'You do not have permission to create quotations.'
const REASON_CLOSED = 'Closed opportunities cannot create a new quotation.'
const REASON_ON_HOLD = 'Resume this opportunity from On Hold before creating a quotation.'
const REASON_EARLY =
  'Move the deal to Requirement Discussion or Technical Review (with lines and value) before creating a quotation.'
const REASON_NO_LINES = 'Add at least one product line before creating a quotation.'
const REASON_NO_VALUE = 'Set a deal value greater than zero before creating a quotation.'
const REASON_NO_CUSTOMER = 'Link a customer before creating a quotation.'

export interface OpportunityCreateQuotationGate {
  showCreate: boolean
  enabled: boolean
  disabledReason: string | null
  missingFields: { field: string; label: string }[]
  /** Stage used for field gates (current stage, or quotation_prepared for early stages). */
  gateStage: OpportunityStage | null
}

function hasValidLines(opp: Opportunity): boolean {
  return (opp.lines ?? []).some((l) => Boolean(l.productId || l.description?.trim()) && l.qty > 0)
}

/**
 * Gate for Create Quotation from Opportunity 360 / list / Smart Context.
 * Validates stage-appropriate mandatory fields so the button does not fail silently.
 */
export function resolveOpportunityCreateQuotationGate(
  opportunityId?: string | null,
): OpportunityCreateQuotationGate {
  const empty: OpportunityCreateQuotationGate = {
    showCreate: false,
    enabled: false,
    disabledReason: CREATE_QUOTATION_LOCKED_REASON,
    missingFields: [],
    gateStage: null,
  }

  if (!opportunityId) return empty

  const canCreate = canCrmPermission('crm.quotation.create')
  if (!canCreate) {
    return { ...empty, showCreate: false, disabledReason: REASON_PERMISSION }
  }

  const opp = useCrmStore.getState().getOpportunity(opportunityId)
  if (!opp) return empty

  if (opp.status === 'lost' || opp.stage === 'lost' || opp.stage === 'won') {
    return {
      showCreate: false,
      enabled: false,
      disabledReason: REASON_CLOSED,
      missingFields: [],
      gateStage: opp.stage,
    }
  }

  if (opp.stage === 'on_hold' || opp.status === 'on_hold') {
    return {
      showCreate: true,
      enabled: false,
      disabledReason: REASON_ON_HOLD,
      missingFields: [],
      gateStage: opp.stage,
    }
  }

  if (!opp.customerId) {
    return {
      showCreate: true,
      enabled: false,
      disabledReason: REASON_NO_CUSTOMER,
      missingFields: [{ field: 'customerId', label: 'Customer' }],
      gateStage: opp.stage,
    }
  }

  if (EARLY_STAGES.has(opp.stage) && !hasValidLines(opp)) {
    return {
      showCreate: true,
      enabled: false,
      disabledReason: REASON_EARLY,
      missingFields: getMissingOpportunityStageFields(opp, 'technical_review'),
      gateStage: 'technical_review',
    }
  }

  // Gate against current stage requirements; for early stages use technical_review / quotation_prepared commercial bar.
  const gateStage: OpportunityStage = QUOTATION_READY_STAGES.has(opp.stage)
    ? opp.stage
    : 'quotation_prepared'

  const completeness = getOpportunityStageCompleteness(opp, gateStage)
  if (!completeness.isComplete) {
    const list = completeness.missingFields.map((m) => m.label).join(', ')
    return {
      showCreate: true,
      enabled: false,
      disabledReason: list
        ? `Complete mandatory fields for ${opportunityStageLabel(gateStage)} before creating a quotation: ${list}`
        : CREATE_QUOTATION_LOCKED_REASON,
      missingFields: completeness.missingFields,
      gateStage,
    }
  }

  if (!hasValidLines(opp) && !opp.productId) {
    return {
      showCreate: true,
      enabled: false,
      disabledReason: REASON_NO_LINES,
      missingFields: [{ field: 'lines', label: 'Item Lines' }],
      gateStage,
    }
  }

  if (!(opp.value > 0)) {
    return {
      showCreate: true,
      enabled: false,
      disabledReason: REASON_NO_VALUE,
      missingFields: [{ field: 'value', label: 'Deal Value' }],
      gateStage,
    }
  }

  return {
    showCreate: true,
    enabled: true,
    disabledReason: null,
    missingFields: [],
    gateStage,
  }
}
