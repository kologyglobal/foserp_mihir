import { describe, expect, it } from 'vitest'
import {
  derivePrHeaderConversionFromLines,
  planningRemainingQuantity,
} from '../../src/modules/purchase/planning/purchase-planning.workflow.js'
import { assertRevisable } from '../../src/modules/purchase/requisitions/purchase-requisition.workflow.js'

describe('PR vendor allocation helpers', () => {
  it('planningRemainingQuantity uses allocated minus ordered', () => {
    expect(
      planningRemainingQuantity({
        allocatedQuantity: 1000,
        orderedQuantity: 400,
        netPurchaseQuantity: 1000,
      }),
    ).toBe(600)
  })

  it('derivePrHeaderConversionFromLines detects partial and full convert', () => {
    expect(
      derivePrHeaderConversionFromLines([
        { requiredQuantity: 100, orderedQuantity: 40, status: 'PARTIALLY_CONVERTED' },
      ]),
    ).toBe('PARTIALLY_CONVERTED')
    expect(
      derivePrHeaderConversionFromLines([
        { requiredQuantity: 100, orderedQuantity: 100, status: 'CONVERTED' },
      ]),
    ).toBe('CONVERTED_TO_PO')
  })
})

describe('assertRevisable', () => {
  it('blocks when line has ordered qty', () => {
    expect(() =>
      assertRevisable(
        { status: 'APPROVED', deletedAt: null },
        [{ status: 'OPEN', orderedQuantity: 10 }],
      ),
    ).toThrow()
  })

  it('allows approved PR with open lines', () => {
    expect(() =>
      assertRevisable(
        { status: 'APPROVED', deletedAt: null },
        [{ status: 'OPEN', orderedQuantity: 0 }],
      ),
    ).not.toThrow()
  })
})
