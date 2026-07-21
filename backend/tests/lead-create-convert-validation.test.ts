import { describe, expect, it } from 'vitest'
import { createLeadSchema, convertLeadSchema } from '../src/modules/crm/leads/lead.validation.js'

describe('lead create validation', () => {
  it('rejects create without notes and contact', () => {
    const parsed = createLeadSchema.safeParse({
      prospectName: 'Incomplete',
      leadOwnerId: '11111111-1111-1111-1111-111111111111',
    })
    expect(parsed.success).toBe(false)
  })

  it('accepts create with notes, contact, and mobile', () => {
    const parsed = createLeadSchema.safeParse({
      prospectName: 'Complete Lead',
      leadOwnerId: '11111111-1111-1111-1111-111111111111',
      priority: 'medium',
      remarks: 'Call notes',
      contactPerson: 'Ada',
      mobile: '9876543210',
    })
    expect(parsed.success).toBe(true)
  })
})

describe('lead convert validation', () => {
  it('accepts optional contactId override', () => {
    const parsed = convertLeadSchema.safeParse({
      opportunityName: 'From Lead',
      value: 1000,
      contactId: '22222222-2222-2222-2222-222222222222',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.contactId).toBe('22222222-2222-2222-2222-222222222222')
  })
})
