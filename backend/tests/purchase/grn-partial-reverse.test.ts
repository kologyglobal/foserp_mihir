/**
 * Pure unit tests for GRN reverse remaining qty helpers (no DB).
 */
import { describe, expect, it } from 'vitest'
import {
  allocatePartialReverseQuantities,
  isGrnLineFullyReversed,
  isGrnLineReversible,
  netLineForReverse,
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

  it('nets already-returned qty out of the reversible cap (bug: 50 received, 15 returned should offer 35, not 50)', () => {
    const line = {
      receivedQuantity: 50,
      acceptedQuantity: 35,
      rejectedQuantity: 15,
      reversedQuantity: 0,
      reversedAcceptedQuantity: 0,
      reversedRejectedQuantity: 0,
    }
    // Without netting returns, remaining reversible would incorrectly be 50.
    expect(remainingReversibleReceived(line)).toBe(50)

    const netLine = netLineForReverse(line, 15)
    expect(remainingReversibleReceived(netLine)).toBe(35)
    expect(isGrnLineReversible(netLine)).toBe(true)
    expect(isGrnLineFullyReversed(netLine)).toBe(false)
    // The returned qty is assumed to come out of rejected stock first, so a full
    // reverse of the remaining 35 should hit the accepted bucket, not rejected.
    expect(allocatePartialReverseQuantities(netLine, 35)).toEqual({
      received: 35,
      accepted: 35,
      rejected: 0,
    })
  })

  it('nets returns beyond the rejected bucket into accepted', () => {
    const line = {
      receivedQuantity: 20,
      acceptedQuantity: 15,
      rejectedQuantity: 5,
      reversedQuantity: 0,
      reversedAcceptedQuantity: 0,
      reversedRejectedQuantity: 0,
    }
    // 8 returned: 5 consumes all of rejected, remaining 3 spills into accepted.
    const netLine = netLineForReverse(line, 8)
    expect(remainingReversibleReceived(netLine)).toBe(12)
    expect(allocatePartialReverseQuantities(netLine, 12)).toEqual({
      received: 12,
      accepted: 12,
      rejected: 0,
    })
  })

  it('a fully-returned line is no longer reversible', () => {
    const line = {
      receivedQuantity: 10,
      acceptedQuantity: 10,
      rejectedQuantity: 0,
      reversedQuantity: 0,
      reversedAcceptedQuantity: 0,
      reversedRejectedQuantity: 0,
    }
    const netLine = netLineForReverse(line, 10)
    expect(remainingReversibleReceived(netLine)).toBe(0)
    expect(isGrnLineReversible(netLine)).toBe(false)
    expect(isGrnLineFullyReversed(netLine)).toBe(true)
  })

  it('returns of 0 leave the line unchanged', () => {
    const line = {
      receivedQuantity: 10,
      acceptedQuantity: 10,
      rejectedQuantity: 0,
      reversedQuantity: 2,
      reversedAcceptedQuantity: 2,
      reversedRejectedQuantity: 0,
    }
    expect(netLineForReverse(line, 0)).toBe(line)
  })
})
