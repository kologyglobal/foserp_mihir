import { describe, expect, it } from 'vitest'
import type { CrmLead, CrmOpportunity } from '@prisma/client'
import {
  STAGE_REQUIREMENTS_INCOMPLETE,
  StageRequirementsIncompleteError,
  assertLeadStageRequirements,
  assertOpportunityStageRequirements,
  getMissingLeadStageFields,
  getMissingOpportunityStageFields,
  getMissingStageFields,
  leadEntityForStageGate,
  opportunityEntityForStageGate,
} from '../src/modules/crm/stage-requirements.js'

function leadRow(partial: Partial<CrmLead> = {}): CrmLead {
  return {
    id: 'lead-1',
    tenantId: 'tenant-1',
    leadCode: 'L-001',
    prospectName: 'Acme Trailers',
    companyName: null,
    companyId: null,
    contactId: null,
    designation: null,
    email: null,
    mobile: null,
    contactPerson: null,
    source: 'other',
    industry: null,
    turnoverRange: null,
    productRequirement: null,
    expectedQty: null,
    expectedValue: 0 as unknown as CrmLead['expectedValue'],
    probability: 0,
    stage: 'new',
    priority: 'medium',
    lifecycleStatus: 'open',
    activityStatus: 'active',
    qualificationStatus: null,
    temperature: null,
    assignedTo: null,
    ownerId: null,
    lastContactedAt: null,
    nextFollowUpAt: null,
    expectedCloseDate: null,
    inactiveReason: null,
    notQualifiedReason: null,
    closedReason: null,
    closedDate: null,
    lostReason: null,
    remarks: null,
    followUpType: null,
    followUpNotes: null,
    opportunityId: null,
    convertedAt: null,
    isArchived: false,
    locationId: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...partial,
  } as CrmLead
}

function oppRow(partial: Partial<CrmOpportunity> = {}): CrmOpportunity & { lines: [] } {
  return {
    id: 'opp-1',
    tenantId: 'tenant-1',
    opportunityCode: 'O-001',
    name: 'Deal',
    companyId: 'cust-1',
    contactId: null,
    leadId: null,
    pipelineId: 'pipe-1',
    stageId: 'stage-1',
    ownerId: 'user-1',
    amount: 0 as unknown as CrmOpportunity['amount'],
    expectedCloseDate: null,
    probability: 10,
    status: 'OPEN',
    requirement: null,
    competitor: null,
    winReason: null,
    lostReason: null,
    healthScore: 60,
    priority: 'medium',
    lastActivityAt: null,
    nextFollowUpAt: null,
    locationId: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    lines: [],
    ...partial,
  } as CrmOpportunity & { lines: [] }
}

describe('getMissingLeadStageFields', () => {
  it('requires contact fields for contacted', () => {
    const missing = getMissingLeadStageFields(
      leadEntityForStageGate(leadRow({ prospectName: 'Acme' })),
      'contacted',
    )
    expect(missing.map((m) => m.field)).toEqual(['contactPerson', 'mobile'])
    expect(missing[0]?.label).toBe('Contact Person')
  })

  it('allows contacted when contact + mobile present', () => {
    const missing = getMissingLeadStageFields(
      leadEntityForStageGate(
        leadRow({ prospectName: 'Acme', contactPerson: 'Raj', mobile: '9876543210' }),
      ),
      'contacted',
    )
    expect(missing).toEqual([])
  })

  it('requires productRequirement for requirement_collected', () => {
    const missing = getMissingLeadStageFields(leadEntityForStageGate(leadRow()), 'requirement_collected')
    expect(missing).toEqual([{ field: 'productRequirement', label: 'Product Requirement' }])
  })

  it('requires productRequirement, customerId, expectedValue for qualified', () => {
    const missing = getMissingLeadStageFields(leadEntityForStageGate(leadRow()), 'qualified')
    expect(missing.map((m) => m.field)).toEqual(['productRequirement', 'customerId', 'expectedValue'])
  })

  it('maps companyId → customerId and Decimal expectedValue', () => {
    const missing = getMissingLeadStageFields(
      leadEntityForStageGate(
        leadRow({
          companyId: 'cust-1',
          productRequirement: 'Tipper body',
          expectedValue: { toNumber: () => 250000 } as unknown as CrmLead['expectedValue'],
        }),
      ),
      'qualified',
    )
    expect(missing).toEqual([])
  })

  it('merges request-body reason for not_qualified / closed', () => {
    expect(
      getMissingLeadStageFields(
        leadEntityForStageGate(leadRow(), { notQualifiedReason: 'no_budget' }),
        'not_qualified',
      ),
    ).toEqual([])
    expect(
      getMissingLeadStageFields(leadEntityForStageGate(leadRow()), 'closed'),
    ).toEqual([{ field: 'closedReason', label: 'Closed Reason' }])
  })
})

