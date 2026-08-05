/**
 * Phase 7 — e-Way Bill pure unit tests.
 */
import { describe, expect, it } from 'vitest'
import {
  checkEwaySourceReadiness,
  evaluateThreshold,
  planEwayExtension,
  planEwayGenerate,
  validateEwayPartA,
  validateEwayPartB,
} from '../src/modules/accounting/tax-compliance/eway-readiness.util.js'

describe('evaluateThreshold', () => {
  it('marks required above threshold', () => {
    const r = evaluateThreshold(75_000, 50_000)
    expect(r.required).toBe(true)
  })
  it('not required below without force', () => {
    expect(evaluateThreshold(10_000, 50_000).required).toBe(false)
  })
  it('force overrides threshold', () => {
    expect(evaluateThreshold(10_000, 50_000, true).required).toBe(true)
  })
})

describe('validateEwayPartA', () => {
  it('requires places + seller GSTIN', () => {
    expect(
      validateEwayPartA({
        fromPlace: 'Pune',
        toPlace: 'Mumbai',
        distanceKm: 150,
        sellerGstin: '27AAAAA0000A1Z5',
      }).ok,
    ).toBe(true)
    expect(validateEwayPartA({ fromPlace: '', toPlace: 'M', distanceKm: 1, sellerGstin: 'X' }).ok).toBe(false)
  })
})

describe('validateEwayPartB', () => {
  it('soft mode allows incomplete Part B with warning', () => {
    const r = validateEwayPartB({}, { requirePartB: false })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.warnings.length).toBeGreaterThan(0)
  })
  it('road hard-requires vehicle or transporter', () => {
    const r = validateEwayPartB({ transportMode: '1' }, { requirePartB: true })
    expect(r.ok).toBe(false)
  })
  it('accepts vehicle on road', () => {
    const r = validateEwayPartB(
      { transportMode: '1', vehicleNumber: 'MH12AB1234' },
      { requirePartB: true },
    )
    expect(r.ok).toBe(true)
  })
})

describe('planEwayGenerate', () => {
  it('idempotent GENERATED', () => {
    expect(planEwayGenerate({ status: 'GENERATED', ewbNumber: 'EWB1' }).action).toBe('IDEMPOTENT_RETURN')
  })
  it('retries EXCEPTION', () => {
    expect(planEwayGenerate({ status: 'EXCEPTION', ewbNumber: null }).action).toBe('RETRY')
  })
  it('blocks cancelled', () => {
    expect(planEwayGenerate({ status: 'CANCELLED', ewbNumber: 'X' }).action).toBe('BLOCK')
  })
})

describe('planEwayExtension', () => {
  it('extends future validity', () => {
    const validUpto = new Date()
    validUpto.setHours(validUpto.getHours() + 4)
    const r = planEwayExtension({ status: 'GENERATED', validUpto, extensionHours: 8 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.newValidUpto.getTime()).toBeGreaterThan(validUpto.getTime())
  })
  it('blocks expired', () => {
    const validUpto = new Date(Date.now() - 120_000)
    const r = planEwayExtension({ status: 'GENERATED', validUpto })
    expect(r.ok).toBe(false)
  })
})

describe('checkEwaySourceReadiness', () => {
  it('SI must be POSTED', () => {
    expect(checkEwaySourceReadiness({ sourceType: 'SALES_INVOICE', documentStatus: 'DRAFT' }).ok).toBe(false)
    expect(checkEwaySourceReadiness({ sourceType: 'SALES_INVOICE', documentStatus: 'POSTED' }).ok).toBe(true)
  })
  it('DC must be ISSUED', () => {
    expect(checkEwaySourceReadiness({ sourceType: 'DELIVERY_CHALLAN', documentStatus: 'DRAFT' }).ok).toBe(false)
  })
})
