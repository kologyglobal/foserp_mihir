import { describe, expect, it } from 'vitest'
import {
  assertPoOrderDateAllowed,
  isPoOrderDateBackdated,
  requiresBackdatedPoApproval,
  toPoBackdatePolicy,
} from '../../src/modules/purchase/orders/purchase-order-backdate.js'
import { PurchaseOrderValidationError } from '../../src/modules/purchase/orders/purchase-order.errors.js'

describe('PO backdate policy', () => {
  const policyClosed = toPoBackdatePolicy({
    allowBackdatedPo: false,
    backdatedPoDaysLimit: 0,
    requireApprovalForBackdatedPo: true,
  })

  const policyOpen7 = toPoBackdatePolicy({
    allowBackdatedPo: true,
    backdatedPoDaysLimit: 7,
    requireApprovalForBackdatedPo: true,
  })

  it('detects backdated order dates', () => {
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    expect(isPoOrderDateBackdated(yesterday)).toBe(true)
    expect(isPoOrderDateBackdated(new Date())).toBe(false)
  })

  it('blocks backdate when not allowed', () => {
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    expect(() => assertPoOrderDateAllowed(yesterday, policyClosed)).toThrow(
      PurchaseOrderValidationError,
    )
  })

  it('allows backdate within limit', () => {
    const threeDaysAgo = new Date()
    threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3)
    expect(() => assertPoOrderDateAllowed(threeDaysAgo, policyOpen7)).not.toThrow()
  })

  it('requires approval for backdated PO when configured', () => {
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    expect(requiresBackdatedPoApproval(yesterday, policyOpen7)).toBe(true)
    expect(requiresBackdatedPoApproval(new Date(), policyOpen7)).toBe(false)
  })
})
