import { describe, expect, it } from 'vitest'
import { PURCHASE_RETURN_TYPES, createPurchaseReturnSchema } from '../src/modules/purchase/returns/purchase-return.validation.js'
import { completeQualityInspectionSchema } from '../src/modules/purchase/quality-inspections/quality-inspection.validation.js'
import { returnAllowedActions } from '../src/modules/purchase/returns/purchase-return.workflow.js'
import {
  isGrnOnTimeDelivery,
  resolvePoExpectedDelivery,
} from '../src/modules/purchase/supplier-quality/supplier-quality.service.js'

describe('Supplier quality closure — unit', () => {
  it('requires reason on create purchase return', () => {
    const parsed = createPurchaseReturnSchema.safeParse({
      vendorId: '11111111-1111-1111-1111-111111111111',
      lines: [{ returnQuantity: 1 }],
    })
    expect(parsed.success).toBe(false)

    const ok = createPurchaseReturnSchema.safeParse({
      vendorId: '11111111-1111-1111-1111-111111111111',
      reason: 'Rejected on QI',
      returnType: 'CREDIT',
      lines: [{ returnQuantity: 2 }],
    })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.returnType).toBe('CREDIT')
  })

  it('supports all return types', () => {
    expect(PURCHASE_RETURN_TYPES).toContain('REPLACEMENT')
    expect(PURCHASE_RETURN_TYPES).toContain('SCRAP_VENDOR')
  })

  it('QI complete accepts decision codes', () => {
    const parsed = completeQualityInspectionSchema.parse({
      outcome: 'REJECT',
      decisionCode: 'RETURN_TO_VENDOR',
      decisionReason: 'Dimensional fail vs drawing',
    })
    expect(parsed.decisionCode).toBe('RETURN_TO_VENDOR')
    expect(parsed.decisionReason).toContain('Dimensional')
  })

  it('return allowed actions include ship from APPROVED', () => {
    const a = returnAllowedActions('APPROVED')
    expect(a.canShip).toBe(true)
    expect(a.canComplete).toBe(true)
    expect(a.canEdit).toBe(false)
  })

  it('OTD: GRN on or before expected delivery day is on-time', () => {
    expect(isGrnOnTimeDelivery(new Date('2026-07-21'), new Date('2026-07-25'))).toBe(true)
    expect(isGrnOnTimeDelivery(new Date('2026-07-25'), new Date('2026-07-25'))).toBe(true)
    expect(isGrnOnTimeDelivery(new Date('2026-07-26'), new Date('2026-07-25'))).toBe(false)
  })

  it('OTD: resolves PO header expected date, else earliest line requiredDate', () => {
    expect(
      resolvePoExpectedDelivery({
        expectedDeliveryDate: new Date('2026-08-01'),
        lines: [{ requiredDate: new Date('2026-07-01') }],
      })?.toISOString().slice(0, 10),
    ).toBe('2026-08-01')
    expect(
      resolvePoExpectedDelivery({
        expectedDeliveryDate: null,
        lines: [
          { requiredDate: new Date('2026-07-15') },
          { requiredDate: new Date('2026-07-10') },
        ],
      })?.toISOString().slice(0, 10),
    ).toBe('2026-07-10')
    expect(resolvePoExpectedDelivery({ expectedDeliveryDate: null, lines: [] })).toBeNull()
  })
})
