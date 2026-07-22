/**
 * CRM stage mandatory-field configuration (Task 4.1).
 *
 * Source of truth for which Lead / Opportunity fields must be filled before
 * advancing into (or remaining gate-eligible for) a pipeline stage.
 *
 * Stage codes match CRM master seeds (`lead-stages`, `opportunity-stages`) and
 * TypeScript unions in `types/sales` / `types/crm` — not invented enums.
 *
 * Field keys are real model property names on `Lead` / `Opportunity`.
 *
 * Future: these maps can move to backend/DB (e.g. stage master
 * `attributes.requiredFields` as a comma-separated list — already foreshadowed
 * on lead stage `requirement_collected` in `crmMastersSeed`). Keep this module
 * as the FE gate reader until then; do not hardcode rules inside 360 pages.
 */

import type { Lead, LeadStage } from '../types/sales'
import type { Opportunity, OpportunityStage } from '../types/crm'

/** Local copy of leadUtils legacy map — avoid importing store/permission graph into config. */
const LEGACY_LEAD_STAGE_MAP: Record<string, LeadStage> = {
  disqualified: 'not_qualified',
  converted: 'converted_to_opportunity',
}

function normalizeLeadStageCode(stageCode: string): LeadStage {
  return LEGACY_LEAD_STAGE_MAP[stageCode] ?? (stageCode as LeadStage)
}

export type StageRequirementField = { field: string; label: string }

/** Human labels for validation messages — keyed by Lead model property. */
export const LEAD_STAGE_FIELD_LABELS: Record<string, string> = {
  prospectName: 'Company / Prospect',
  customerId: 'Linked Company',
  contactPerson: 'Contact Person',
  contactId: 'Contact',
  mobile: 'Mobile',
  email: 'Email',
  leadOwnerId: 'Lead Owner',
  source: 'Lead Source',
  industry: 'Industry',
  productRequirement: 'Product Requirement',
  expectedValue: 'Expected Value',
  expectedQty: 'Expected Qty',
  expectedCloseDate: 'Expected Close Date',
  priority: 'Priority',
  nextFollowUpDate: 'Next Follow-up Date',
  followUpType: 'Follow-up Type',
  notQualifiedReason: 'Not Qualified Reason',
  closedReason: 'Closed Reason',
  remarks: 'Remarks',
}

/** Human labels for validation messages — keyed by Opportunity model property. */
export const OPPORTUNITY_STAGE_FIELD_LABELS: Record<string, string> = {
  opportunityName: 'Opportunity Name',
  customerId: 'Customer',
  contactId: 'Contact',
  ownerId: 'Owner',
  productId: 'Product',
  productRequirement: 'Product Requirement',
  lines: 'Item Lines',
  value: 'Deal Value',
  probability: 'Probability',
  expectedCloseDate: 'Expected Close Date',
  priority: 'Priority',
  nextFollowUpDate: 'Next Follow-up Date',
  lostReason: 'Lost Reason',
  quotationId: 'Quotation',
}

/**
 * Mandatory fields to enter / occupy each lead stage.
 * Empty arrays = stage change does not gate on optional / collapsed fields.
 * Convert still requires a linked company (conversion safeguard).
 */
export const LEAD_STAGE_REQUIREMENTS: Record<LeadStage, readonly string[]> = {
  new: [],
  contacted: [],
  requirement_collected: [],
  qualified: [],
  not_qualified: [],
  converted_to_opportunity: ['customerId'],
  closed: [],
}

/**
 * Mandatory fields to enter / occupy each opportunity stage.
 * Terminal won/lost keep commercial gates elsewhere (approved quotation / lost reason UI);
 * lost still lists `lostReason` here so config consumers can surface it uniformly.
 */
export const OPPORTUNITY_STAGE_REQUIREMENTS: Record<OpportunityStage, readonly string[]> = {
  new_lead: ['opportunityName', 'customerId', 'ownerId'],
  qualified: ['productRequirement', 'expectedCloseDate', 'priority'],
  requirement_discussion: ['productRequirement', 'contactId', 'value', 'expectedCloseDate'],
  technical_review: ['productRequirement', 'lines'],
  quotation_prepared: ['lines', 'value'],
  quotation_sent: ['value', 'expectedCloseDate'],
  negotiation: ['value', 'expectedCloseDate', 'contactId'],
  won: ['value', 'expectedCloseDate'],
  lost: ['lostReason'],
  on_hold: ['nextFollowUpDate'],
}

export function getLeadStageRequirements(stageCode: string): readonly string[] {
  const stage = normalizeLeadStageCode(stageCode)
  return LEAD_STAGE_REQUIREMENTS[stage] ?? []
}

export function getOpportunityStageRequirements(stageCode: string): readonly string[] {
  return OPPORTUNITY_STAGE_REQUIREMENTS[stageCode as OpportunityStage] ?? []
}

export function getLeadStageFieldLabel(field: string): string {
  return LEAD_STAGE_FIELD_LABELS[field] ?? field
}

export function getOpportunityStageFieldLabel(field: string): string {
  return OPPORTUNITY_STAGE_FIELD_LABELS[field] ?? field
}

