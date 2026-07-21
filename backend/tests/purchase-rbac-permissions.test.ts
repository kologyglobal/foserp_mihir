import { describe, expect, it } from 'vitest'
import { permissionSetIncludes, PURCHASE_PERMISSION_ALIASES } from '../src/constants/permissions.js'

describe('purchase RBAC permission aliases', () => {
  it('accepts canonical purchase.pr.* grants', () => {
    expect(permissionSetIncludes(['purchase.pr.view'], 'purchase.pr.view')).toBe(true)
    expect(permissionSetIncludes(['purchase.pr.approve'], 'purchase.pr.reject')).toBe(false)
  })

  it('maps legacy requisition/order/quotation keys to canonical checks', () => {
    expect(permissionSetIncludes(['purchase.requisition.view'], 'purchase.pr.view')).toBe(true)
    expect(permissionSetIncludes(['purchase.pr.create'], 'purchase.requisition.create')).toBe(true)
    expect(permissionSetIncludes(['purchase.quotation.create'], 'purchase.rfq.enter_quote')).toBe(true)
    expect(permissionSetIncludes(['purchase.order.release'], 'purchase.po.send')).toBe(true)
    expect(permissionSetIncludes(['purchase.po.send'], 'purchase.order.release')).toBe(true)
  })

  it('allows tenant.manage bypass', () => {
    expect(permissionSetIncludes(['tenant.manage'], 'purchase.rfq.award')).toBe(true)
  })

  it('keeps alias table covering known legacy keys', () => {
    expect(PURCHASE_PERMISSION_ALIASES['purchase.requisition.submit']).toBe('purchase.pr.submit')
    expect(PURCHASE_PERMISSION_ALIASES['purchase.quotation.compare']).toBe('purchase.rfq.compare')
  })
})
