import { describe, expect, it } from 'vitest'
import {
  assertRawMaterialItemName,
  isRawMaterialItem,
  isValidRawMaterialItemName,
} from '../../src/modules/items/item-naming.rules.js'
import { createItemSchema } from '../../src/modules/items/item.validation.js'
import { ValidationError } from '../../src/utils/errors.js'

describe('item naming MS_GRADE_SECTION', () => {
  it('identifies raw material items', () => {
    expect(isRawMaterialItem('raw', undefined)).toBe(true)
    expect(isRawMaterialItem('bought_out', 'raw_material')).toBe(true)
    expect(isRawMaterialItem('bought_out', 'boi')).toBe(false)
  })

  it('accepts valid raw material names', () => {
    expect(isValidRawMaterialItemName('MS_IS2062_100x50')).toBe(true)
    expect(isValidRawMaterialItemName('MS_IS4923_DN50')).toBe(true)
    assertRawMaterialItemName('MS_IS2062_100x50', 'raw', 'raw_material')
  })

  it('rejects invalid raw material names', () => {
    expect(isValidRawMaterialItemName('MS Plate 6 mm')).toBe(false)
    expect(isValidRawMaterialItemName('MS_IS2062')).toBe(false)
    expect(() => assertRawMaterialItemName('MS Plate 6 mm', 'raw', undefined)).toThrow(ValidationError)
  })

  it('skips validation for non-raw items', () => {
    assertRawMaterialItemName('Any Name Here', 'bought_out', 'boi')
    expect(isValidRawMaterialItemName('Any Name')).toBe(false)
  })

  it('createItemSchema enforces pattern for raw items', () => {
    const base = {
      code: 'RM-TEST-01',
      name: 'MS_IS2062_100x50',
      itemDescription: '',
      categoryId: '00000000-0000-4000-8000-000000000001',
      baseUomId: '00000000-0000-4000-8000-000000000002',
      itemType: 'raw' as const,
      productType: 'raw_material' as const,
      materialGrade: '',
      hsnCode: '',
      reorderLevel: 0,
      reorderQty: 0,
      standardRate: 0,
      quantityPerUom: 1,
      purchaseQtyPerUom: 1,
    }
    expect(createItemSchema.safeParse(base).success).toBe(true)
    const bad = { ...base, name: 'MS Plate 6 mm' }
    const result = createItemSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })
})
