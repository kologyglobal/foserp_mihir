import { describe, expect, it } from 'vitest'
import { assertRevisable } from '../../src/modules/purchase/requisitions/purchase-requisition.workflow.js'

describe('PR versioning workflow', () => {
  it('allows revise on approved PR with no ordered qty', () => {
    expect(() =>
      assertRevisable(
        { status: 'APPROVED', deletedAt: null },
        [{ status: 'OPEN', orderedQuantity: 0 }],
      ),
    ).not.toThrow()
  })

  it('blocks revise when any line has ordered qty', () => {
    expect(() =>
      assertRevisable(
        { status: 'PARTIALLY_CONVERTED', deletedAt: null },
        [{ status: 'PARTIALLY_CONVERTED', orderedQuantity: 50 }],
      ),
    ).toThrow()
  })

  it('blocks revise on draft PR', () => {
    expect(() =>
      assertRevisable({ status: 'DRAFT', deletedAt: null }, []),
    ).toThrow()
  })
})
