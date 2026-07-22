/**
 * CRM stage mandatory-field configuration (server mirror of
 * `frontend/src/config/crmStageRequirements.ts` — Task 4.1 / server enforcement).
 *
 * Keep stage codes and field keys/labels aligned with the FE module.
 * Field keys are FE/DTO property names; Prisma columns are mapped in
 * `leadEntityForStageGate` / `opportunityEntityForStageGate`.
 */

import type { CrmLead, CrmOpportunity, CrmOpportunityLine, Prisma } from '@prisma/client'
import { AppError } from '../../utils/errors.js'

export type StageRequirementField = { field: string; label: string }

export const STAGE_REQUIREMENTS_INCOMPLETE = 'STAGE_REQUIREMENTS_INCOMPLETE'
export const STAGE_REQUIREMENTS_MESSAGE =
  'Complete required information before moving the stage.'

const LEGACY_LEAD_STAGE_MAP: Record<string, string> = {
  disqualified: 'not_qualified',
  converted: 'converted_to_opportunity',
}

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

/** Lead stage gates: empty = stage change does not mandate optional fields.
 * Qualify (`qualified`) has no field requirements — product / value / company optional.
 * Convert keeps company link. */
export const LEAD_STAGE_REQUIREMENTS: Record<string, readonly string[]> = {
  new: [],
  contacted: [],
  requirement_collected: [],
  /** No field gates — qualify with empty product / value / company. */
  qualified: [],
  not_qualified: [],
  converted_to_opportunity: ['customerId'],
  closed: [],
}

export const OPPORTUNITY_STAGE_REQUIREMENTS: Record<string, readonly string[]> = {
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

export class StageRequirementsIncompleteError extends AppError {
  readonly missingFields: StageRequirementField[]

  constructor(missingFields: StageRequirementField[]) {
    super(
      422,
      STAGE_REQUIREMENTS_MESSAGE,
      STAGE_REQUIREMENTS_INCOMPLETE,
      missingFields.map((m) => ({ field: m.field, message: m.label })),
      { missingFields },
    )
    this.missingFields = missingFields
  }
}

export function migrateLeadStage(stage: string): string {
  return LEGACY_LEAD_STAGE_MAP[stage] ?? stage
}

export function getLeadStageRequirements(stageCode: string): readonly string[] {
  const stage = migrateLeadStage(stageCode)
  return LEAD_STAGE_REQUIREMENTS[stage] ?? []
}

export function getOpportunityStageRequirements(stageCode: string): readonly string[] {
  return OPPORTUNITY_STAGE_REQUIREMENTS[stageCode] ?? []
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
  if (typeof value === 'object' && value instanceof Date) return !Number.isNaN(value.getTime())
  if (typeof value === 'object' && 'toNumber' in (value as object)) {
    const n = Number((value as { toNumber?: () => number }).toNumber?.() ?? value)
    return Number.isFinite(n) && n > 0
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return false
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

export function getMissingLeadStageFields(
  lead: Record<string, unknown>,
  stageCode: string,
): StageRequirementField[] {
  return missingFieldsFor(lead, getLeadStageRequirements(stageCode), getLeadStageFieldLabel)
}

export function getMissingOpportunityStageFields(
  opportunity: Record<string, unknown>,
  stageCode: string,
): StageRequirementField[] {
  return missingFieldsFor(
    opportunity,
    getOpportunityStageRequirements(stageCode),
    getOpportunityStageFieldLabel,
  )
}

/**
 * Generic helper — prefer typed lead/opportunity helpers when entity type is known.
 * Disambiguates shared code `qualified` via lead-shaped keys.
 */
export function getMissingStageFields(
  entity: Record<string, unknown>,
  stageCode: string,
): StageRequirementField[] {
  const migratedLead = migrateLeadStage(stageCode)
  const isLeadStage = migratedLead in LEAD_STAGE_REQUIREMENTS
  const isOppStage = stageCode in OPPORTUNITY_STAGE_REQUIREMENTS
  const looksLikeLead =
    'leadNo' in entity || 'prospectName' in entity || 'leadOwnerId' in entity

  if (isLeadStage && (!isOppStage || looksLikeLead)) {
    return getMissingLeadStageFields(entity, stageCode)
  }
  if (isOppStage) {
    return getMissingOpportunityStageFields(entity, stageCode)
  }
  return []
}

export function assertLeadStageRequirements(
  lead: Record<string, unknown>,
  targetStageCode: string,
): void {
  const missing = getMissingLeadStageFields(lead, targetStageCode)
  if (missing.length > 0) {
    throw new StageRequirementsIncompleteError(missing)
  }
}

export function assertOpportunityStageRequirements(
  opportunity: Record<string, unknown>,
  targetStageCode: string,
): void {
  const missing = getMissingOpportunityStageFields(opportunity, targetStageCode)
  if (missing.length > 0) {
    throw new StageRequirementsIncompleteError(missing)
  }
}

function dateOrNull(value: Date | string | null | undefined): string | null {
  if (value == null) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  const s = String(value).trim()
  return s.length > 0 ? s : null
}

function decimalToNumber(value: unknown): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return Number((value as { toNumber: () => number }).toNumber())
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Map Prisma lead (+ optional request patch) to FE field keys for gate checks. */
export function leadEntityForStageGate(
  lead: CrmLead,
  patch?: Partial<{
    notQualifiedReason: string | null
    closedReason: string | null
    productRequirement: string | null
    expectedValue: number | null
    customerId: string | null
    contactPerson: string | null
    mobile: string | null
    prospectName: string | null
  }>,
): Record<string, unknown> {
  return {
    prospectName: lead.prospectName,
    customerId: lead.companyId,
    contactPerson: lead.contactPerson,
    contactId: lead.contactId,
    mobile: lead.mobile,
    email: lead.email,
    leadOwnerId: lead.assignedTo ?? lead.ownerId,
    source: lead.source,
    industry: lead.industry,
    productRequirement: lead.productRequirement,
    expectedValue: decimalToNumber(lead.expectedValue),
    expectedQty: lead.expectedQty,
    expectedCloseDate: dateOrNull(lead.expectedCloseDate),
    priority: lead.priority,
    nextFollowUpDate: dateOrNull(lead.nextFollowUpAt),
    followUpType: lead.followUpType,
    notQualifiedReason: lead.notQualifiedReason,
    closedReason: lead.closedReason,
    remarks: lead.remarks,
    leadNo: lead.leadCode,
    ...patch,
  }
}

type OpportunityWithLines = CrmOpportunity & {
  lines?: CrmOpportunityLine[] | Prisma.CrmOpportunityLineGetPayload<object>[]
}

/** Map Prisma opportunity (+ lines) to FE field keys for gate checks. */
export function opportunityEntityForStageGate(
  opportunity: OpportunityWithLines,
  patch?: Partial<{
    lostReason: string | null
    value: number | null
    productRequirement: string | null
    contactId: string | null
    expectedCloseDate: string | null
    nextFollowUpDate: string | null
  }>,
): Record<string, unknown> {
  return {
    opportunityName: opportunity.name,
    customerId: opportunity.companyId,
    contactId: opportunity.contactId,
    ownerId: opportunity.ownerId,
    productRequirement: opportunity.requirement,
    lines: opportunity.lines ?? [],
    value: decimalToNumber(opportunity.amount),
    probability: opportunity.probability,
    expectedCloseDate: dateOrNull(opportunity.expectedCloseDate),
    priority: opportunity.priority,
    nextFollowUpDate: dateOrNull(opportunity.nextFollowUpAt),
    lostReason: opportunity.lostReason,
    ...patch,
  }
}
