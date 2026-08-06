/**
 * Pure unit tests for GRN reverse remaining qty helpers (no DB).
 */
import { describe, expect, it } from 'vitest'
import {
  isGrnLineFullyReversed,
  isGrnLineReversible,
  remainingReversibleReceived,
} from '../../src/modules/purchase/grn/goods-receipt.workflow.js'

describe('GRN partial reverse helpers', () => {
  it('computes remaining reversible received qty', () => {
    expect(remainingReversibleReceived({ receivedQuantity: 10, reversedQuantity: 0 })).toBe(10)
    expect(remainingReversibleReceived({ receivedQuantity: 10, reversedQuantity: 10 })).toBe(0)
    expect(remainingReversibleReceived({ receivedQuantity: 10, reversedQuantity: 4 })).toBe(6)
  })

  it('detects fully reversed and reversible lines', () => {
    const open = { receivedQuantity: 5, acceptedQuantity: 5, rejectedQuantity: 0, reversedQuantity: 0 }
    const done = {
      receivedQuantity: 5,
      acceptedQuantity: 5,
      rejectedQuantity: 0,
      reversedQuantity: 5,
      reversedAcceptedQuantity: 5,
      reversedRejectedQuantity: 0,
    }
    expect(isGrnLineReversible(open)).toBe(true)
    expect(isGrnLineFullyReversed(open)).toBe(false)
    expect(isGrnLineReversible(done)).toBe(false)
    expect(isGrnLineFullyReversed(done)).toBe(true)
  })
})
