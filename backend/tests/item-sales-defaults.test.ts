/**
 * Unit tests — CRM Item Phase 2 sales defaults.
 */
import { describe, expect, it } from 'vitest'
import {
  applySalesFieldDefaults,
  defaultFulfilmentMethod,
  defaultProductionAllowed,
  defaultSalesAllowed,
} from '../src/modules/items/item-sales-defaults.js'

describe('item-sales-defaults (CRM Item Phase 2)', () => {
  it('salesAllowed true for FG / service / bought_out', () => {
    expect(defaultSalesAllowed('finished_good')).toBe(true)
    expect(defaultSalesAllowed('service')).toBe(true)
    expect(defaultSalesAllowed('bought_out')).toBe(true)
    expect(defaultSalesAllowed('raw')).toBe(false)
    expect(defaultSalesAllowed('sub_assembly')).toBe(false)
  })

  it('fulfilment methods by type', () => {
    expect(defaultFulfilmentMethod('finished_good')).toBe('PRODUCTION')
    expect(defaultFulfilmentMethod('bought_out')).toBe('PURCHASE')
    expect(defaultFulfilmentMethod('service')).toBe('SERVICE')
    expect(defaultFulfilmentMethod('scrap')).toBe('MANUAL')
  })

  it('productionAllowed for FG and SFG', () => {
    expect(defaultProductionAllowed('finished_good')).toBe(true)
    expect(defaultProductionAllowed('sub_assembly')).toBe(true)
    expect(defaultProductionAllowed('raw')).toBe(false)
  })

  it('applySalesFieldDefaults fills create gaps', () => {
    const row = applySalesFieldDefaults({ itemType: 'finished_good', code: 'FG-1' }, { isCreate: true })
    expect(row.salesAllowed).toBe(true)
    expect(row.productionAllowed).toBe(true)
    expect(row.defaultFulfilmentMethod).toBe('PRODUCTION')
    expect(row.defaultSalesRate).toBe(0)
  })

  it('applySalesFieldDefaults respects explicit values', () => {
    const row = applySalesFieldDefaults(
      { itemType: 'raw', salesAllowed: true, defaultFulfilmentMethod: 'STOCK' },
      { isCreate: true },
    )
    expect(row.salesAllowed).toBe(true)
    expect(row.defaultFulfilmentMethod).toBe('STOCK')
  })
})