describe('getMissingOpportunityStageFields', () => {
  it('requires scope + commercial for requirement_discussion', () => {
    const missing = getMissingOpportunityStageFields(
      opportunityEntityForStageGate(oppRow()),
      'requirement_discussion',
    )
    expect(missing.map((m) => m.field)).toEqual([
      'productRequirement',
      'contactId',
      'value',
      'expectedCloseDate',
    ])
  })

  it('allows requirement_discussion when fields filled', () => {
    const missing = getMissingOpportunityStageFields(
      opportunityEntityForStageGate(
        oppRow({
          requirement: 'Axle kit',
          contactId: 'contact-1',
          amount: { toNumber: () => 500000 } as unknown as CrmOpportunity['amount'],
          expectedCloseDate: new Date('2026-12-01'),
        }),
      ),
      'requirement_discussion',
    )
    expect(missing).toEqual([])
  })

  it('requires lines with productOrItem for technical_review', () => {
    const emptyLines = getMissingOpportunityStageFields(
      opportunityEntityForStageGate({
        ...oppRow({ requirement: 'Scope' }),
        lines: [{ productOrItem: '', itemCode: '', productId: null }],
      } as ReturnType<typeof oppRow>),
      'technical_review',
    )
    expect(emptyLines.some((m) => m.field === 'lines')).toBe(true)

    const ok = getMissingOpportunityStageFields(
      opportunityEntityForStageGate({
        ...oppRow({ requirement: 'Scope' }),
        lines: [{ productOrItem: 'Trailer chassis', itemCode: 'CH-1', productId: null }],
      } as ReturnType<typeof oppRow>),
      'technical_review',
    )
    expect(ok).toEqual([])
  })
})

describe('assert*StageRequirements', () => {
  it('throws STAGE_REQUIREMENTS_INCOMPLETE with missingFields', () => {
    try {
      assertLeadStageRequirements(leadEntityForStageGate(leadRow()), 'requirement_collected')
      expect.unreachable('should throw')
    } catch (err) {
      expect(err).toBeInstanceOf(StageRequirementsIncompleteError)
      const e = err as StageRequirementsIncompleteError
      expect(e.code).toBe(STAGE_REQUIREMENTS_INCOMPLETE)
      expect(e.statusCode).toBe(422)
      expect(e.missingFields).toEqual([
        { field: 'productRequirement', label: 'Product Requirement' },
      ])
      expect(e.details).toEqual({
        missingFields: [{ field: 'productRequirement', label: 'Product Requirement' }],
      })
      expect(e.errors).toEqual([
        { field: 'productRequirement', message: 'Product Requirement' },
      ])
    }
  })

  it('does not throw when complete', () => {
    expect(() =>
      assertLeadStageRequirements(
        leadEntityForStageGate(leadRow({ productRequirement: 'Tipper' })),
        'requirement_collected',
      ),
    ).not.toThrow()
    expect(() =>
      assertOpportunityStageRequirements(
        opportunityEntityForStageGate(
          oppRow({
            name: 'Deal',
            companyId: 'c1',
            ownerId: 'u1',
          }),
        ),
        'new_lead',
      ),
    ).not.toThrow()
  })
})

describe('getMissingStageFields disambiguation', () => {
  it('treats qualified as lead when lead-shaped', () => {
    const missing = getMissingStageFields(
      { prospectName: 'X', leadOwnerId: 'u1', productRequirement: '', customerId: null, expectedValue: 0 },
      'qualified',
    )
    expect(missing.map((m) => m.field)).toContain('productRequirement')
  })
})
