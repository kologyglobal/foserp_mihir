import { describe, expect, it } from 'vitest'
import type { CrmLead } from '@prisma/client'
import { assertLeadConvertible } from '../src/modules/crm/leads/lead.workflow.js'
import { InvalidStateError } from '../src/utils/errors.js'

/** Minimal lead stub — only fields consulted by `assertLeadConvertible`. */
function lead(partial: Partial<CrmLead>): CrmLead {
  return {
    deletedAt: null,
    lifecycleStatus: 'open',
    opportunityId: null,
    stage: 'new',
    isArchived: false,
    ...partial,
  } as CrmLead
}

describe('assertLeadConvertible', () => {
  it('allows qualified stage', () => {
    expect(() => assertLeadConvertible(lead({ stage: 'qualified', lifecycleStatus: 'qualified' }))).not.toThrow()
  })

  it('rejects non-qualified stage', () => {
    expect(() => assertLeadConvertible(lead({ stage: 'contacted', lifecycleStatus: 'open' }))).toThrow(InvalidStateError)
    expect(() => assertLeadConvertible(lead({ stage: 'contacted', lifecycleStatus: 'open' }))).toThrow(/Qualify the lead/i)
  })

  it('rejects disqualified', () => {
    expect(() => assertLeadConvertible(lead({ stage: 'not_qualified', lifecycleStatus: 'closed' }))).toThrow(/Disqualified/i)
  })

  it('rejects already converted', () => {
    expect(() =>
      assertLeadConvertible(lead({ stage: 'qualified', lifecycleStatus: 'converted', opportunityId: 'opp-1' })),
    ).toThrow(/Converted/i)
  })
})
