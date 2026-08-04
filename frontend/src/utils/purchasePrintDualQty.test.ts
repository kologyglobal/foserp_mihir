import { describe, expect, it, beforeEach } from 'vitest'
import { resolveDualQtyForPrint } from './purchasePrintDualQty'
import { useMasterStore } from '@/store/masterStore'

describe('resolveDualQtyForPrint', () => {
  beforeEach(() => {
    useMasterStore.setState({
      items: [
        {
          id: 'item-1',
          itemCode: 'RM-001',
          itemName: 'MS_IS2062_100x50',
          baseUomId: 'uom-nos',
          purchaseUomId: 'uom-kg',
          uomConversionFactor: 10,
        } as never,
      ],
      uoms: [
        { id: 'uom-nos', uomCode: 'NOS', uomName: 'Numbers' } as never,
        { id: 'uom-kg', uomCode: 'KG', uomName: 'Kilogram' } as never,
      ],
    })
  })

  it('derives purchase qty from stock qty and factor (100 NOS → 1000 KG)', () => {
    const dual = resolveDualQtyForPrint({
      stockQty: 100,
      itemId: 'item-1',
    })
    expect(dual.stockQty).toBe(100)
    expect(dual.stockUom).toBe('NOS')
    expect(dual.purchaseQty).toBe(1000)
    expect(dual.purchaseUom).toBe('KG')
    expect(dual.showDual).toBe(true)
  })

  it('collapses to single line when purchase and stock UOM match', () => {
    const dual = resolveDualQtyForPrint({
      stockQty: 50,
      stockUom: 'NOS',
      purchaseQty: 50,
      purchaseUom: 'NOS',
      uomConversionFactor: 1,
    })
    expect(dual.showDual).toBe(false)
  })

  it('uses explicit purchase qty when provided', () => {
    const dual = resolveDualQtyForPrint({
      stockQty: 100,
      stockUom: 'NOS',
      purchaseQty: 950,
      purchaseUom: 'KG',
      uomConversionFactor: 10,
    })
    expect(dual.purchaseQty).toBe(950)
    expect(dual.showDual).toBe(true)
  })
})
