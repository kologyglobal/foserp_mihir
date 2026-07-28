import { describe, expect, it } from 'vitest'
import { docTypeMatchesLimit } from '../src/modules/purchase/shared/purchase-approver-limit.js'

describe('purchase approver limit helpers', () => {
  it('matches ALL and specific document types', () => {
    expect(docTypeMatchesLimit('ALL', 'PURCHASE_ORDER')).toBe(true)
    expect(docTypeMatchesLimit('PURCHASE_ORDER', 'PURCHASE_ORDER')).toBe(true)
    expect(docTypeMatchesLimit('PURCHASE_REQUISITION', 'PURCHASE_ORDER')).toBe(false)
  })
})