/** True when a configured field value counts as filled for stage gates. */
export function isStageFieldFilled(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value) && value > 0
  if (typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    if (value.length === 0) return false
    // Opportunity lines: at least one row with a product/item name
    return value.some((row) => {
      if (row == null || typeof row !== 'object') return true
      const line = row as { productOrItem?: string; itemCode?: string; productId?: string | null }
      return Boolean(
        line.productOrItem?.trim()
        || line.itemCode?.trim()
        || line.productId?.trim(),
      )
    })
  }
  return true
}

function missingFieldsFor(
  entity: Record<string, unknown>,
  fields: readonly string[],
  labelOf: (field: string) => string,
): StageRequirementField[] {
  const missing: StageRequirementField[] = []
  for (const field of fields) {
    if (!isStageFieldFilled(entity[field])) {
      missing.push({ field, label: labelOf(field) })
    }
  }
  return missing
}

/**
 * Returns mandatory fields that are empty on the entity for the given stage.
 *
 * Prefer `getMissingLeadStageFields` / `getMissingOpportunityStageFields` when
 * the entity type is known. This helper disambiguates the shared code
 * `qualified` via lead-shaped keys (`leadNo`, `prospectName`, `leadOwnerId`).
 * Unknown stage codes yield an empty list.
 */
export function getMissingStageFields(
  entity: Partial<Lead> | Partial<Opportunity> | Record<string, unknown>,
  stageCode: string,
): StageRequirementField[] {
  const record = entity as Record<string, unknown>
  const migratedLead = normalizeLeadStageCode(stageCode)
  const isLeadStage = migratedLead in LEAD_STAGE_REQUIREMENTS
  const isOppStage = stageCode in OPPORTUNITY_STAGE_REQUIREMENTS
  const looksLikeLead =
    'leadNo' in record || 'prospectName' in record || 'leadOwnerId' in record

  if (isLeadStage && (!isOppStage || looksLikeLead)) {
    return missingFieldsFor(record, getLeadStageRequirements(stageCode), getLeadStageFieldLabel)
  }
  if (isOppStage) {
    return missingFieldsFor(
      record,
      getOpportunityStageRequirements(stageCode),
      getOpportunityStageFieldLabel,
    )
  }
  return []
}

/** Convenience: missing fields for a lead at a specific stage (no entity-type heuristics). */
export function getMissingLeadStageFields(
  lead: Partial<Lead> | Record<string, unknown>,
  stageCode: string,
): StageRequirementField[] {
  return missingFieldsFor(
    lead as Record<string, unknown>,
    getLeadStageRequirements(stageCode),
    getLeadStageFieldLabel,
  )
}

/** Convenience: missing fields for an opportunity at a specific stage. */
export function getMissingOpportunityStageFields(
  opportunity: Partial<Opportunity> | Record<string, unknown>,
  stageCode: string,
): StageRequirementField[] {
  return missingFieldsFor(
    opportunity as Record<string, unknown>,
    getOpportunityStageRequirements(stageCode),
    getOpportunityStageFieldLabel,
  )
}

export function canAdvanceToLeadStage(
  lead: Partial<Lead> | Record<string, unknown>,
  stageCode: string,
): boolean {
  return getMissingLeadStageFields(lead, stageCode).length === 0
}

export function canAdvanceToOpportunityStage(
  opportunity: Partial<Opportunity> | Record<string, unknown>,
  stageCode: string,
): boolean {
  return getMissingOpportunityStageFields(opportunity, stageCode).length === 0
}

/** Field-based stage gate progress — notes/attachments are not part of this %. */
export type StageCompleteness = {
  requiredCount: number
  completedCount: number
  /** 0–100; 100 when requiredCount is 0 or all mandatory fields are filled. */
  percent: number
  missingFields: StageRequirementField[]
  isComplete: boolean
}

export function buildStageCompleteness(
  requiredFields: readonly string[],
  missingFields: StageRequirementField[],
): StageCompleteness {
  const requiredCount = requiredFields.length
  const completedCount = Math.max(0, requiredCount - missingFields.length)
  const percent =
    requiredCount === 0 ? 100 : Math.round((completedCount / requiredCount) * 100)
  return {
    requiredCount,
    completedCount,
    percent,
    missingFields,
    isComplete: missingFields.length === 0,
  }
}

export function getLeadStageCompleteness(
  lead: Partial<Lead> | Record<string, unknown>,
  stageCode: string,
): StageCompleteness {
  const required = getLeadStageRequirements(stageCode)
  return buildStageCompleteness(required, getMissingLeadStageFields(lead, stageCode))
}

export function getOpportunityStageCompleteness(
  opportunity: Partial<Opportunity> | Record<string, unknown>,
  stageCode: string,
): StageCompleteness {
  const required = getOpportunityStageRequirements(stageCode)
  return buildStageCompleteness(
    required,
    getMissingOpportunityStageFields(opportunity, stageCode),
  )
}

/** Format a short toast / notify line from missing stage fields. */
export function formatMissingStageFieldsMessage(
  missingFields: StageRequirementField[],
  stageLabel?: string,
): string {
  const list = missingFields.map((m) => m.label).join(', ')
  const prefix = stageLabel
    ? `Cannot move to ${stageLabel} — complete mandatory fields`
    : 'Complete mandatory stage fields'
  return list ? `${prefix}: ${list}` : `${prefix}.`
}
