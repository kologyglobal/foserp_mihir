import { describe, expect, it } from 'vitest'
import { isPoLineStockPostable, normalizePoLineType } from '../src/modules/purchase/shared/po-line-stockable.js'
import { purchaseOrderLineInputSchema } from '../src/modules/purchase/orders/purchase-order.validation.js'

describe('isPoLineStockPostable', () => {
  it('skips free-text lines without itemId', () => {
    expect(isPoLineStockPostable({ itemId: null, lineType: 'GOODS' })).toBe(false)
    expect(isPoLineStockPostable({ itemId: null, lineType: 'SERVICE' })).toBe(false)
    expect(isPoLineStockPostable({ itemId: '', lineType: 'GOODS' })).toBe(false)
  })

  it('skips SERVICE lineType even when itemId present', () => {
    expect(
      isPoLineStockPostable({
        itemId: '00000000-0000-4000-8000-000000000001',
        lineType: 'SERVICE',
        item: { isStockable: true, itemType: 'service' },
      }),
    ).toBe(false)
  })

  it('skips catalog non-stockable / service masters', () => {
    const id = '00000000-0000-4000-8000-000000000002'
    expect(
      isPoLineStockPostable({
        itemId: id,
        lineType: 'GOODS',
        item: { isStockable: false, itemType: 'raw' },
      }),
    ).toBe(false)
    expect(
      isPoLineStockPostable({
        itemId: id,
        lineType: 'GOODS',
        item: { isStockable: true, itemType: 'service' },
      }),
    ).toBe(false)
  })

  it('allows stockable catalog goods', () => {
    expect(
      isPoLineStockPostable({
        itemId: '00000000-0000-4000-8000-000000000003',
        lineType: 'GOODS',
        item: { isStockable: true, itemType: 'raw' },
      }),
    ).toBe(true)
  })
})

describe('normalizePoLineType', () => {
  it('normalizes SERVICE / GOODS', () => {
    expect(normalizePoLineType('SERVICE')).toBe('SERVICE')
    expect(normalizePoLineType('service')).toBe('SERVICE')
    expect(normalizePoLineType('GOODS')).toBe('GOODS')
    expect(normalizePoLineType(undefined)).toBe('GOODS')
  })
})

describe('purchaseOrderLineInputSchema quick entry', () => {
  it('requires name, lineType, and HSN for null itemId', () => {
    const bad = purchaseOrderLineInputSchema.safeParse({
      itemId: null,
      uomQuantity: 1,
      rate: 100,
    })
    expect(bad.success).toBe(false)

    const ok = purchaseOrderLineInputSchema.safeParse({
      itemId: null,
      lineType: 'SERVICE',
      itemName: 'Website Development Services',
      hsnCode: '998314',
      uomQuantity: 1,
      rate: 50000,
    })
    expect(ok.success).toBe(true)
  })

  it('accepts free-text line with hsnCode only (no hsnId)', () => {
    const ok = purchaseOrderLineInputSchema.safeParse({
      itemId: null,
      lineType: 'SERVICE',
      itemName: 'IT design and development services',
      hsnId: null,
      hsnCode: '998314',
      uomQuantity: 1,
      rate: 1000,
    })
    expect(ok.success).toBe(true)
    if (ok.success) {
      expect(ok.data.hsnId).toBeNull()
      expect(ok.data.hsnCode).toBe('998314')
    }
  })

  it('accepts free-text line with hsnId only (no hsnCode)', () => {
    const ok = purchaseOrderLineInputSchema.safeParse({
      itemId: null,
      lineType: 'GOODS',
      itemName: 'Steel plate',
      hsnId: '00000000-0000-4000-8000-000000000099',
      uomQuantity: 2,
      rate: 500,
    })
    expect(ok.success).toBe(true)
  })

  it('rejects free-text line without hsnId and hsnCode', () => {
    const bad = purchaseOrderLineInputSchema.safeParse({
      itemId: null,
      lineType: 'SERVICE',
      itemName: 'Consulting',
      uomQuantity: 1,
      rate: 100,
    })
    expect(bad.success).toBe(false)
    if (!bad.success) {
      const hsnIssue = bad.error.issues.find((i) => i.path.includes('hsnId') || i.path.includes('hsnCode'))
      expect(hsnIssue?.message).toMatch(/HSN\/SAC is required/i)
    }
  })

  it('allows catalog lines without free-text name when itemId set', () => {
    const ok = purchaseOrderLineInputSchema.safeParse({
      itemId: '00000000-0000-4000-8000-000000000010',
      uomQuantity: 2,
      rate: 10,
    })
    expect(ok.success).toBe(true)
  })
})
