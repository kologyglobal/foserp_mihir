import { describe, expect, it } from 'vitest'
import type { CrmLead } from '@prisma/client'
import {
  assertLeadConvertible,
  sanitizeLeadUpdateInput,
} from '../src/modules/crm/leads/lead.workflow.js'
import { InvalidStateError } from '../src/utils/errors.js'

/** Minimal lead stub — only fields consulted by workflow helpers. */
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

describe('sanitizeLeadUpdateInput — status-based edit (not permanent lock)', () => {
  it('allows open lead field updates', () => {
    const safe = sanitizeLeadUpdateInput(lead({ stage: 'contacted', lifecycleStatus: 'open' }), {
      remarks: 'Followed up',
      expectedValue: 100000,
    })
    expect(safe.remarks).toBe('Followed up')
    expect(safe.expectedValue).toBe(100000)
  })

  it('strips workflow-only fields from PATCH', () => {
    const safe = sanitizeLeadUpdateInput(lead({ stage: 'new', lifecycleStatus: 'open' }), {
      remarks: 'ok',
      stage: 'qualified',
      lifecycleStatus: 'qualified',
      opportunityId: 'opp-1',
    } as never)
    expect(safe.remarks).toBe('ok')
    expect(safe).not.toHaveProperty('stage')
    expect(safe).not.toHaveProperty('lifecycleStatus')
    expect(safe).not.toHaveProperty('opportunityId')
  })

  it('allows limited notes update on converted lead', () => {
    const safe = sanitizeLeadUpdateInput(
      lead({ stage: 'converted_to_opportunity', lifecycleStatus: 'converted', opportunityId: 'opp-1' }),
      { remarks: 'Post-convert note', followUpNotes: 'Call opp owner' },
    )
    expect(safe.remarks).toBe('Post-convert note')
    expect(safe.followUpNotes).toBe('Call opp owner')
  })

  it('rejects identity update on converted lead', () => {
    expect(() =>
      sanitizeLeadUpdateInput(
        lead({ stage: 'converted_to_opportunity', lifecycleStatus: 'converted', opportunityId: 'opp-1' }),
        { prospectName: 'Hacked Name', customerId: 'cust-1' },
      ),
    ).toThrow(/Converted lead cannot update locked fields/i)
  })

  it('rejects deleted lead updates', () => {
    expect(() =>
      sanitizeLeadUpdateInput(lead({ deletedAt: new Date() }), { remarks: 'x' }),
    ).toThrow(/Archived or deleted/i)
  })
})
