import { describe, expect, it } from 'vitest'
import { INVENTORY_GL_REASON_CODES } from '../../src/modules/accounting/inventory-gl-reconciliation/inventory-gl-reconciliation.types.js'
import {
  inventoryGlTrialBalanceQuerySchema,
  retryFailedEventBodySchema,
  unifiedFailedEventsQuerySchema,
} from '../../src/modules/accounting/inventory-gl-reconciliation/inventory-gl-reconciliation.schemas.js'

describe('FIN-CLOSE-1 inventory GL reconciliation contracts', () => {
  it('exposes GL-oriented reason codes and never Force Balance', () => {
    expect(INVENTORY_GL_REASON_CODES).toContain('ACCOUNTING_EVENT_FAILED')
    expect(INVENTORY_GL_REASON_CODES).toContain('GRIR_NOT_CLEARED')
    expect(INVENTORY_GL_REASON_CODES).toContain('MANUAL_GL_ENTRY_DIFFERENCE')
    expect(INVENTORY_GL_REASON_CODES).not.toContain('FORCE_BALANCE')
  })

  it('accepts trial-balance query shape', () => {
    const parsed = inventoryGlTrialBalanceQuerySchema.parse({
      asOfDate: '2026-07-29',
      tolerance: '0.01',
    })
    expect(parsed.asOfDate).toBe('2026-07-29')
  })

  it('accepts failed-events filters', () => {
    const parsed = unifiedFailedEventsQuerySchema.parse({
      source: 'ALL',
      includeUnposted: 'true',
      page: '1',
      limit: '25',
    })
    expect(parsed.includeUnposted).toBe(true)
    expect(parsed.limit).toBe(25)
  })

  it('requires source on retry body', () => {
    expect(() => retryFailedEventBodySchema.parse({})).toThrow()
    expect(retryFailedEventBodySchema.parse({ source: 'INVENTORY' }).source).toBe('INVENTORY')
  })
})
