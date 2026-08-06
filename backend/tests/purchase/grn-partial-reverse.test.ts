/**
 * Pure unit tests for GRN reverse remaining qty helpers (no DB).
 */
import { describe, expect, it } from 'vitest'
import {
  allocatePartialReverseQuantities,
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

  it('splits partial reverse qty across accepted/rejected', () => {
    const line = {
      receivedQuantity: 10,
      acceptedQuantity: 8,
      rejectedQuantity: 2,
      reversedQuantity: 0,
      reversedAcceptedQuantity: 0,
      reversedRejectedQuantity: 0,
    }
    expect(allocatePartialReverseQuantities(line, 5)).toEqual({
      received: 5,
      accepted: 4,
      rejected: 1,
    })
    expect(allocatePartialReverseQuantities(line, 10)).toEqual({
      received: 10,
      accepted: 8,
      rejected: 2,
    })
  })
})
