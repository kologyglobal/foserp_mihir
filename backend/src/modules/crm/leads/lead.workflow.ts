import type { CrmLead } from '@prisma/client'
import { InvalidStateError } from '../../../utils/errors.js'
import type { UpdateLeadInput } from './lead.validation.js'

const WORKFLOW_ONLY_FIELDS = ['stage', 'lifecycleStatus', 'qualificationStatus', 'opportunityId'] as const

export function assertLeadMutable(lead: CrmLead): void {
  if (lead.deletedAt) {
    throw new InvalidStateError('Archived or deleted lead cannot be updated')
  }
  if (lead.lifecycleStatus === 'converted' || lead.opportunityId) {
    throw new InvalidStateError('Converted lead cannot be modified — update the linked opportunity instead')
  }
}

export function assertLeadAssignable(lead: CrmLead): void {
  assertLeadMutable(lead)
}

export function assertLeadQualifiable(lead: CrmLead): void {
  assertLeadMutable(lead)
  if (lead.stage === 'not_qualified' || lead.lifecycleStatus === 'closed') {
    throw new InvalidStateError('Lost or disqualified lead cannot be qualified without reopening')
  }
}

export function assertLeadDisqualifiable(lead: CrmLead): void {
  assertLeadMutable(lead)
}

export function assertLeadConvertible(lead: CrmLead): void {
  assertLeadMutable(lead)
  if (lead.stage === 'not_qualified') {
    throw new InvalidStateError('Disqualified lead cannot be converted — reopen the lead first')
  }
  if (lead.stage !== 'qualified' && lead.lifecycleStatus !== 'qualified') {
    throw new InvalidStateError('Qualify the lead before converting to an opportunity')
  }
}

export function sanitizeLeadUpdateInput(lead: CrmLead, input: UpdateLeadInput): UpdateLeadInput {
  assertLeadMutable(lead)

  const safe = { ...input }
  for (const key of WORKFLOW_ONLY_FIELDS) {
    if (key in safe) {
      delete safe[key as keyof UpdateLeadInput]
    }
  }

  if (lead.isArchived && Object.keys(safe).some((k) => k !== 'isArchived' && k !== 'activityStatus')) {
    throw new InvalidStateError('Archived lead can only be restored or have activity status changed')
  }

  return safe
}
