import { describe, expect, it } from 'vitest'
import { incomingQueueQuerySchema } from '../src/modules/quality/incoming/incoming-workbench.service.js'

describe('Incoming Quality Unification — unit', () => {
  it('parses queue filters', () => {
    const parsed = incomingQueueQuerySchema.parse({
      vendorId: '11111111-1111-1111-1111-111111111111',
      ageingMinDays: '2',
      limit: '25',
      status: 'IN_PROGRESS',
    })
    expect(parsed.ageingMinDays).toBe(2)
    expect(parsed.limit).toBe(25)
    expect(parsed.status).toBe('IN_PROGRESS')
    expect(parsed.page).toBe(1)
  })

  it('defaults page and limit', () => {
    const parsed = incomingQueueQuerySchema.parse({})
    expect(parsed.page).toBe(1)
    expect(parsed.limit).toBe(50)
  })

  it('permission names for incoming roles are present in constants', async () => {
    const { PERMISSIONS, ROLE_PERMISSIONS } = await import('../src/constants/permissions.js')
    expect(PERMISSIONS).toContain('quality.incoming.view')
    expect(PERMISSIONS).toContain('quality.incoming.assign')
    expect(PERMISSIONS).toContain('inventory.stock_status.view')
    expect(ROLE_PERMISSIONS['Incoming QC Inspector']).toContain('quality.incoming.view')
    expect(ROLE_PERMISSIONS['Incoming QC Inspector']).toContain('purchase.qi.complete')
    expect(ROLE_PERMISSIONS['Quality Manager']).toContain('quality.incoming.report')
    expect(ROLE_PERMISSIONS['Quality Manager']).toContain('quality.approve')
  })
})
