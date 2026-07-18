/**
 * Lead edit policy — status / permission / ownership / conversion based.
 * Do NOT permanently lock leads with a generic "submitted" flag.
 *
 * Status matrix (mapped to FOS lead model):
 * | Product status | FOS signal                         | Mode        |
 * |----------------|------------------------------------|-------------|
 * | Draft          | stage `new` (no separate draft)    | full        |
 * | Open           | lifecycle `open`                   | full        |
 * | Qualified      | lifecycle/stage `qualified`        | controlled  |
 * | Converted      | converted / opportunity linked     | limited     |
 * | Disqualified   | stage `not_qualified` or `closed`  | permission  |
 * | Archived       | `isArchived` or soft-deleted       | readonly    |
 *
 * Field-level rules:
 * - full: all business fields; workflow keys (stage/lifecycle/opportunityId) via lifecycle APIs
 * - controlled: lock convert-critical company link once set + immutable leadNo
 * - limited (converted): lock identity / conversion / commercial core; allow notes & follow-up fields
 * - permission (disqualified/closed): same as controlled when `crm.lead.update`; else readonly
 * - readonly (archived): no save
 */

import type { Lead, LeadStage } from '../types/sales'
import { canCrmPermission } from './permissions/crm'
import { getSessionUser } from './permissions'
import { migrateLeadStage } from './leadUtils'

export type LeadEditMode = 'full' | 'controlled' | 'limited' | 'permission' | 'readonly'

export interface LeadEditPolicyInput {
  stage: LeadStage
  lifecycleStatus: Lead['lifecycleStatus']
  opportunityId?: string | null
  leadOwnerId?: string | null
  customerId?: string | null
  isArchived?: boolean
  deletedAt?: string | null
}

export interface LeadEditPolicy {
  mode: LeadEditMode
  lockedFields: string[]
  canSave: boolean
  /** Stage changes go through advanceLeadStage / lifecycle endpoints, not PATCH. */
  canChangeStage: boolean
  reason?: string
}

/** Fields never editable via generic PATCH (workflow / convert endpoints). */
export const LEAD_WORKFLOW_FIELDS = [
  'stage',
  'lifecycleStatus',
  'opportunityId',
  'qualificationStatus',
] as const

/** Converted leads: identity + conversion + commercial core stay locked. */
export const LEAD_CONVERTED_LOCKED_FIELDS = [
  ...LEAD_WORKFLOW_FIELDS,
  'leadNo',
  'prospectName',
  'customerId',
  'contactId',
  'contactPerson',
  'mobile',
  'email',
  'leadOwnerId',
  'source',
  'industry',
  'expectedValue',
  'expectedQty',
  'probability',
  'createdDate',
  'locationId',
] as const

/** Converted leads may still update notes / follow-up / light status. */
export const LEAD_CONVERTED_EDITABLE_FIELDS = [
  'remarks',
  'productRequirement',
  'followUpNotes',
  'nextFollowUpDate',
  'followUpType',
  'priority',
  'activityStatus',
  'expectedCloseDate',
  'inactiveReason',
] as const

const ALL_COMMON_FIELDS = [
  'leadNo',
  'prospectName',
  'customerId',
  'contactId',
  'contactPerson',
  'mobile',
  'email',
  'leadOwnerId',
  'source',
  'industry',
  'priority',
  'expectedValue',
  'expectedQty',
  'probability',
  'productRequirement',
  'remarks',
  'followUpNotes',
  'nextFollowUpDate',
  'followUpType',
  'expectedCloseDate',
  'activityStatus',
  'inactiveReason',
  'createdDate',
  'locationId',
  'notQualifiedReason',
  'closedReason',
  'closedDate',
  ...LEAD_WORKFLOW_FIELDS,
] as const

function unique(fields: readonly string[]): string[] {
  return [...new Set(fields)]
}

function isConverted(lead: LeadEditPolicyInput): boolean {
  const stage = migrateLeadStage(lead.stage)
  return (
    stage === 'converted_to_opportunity'
    || lead.lifecycleStatus === 'converted'
    || Boolean(lead.opportunityId)
  )
}

function isDisqualifiedOrClosed(lead: LeadEditPolicyInput): boolean {
  const stage = migrateLeadStage(lead.stage)
  return stage === 'not_qualified' || stage === 'closed' || lead.lifecycleStatus === 'closed'
}

function isQualified(lead: LeadEditPolicyInput): boolean {
  const stage = migrateLeadStage(lead.stage)
  return stage === 'qualified' || lead.lifecycleStatus === 'qualified'
}

