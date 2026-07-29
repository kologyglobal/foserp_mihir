import { describe, expect, it } from 'vitest'
import {
  mapDefaultCostingMethodToValuationMethod,
  mapLegacyManufacturingValuationMethod,
} from '../src/modules/inventory/costing/inventory-costing.helpers.js'

describe('IV-MFG-1 valuation adapters', () => {
  it('maps inventory settings keys to InventoryValuationMethod', () => {
    expect(mapDefaultCostingMethodToValuationMethod('fifo')).toBe('FIFO')
    expect(mapDefaultCostingMethodToValuationMethod('average')).toBe('MOVING_WEIGHTED_AVERAGE')
    expect(mapDefaultCostingMethodToValuationMethod('standard')).toBe('STANDARD_COST')
    expect(mapDefaultCostingMethodToValuationMethod('specific')).toBe('SPECIFIC_IDENTIFICATION')
  })

  it('maps legacy ManufacturingInventoryValuationMethod to canonical inventory methods', () => {
    expect(mapLegacyManufacturingValuationMethod('MOVING_AVERAGE')).toBe('MOVING_WEIGHTED_AVERAGE')
    expect(mapLegacyManufacturingValuationMethod('FIFO')).toBe('FIFO')
    expect(mapLegacyManufacturingValuationMethod('anything')).toBe('MOVING_WEIGHTED_AVERAGE')
  })
})
