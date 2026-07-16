import { describe, expect, it } from 'vitest'
import { optionalUuid } from '../src/utils/zodHelpers.js'
import { createQuotationSchema } from '../src/modules/crm/quotations/quotation.validation.js'
import { createAttachmentSchema } from '../src/modules/crm/notes/note.validation.js'
import { CRM_MASTER_SEED_ROWS } from '../src/modules/crm/masters/crm-master.seed-data.js'

describe('optionalUuid', () => {
  it('coerces empty string to null', () => {
    expect(optionalUuid.parse('')).toBeNull()
  })

  it('accepts null and undefined', () => {
    expect(optionalUuid.parse(null)).toBeNull()
    expect(optionalUuid.parse(undefined)).toBeUndefined()
  })

  it('accepts a valid uuid', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(optionalUuid.parse(id)).toBe(id)
  })

  it('rejects non-uuid strings', () => {
    expect(() => optionalUuid.parse('not-a-uuid')).toThrow()
  })
})

describe('createQuotationSchema locationId', () => {
  const customerId = '550e8400-e29b-41d4-a716-446655440000'

  it('accepts locationId empty string as null', () => {
    const parsed = createQuotationSchema.parse({
      customerId,
      locationId: '',
    })
    expect(parsed.locationId).toBeNull()
  })

  it('accepts omitted locationId', () => {
    const parsed = createQuotationSchema.parse({ customerId })
    expect(parsed.locationId).toBeUndefined()
  })
})

describe('createAttachmentSchema documentType', () => {
  it('requires documentType', () => {
    const result = createAttachmentSchema.safeParse({
      originalFilename: 'a.pdf',
      mimeType: 'application/pdf',
      contentBase64: 'YWJj',
    })
    expect(result.success).toBe(false)
  })

  it('accepts documentType', () => {
    const parsed = createAttachmentSchema.parse({
      originalFilename: 'a.pdf',
      mimeType: 'application/pdf',
      contentBase64: 'YWJj',
      documentType: 'general',
    })
    expect(parsed.documentType).toBe('general')
  })
})

describe('CRM master seed — opportunity-stages', () => {
  it('includes 10 canonical opportunity-stages', () => {
    const stages = CRM_MASTER_SEED_ROWS.filter((r) => r.kind === 'opportunity-stages')
    expect(stages).toHaveLength(10)
    expect(stages.map((s) => s.code)).toEqual([
      'new_lead',
      'qualified',
      'requirement_discussion',
      'technical_review',
      'quotation_prepared',
      'quotation_sent',
      'negotiation',
      'won',
      'lost',
      'on_hold',
    ])
  })

  it('includes document-types for attachment master', () => {
    const types = CRM_MASTER_SEED_ROWS.filter((r) => r.kind === 'document-types')
    expect(types.length).toBeGreaterThanOrEqual(10)
    expect(types.some((t) => t.code === 'general')).toBe(true)
  })
})
