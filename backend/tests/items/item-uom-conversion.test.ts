import { describe, expect, it } from 'vitest'
import {
  deriveLegacyPurchaseFields,
  legacyFieldsToConversionInputs,
  normalizeItemUomConversionInputs,
  resolvePurchaseLineUomFromMappings,
} from '../../src/modules/items/item-uom-conversion.service.js'

describe('item UOM conversion', () => {
  const baseUomId = 'base-nos'

  it('normalizes rows with base UOM and single default', () => {
    const rows = normalizeItemUomConversionInputs(baseUomId, [
      { uomId: 'uom-mtr', conversionFactor: 3, isPurchaseAllowed: true, isDefaultPurchase: true },
    ])
    expect(rows.find((r) => r.uomId === baseUomId)?.conversionFactor).toBe(1)
    expect(rows.filter((r) => r.isDefaultPurchase)).toHaveLength(1)
    expect(rows.find((r) => r.isDefaultPurchase)?.uomId).toBe('uom-mtr')
  })

  it('derives legacy purchase fields from default mapping', () => {
    const rows = legacyFieldsToConversionInputs(baseUomId, 'uom-mtr', 3)
    const legacy = deriveLegacyPurchaseFields(baseUomId, rows)
    expect(legacy.purchaseUomId).toBe('uom-mtr')
    expect(legacy.uomConversionFactor).toBe(3)
  })

  it('resolves PO line UOM from allowed mappings only', () => {
    const resolved = resolvePurchaseLineUomFromMappings({
      baseUomId,
      conversions: [
        { uomId: baseUomId, conversionFactor: 1, isPurchaseAllowed: true, isDefaultPurchase: false },
        { uomId: 'uom-mtr', conversionFactor: 3, isPurchaseAllowed: true, isDefaultPurchase: true },
        { uomId: 'uom-kg', conversionFactor: 10, isPurchaseAllowed: false, isDefaultPurchase: false },
      ],
      requestedUomId: 'uom-mtr',
    })
    expect(resolved.uomId).toBe('uom-mtr')
    expect(resolved.conversionFactor).toBe(3)
  })

  it('rejects PO UOM not in purchase-allowed mappings', () => {
    expect(() =>
      resolvePurchaseLineUomFromMappings({
        baseUomId,
        conversions: [
          { uomId: baseUomId, conversionFactor: 1, isPurchaseAllowed: true, isDefaultPurchase: true },
        ],
        requestedUomId: 'uom-mtr',
      }),
    ).toThrow(/not an allowed purchase unit/)
  })

  it('uses base factor 1 when base UOM selected on PO', () => {
    const resolved = resolvePurchaseLineUomFromMappings({
      baseUomId,
      conversions: [
        { uomId: baseUomId, conversionFactor: 1, isPurchaseAllowed: true, isDefaultPurchase: false },
        { uomId: 'uom-mtr', conversionFactor: 3, isPurchaseAllowed: true, isDefaultPurchase: true },
      ],
      requestedUomId: baseUomId,
    })
    expect(resolved.conversionFactor).toBe(1)
  })
})
