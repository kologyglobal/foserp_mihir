import { describe, expect, it } from 'vitest'
import { createItemSchema, updateItemSchema } from '../../src/modules/items/item.validation.js'

const baseInput = {
  code: 'RM-EXT-01',
  name: 'Bracket Assembly',
  itemDescription: '',
  categoryId: '00000000-0000-4000-8000-000000000001',
  baseUomId: '00000000-0000-4000-8000-000000000002',
  itemType: 'bought_out' as const,
  materialGrade: '',
  hsnCode: '',
  reorderLevel: 0,
  reorderQty: 0,
  standardRate: 0,
  quantityPerUom: 1,
  purchaseQtyPerUom: 1,
}

describe('item master extended fields validation', () => {
  it('accepts a create payload with no extended fields (all optional)', () => {
    const result = createItemSchema.safeParse(baseInput)
    expect(result.success).toBe(true)
  })

  it('accepts a create payload with the new extended fields populated', () => {
    const result = createItemSchema.safeParse({
      ...baseInput,
      drawingRevision: 'Rev C',
      partCodeNo: 'VEN-PC-001',
      itemMake: 'Bosch',
      minStockLevel: 10,
      maxStockLevel: 100,
      leadTimeDays: 14,
      shelfLifeDays: 365,
      warrantyPeriodMonths: 12,
      defaultLocationId: '00000000-0000-4000-8000-000000000003',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.drawingRevision).toBe('Rev C')
      expect(result.data.partCodeNo).toBe('VEN-PC-001')
      expect(result.data.itemMake).toBe('Bosch')
      expect(result.data.minStockLevel).toBe(10)
      expect(result.data.maxStockLevel).toBe(100)
      expect(result.data.leadTimeDays).toBe(14)
      expect(result.data.shelfLifeDays).toBe(365)
      expect(result.data.warrantyPeriodMonths).toBe(12)
      expect(result.data.defaultLocationId).toBe('00000000-0000-4000-8000-000000000003')
    }
  })

  it('rejects negative min/max stock, lead time, shelf life, and warranty values', () => {
    expect(createItemSchema.safeParse({ ...baseInput, minStockLevel: -1 }).success).toBe(false)
    expect(createItemSchema.safeParse({ ...baseInput, maxStockLevel: -1 }).success).toBe(false)
    expect(createItemSchema.safeParse({ ...baseInput, leadTimeDays: -1 }).success).toBe(false)
    expect(createItemSchema.safeParse({ ...baseInput, shelfLifeDays: -1 }).success).toBe(false)
    expect(createItemSchema.safeParse({ ...baseInput, warrantyPeriodMonths: -1 }).success).toBe(false)
  })

  it('rejects a malformed defaultLocationId', () => {
    const result = createItemSchema.safeParse({ ...baseInput, defaultLocationId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('allows null on the nullable string/id fields for partial updates', () => {
    const result = updateItemSchema.safeParse({
      drawingRevision: null,
      partCodeNo: null,
      itemMake: null,
      defaultLocationId: null,
    })
    expect(result.success).toBe(true)
  })

  it('no longer exposes isPurchasable as a user-editable form control but still validates when sent', () => {
    // isPurchasable remains a valid optional boolean on the schema/API even though the
    // Item Master UI checkbox was removed — every item defaults to purchasable = true.
    const result = createItemSchema.safeParse({ ...baseInput, isPurchasable: true })
    expect(result.success).toBe(true)
  })
})
