import { describe, expect, it } from 'vitest'
import { createCostingPolicySchema } from '../src/modules/manufacturing/costing/costing.schemas.js'
import { allocateScrapReworkCost } from '../src/modules/manufacturing/costing/work-order-cost.service.js'

describe('Manufacturing Phase 8 costing depth', () => {
  it('allocates a positive scrap cost when scrap quantity exists', () => {
    const result = allocateScrapReworkCost(1_000, 10, 2, 1)
    expect(result.unitCost.toNumber()).toBe(100)
    expect(result.scrapCost.toNumber()).toBe(200)
    expect(result.reworkCost.toNumber()).toBe(100)
  })

  it('accepts STANDARD_WITH_VARIANCE on costing policy create', () => {
    const parsed = createCostingPolicySchema.parse({
      name: 'Standard costing',
      costingMethod: 'STANDARD_WITH_VARIANCE',
    })
    expect(parsed.costingMethod).toBe('STANDARD_WITH_VARIANCE')
  })
})
