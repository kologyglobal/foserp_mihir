import type { CrmOpportunity } from '@prisma/client'
import { InvalidStateError, ValidationError } from '../../../utils/errors.js'
import type { UpdateOpportunityInput } from './opportunity.validation.js'

const WORKFLOW_ONLY_FIELDS = [
  'status',
  'stage',
  'stageId',
  'ownerId',
  'lostReason',
  'winReason',
] as const

export function assertOpportunityMutable(opp: CrmOpportunity): void {
  if (opp.deletedAt) {
    throw new InvalidStateError('Deleted opportunity cannot be updated')
  }
  if (opp.status === 'ARCHIVED') {
    throw new InvalidStateError('Archived opportunity cannot be updated')
  }
}

export function assertOpportunityOpen(opp: CrmOpportunity): void {
  assertOpportunityMutable(opp)
  if (opp.status !== 'OPEN') {
    throw new InvalidStateError('Closed opportunity cannot be changed — reopen first')
  }
}

export function assertOpportunityClosable(opp: CrmOpportunity): void {
  assertOpportunityMutable(opp)
  if (opp.status === 'WON' || opp.status === 'LOST') {
    throw new InvalidStateError('Opportunity already closed')
  }
}

export function assertOpportunityReopenable(opp: CrmOpportunity): void {
  assertOpportunityMutable(opp)
  if (opp.status !== 'WON' && opp.status !== 'LOST') {
    throw new InvalidStateError('Only won or lost opportunities can be reopened')
  }
}

export function sanitizeOpportunityUpdateInput(
  opp: CrmOpportunity,
  input: UpdateOpportunityInput,
): UpdateOpportunityInput {
  assertOpportunityMutable(opp)

  for (const key of WORKFLOW_ONLY_FIELDS) {
    if (key in input && input[key as keyof UpdateOpportunityInput] !== undefined) {
      throw new ValidationError(
        `Field "${key}" cannot be changed via update — use the dedicated workflow action`,
      )
    }
  }

  if (input.value !== undefined && input.value < 0) {
    throw new ValidationError('Opportunity amount cannot be negative')
  }

  if (input.probability !== undefined && (input.probability < 0 || input.probability > 100)) {
    throw new ValidationError('Probability must be between 0 and 100')
  }

  if (opp.status !== 'OPEN' && (input.stageId !== undefined || input.stage !== undefined || input.pipelineId !== undefined)) {
    throw new InvalidStateError('Closed opportunity cannot move pipeline stage')
  }

  return input
}
