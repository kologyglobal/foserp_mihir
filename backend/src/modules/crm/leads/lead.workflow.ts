import type { CrmLead } from '@prisma/client'
import { InvalidStateError } from '../../../utils/errors.js'
import type { UpdateLeadInput } from './lead.validation.js'

const WORKFLOW_ONLY_FIELDS = ['stage', 'lifecycleStatus', 'qualificationStatus', 'opportunityId'] as const

/** Converted leads may PATCH notes / follow-up / light commercial — not identity or conversion. */
const CONVERTED_ALLOWED_FIELDS = [
  'remarks',
  'productRequirement',
  'followUpNotes',
  'nextFollowUpDate',
  'followUpType',
  'priority',
  'activityStatus',
  'expectedCloseDate',
  'inactiveReason',
  'isArchived',
] as const

function assertLeadNotDeleted(lead: CrmLead): void {
  if (lead.deletedAt) {
    throw new InvalidStateError('Archived or deleted lead cannot be updated')
  }
}

/**
 * Soft mutability for PATCH — archived/deleted blocked; converted allowed with field filter.
 * Prefer `sanitizeLeadUpdateInput` for updates.
 */
export function assertLeadMutable(lead: CrmLead): void {
  assertLeadNotDeleted(lead)
}

/**
 * Hard lock for lifecycle actions (assign / qualify / convert / stage change).
 * Converted and archived leads cannot change workflow state.
 */
export function assertLeadWorkflowMutable(lead: CrmLead): void {
  assertLeadNotDeleted(lead)
  if (lead.isArchived) {
    throw new InvalidStateError('Archived lead cannot change workflow state')
  }
  if (lead.lifecycleStatus === 'converted' || lead.opportunityId) {
    throw new InvalidStateError('Converted lead cannot be modified — update the linked opportunity instead')
  }
}

export function assertLeadAssignable(lead: CrmLead): void {
  assertLeadWorkflowMutable(lead)
}

export function assertLeadQualifiable(lead: CrmLead): void {
  assertLeadWorkflowMutable(lead)
  if (lead.stage === 'not_qualified' || lead.lifecycleStatus === 'closed') {
    throw new InvalidStateError('Lost or disqualified lead cannot be qualified without reopening')
  }
}

export function assertLeadDisqualifiable(lead: CrmLead): void {
  assertLeadWorkflowMutable(lead)
}

export function assertLeadConvertible(lead: CrmLead): void {
  assertLeadWorkflowMutable(lead)
  if (lead.stage === 'not_qualified') {
    throw new InvalidStateError('Disqualified lead cannot be converted — reopen the lead first')
  }
  if (lead.stage !== 'qualified' && lead.lifecycleStatus !== 'qualified') {
    throw new InvalidStateError('Qualify the lead before converting to an opportunity')
  }
}

export function sanitizeLeadUpdateInput(lead: CrmLead, input: UpdateLeadInput): UpdateLeadInput {
  assertLeadNotDeleted(lead)

  const safe = { ...input }
  for (const key of WORKFLOW_ONLY_FIELDS) {
    if (key in safe) {
      delete safe[key as keyof UpdateLeadInput]
    }
  }

  if (lead.isArchived) {
    if (Object.keys(safe).some((k) => k !== 'isArchived' && k !== 'activityStatus')) {
      throw new InvalidStateError('Archived lead can only be restored or have activity status changed')
    }
    return safe
  }

  const isConverted = lead.lifecycleStatus === 'converted' || Boolean(lead.opportunityId)
  if (isConverted) {
    const keys = Object.keys(safe).filter((k) => safe[k as keyof UpdateLeadInput] !== undefined)
    const forbidden = keys.filter(
      (k) => !(CONVERTED_ALLOWED_FIELDS as readonly string[]).includes(k),
    )
    if (forbidden.length > 0) {
      throw new InvalidStateError(
        `Converted lead cannot update locked fields: ${forbidden.join(', ')}`,
      )
    }
  }

  return safe
}
