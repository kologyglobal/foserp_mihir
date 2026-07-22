import { describe, expect, it } from 'vitest'
import {
  calculateSplitQuantities,
  validateSplitQuantity,
} from '../src/modules/manufacturing/work-orders/work-order-split.service.js'
import { calculateOeeFactors } from '../src/modules/ops-reports/executors/oee.js'
import { findReportDefinition } from '../src/modules/ops-reports/registry.js'
import { REPORT_EXECUTORS } from '../src/modules/ops-reports/executors/index.js'

describe('Manufacturing Wave 5 — work-order split and OEE', () => {
  it('rebalances parent and child quantities for a valid split', () => {
    const result = calculateSplitQuantities(100, 20, 30)
    expect(result.parentPlanned.toNumber()).toBe(70)
    expect(result.childPlanned.toNumber()).toBe(30)
    expect(result.remaining.toNumber()).toBe(80)
    expect(result.childRatio.toNumber()).toBe(0.3)
  })

  it('rejects splitting the whole remaining quantity', () => {
    expect(() => validateSplitQuantity(100, 20, 80)).toThrow(/less than remaining open quantity/i)
  })

  it('calculates and registers work-centre OEE', () => {
    const factors = calculateOeeFactors({
      plannedMinutes: 480,
      downtimeMinutes: 60,
      idealRunMinutes: 300,
      actualMachineMinutes: 360,
      goodQty: 90,
      scrapQty: 5,
      rejectQty: 5,
    })
    expect(factors.availability).toBeCloseTo(0.875)
    expect(factors.performance).toBeCloseTo(0.833333)
    expect(factors.quality).toBeCloseTo(0.9)
    expect(factors.oee).toBeCloseTo(0.65625)
    expect(findReportDefinition('work-centre-oee')?.availability).toBe('PARTIAL')
    expect(REPORT_EXECUTORS['work-centre-oee']).toBeTypeOf('function')
  })
})