function isOwner(lead: LeadEditPolicyInput, userId: string): boolean {
  return Boolean(userId && lead.leadOwnerId && lead.leadOwnerId === userId)
}

function controlledLockedFields(lead: LeadEditPolicyInput): string[] {
  const locked: string[] = [...LEAD_WORKFLOW_FIELDS, 'leadNo']
  if (lead.customerId?.trim()) locked.push('customerId')
  return unique(locked)
}

function limitedLockedFields(): string[] {
  return unique([...LEAD_CONVERTED_LOCKED_FIELDS])
}

function readonlyLockedFields(): string[] {
  return unique([...ALL_COMMON_FIELDS])
}

/**
 * Resolve edit policy for a lead.
 * Pass `hasUpdatePermission` / `userId` in tests; defaults use session CRM permissions.
 */
export function resolveLeadEditPolicy(
  lead: LeadEditPolicyInput | null | undefined,
  opts?: {
    hasUpdatePermission?: boolean
    userId?: string
  },
): LeadEditPolicy {
  if (!lead) {
    return {
      mode: 'readonly',
      lockedFields: readonlyLockedFields(),
      canSave: false,
      canChangeStage: false,
      reason: 'Lead not found',
    }
  }

  const hasUpdate = opts?.hasUpdatePermission ?? canCrmPermission('crm.lead.update')
  const userId = opts?.userId ?? getSessionUser().id
  const owner = isOwner(lead, userId)
  const mayEditOpen = hasUpdate || owner

  if (lead.deletedAt || lead.isArchived) {
    return {
      mode: 'readonly',
      lockedFields: readonlyLockedFields(),
      canSave: false,
      canChangeStage: false,
      reason: 'Archived leads are read-only',
    }
  }

  if (isConverted(lead)) {
    if (!mayEditOpen) {
      return {
        mode: 'readonly',
        lockedFields: readonlyLockedFields(),
        canSave: false,
        canChangeStage: false,
        reason: 'No permission to edit this converted lead',
      }
    }
    return {
      mode: 'limited',
      lockedFields: limitedLockedFields(),
      canSave: true,
      canChangeStage: false,
      reason: 'Converted lead — identity and conversion fields locked; notes and follow-up editable',
    }
  }

  if (isDisqualifiedOrClosed(lead)) {
    if (!hasUpdate) {
      return {
        mode: 'permission',
        lockedFields: readonlyLockedFields(),
        canSave: false,
        canChangeStage: false,
        reason: 'Disqualified or closed lead requires crm.lead.update permission',
      }
    }
    return {
      mode: 'permission',
      lockedFields: controlledLockedFields(lead),
      canSave: true,
      canChangeStage: true,
      reason: 'Disqualified/closed — editable with update permission (reopen via stage change)',
    }
  }

  if (!mayEditOpen) {
    return {
      mode: 'readonly',
      lockedFields: readonlyLockedFields(),
      canSave: false,
      canChangeStage: false,
      reason: 'No edit permission and not the lead owner',
    }
  }

  if (isQualified(lead)) {
    return {
      mode: 'controlled',
      lockedFields: controlledLockedFields(lead),
      canSave: true,
      canChangeStage: true,
      reason: 'Qualified lead — company link locked when set; use Convert for opportunity',
    }
  }

  // Draft (new) + Open (contacted / requirement_collected)
  return {
    mode: 'full',
    lockedFields: unique([...LEAD_WORKFLOW_FIELDS, 'leadNo']),
    canSave: true,
    canChangeStage: true,
  }
}

export function isLeadFieldLocked(policy: LeadEditPolicy, field: string): boolean {
  if (!policy.canSave || policy.mode === 'readonly') return true
  return policy.lockedFields.includes(field)
}

/** True when the Edit affordance should be shown (any savable mode). */
export function canOpenLeadEditor(policy: LeadEditPolicy): boolean {
  return policy.canSave
}

/**
 * Strip locked / workflow keys from a PATCH-style patch before demo store or API bridge.
 * Returns null when nothing remains to save.
 */
export function filterLeadPatchForPolicy<T extends Record<string, unknown>>(
  patch: T,
  policy: LeadEditPolicy,
): Partial<T> | null {
  if (!policy.canSave) return null
  const next: Partial<T> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    if (LEAD_WORKFLOW_FIELDS.includes(key as (typeof LEAD_WORKFLOW_FIELDS)[number])) continue
    if (policy.lockedFields.includes(key)) continue
    ;(next as Record<string, unknown>)[key] = value
  }
  return Object.keys(next).length > 0 ? next : null
}
