import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  purchaseLineHasDualUom,
  resolvePurchaseLineQtyPresentation,
  resolvePurchaseLineTrackingPresentation,
  toUomQuantityFromBase,
} from './purchaseLineUom'

const NOS_ID = 'uom-nos'
const KG_ID = 'uom-kg'
const ROD_ITEM_ID = 'item-rod'
const BOLT_ITEM_ID = 'item-bolt'

vi.mock('@/store/masterStore', () => ({
  useMasterStore: {
    getState: () => ({
      uoms: [
        { id: NOS_ID, uomCode: 'NOS', uomName: 'Numbers' },
        { id: KG_ID, uomCode: 'KG', uomName: 'Kilogram' },
      ],
      items: [
        {
          id: ROD_ITEM_ID,
          baseUomId: NOS_ID,
          purchaseUomId: KG_ID,
          uomConversionFactor: 50,
        },
        {
          id: BOLT_ITEM_ID,
          baseUomId: NOS_ID,
          purchaseUomId: NOS_ID,
          uomConversionFactor: 1,
        },
      ],
    }),
  },
}))

describe('resolvePurchaseLineQtyPresentation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows vendor KG + stock NOS when PO line uses KG factor 50', () => {
    const pres = resolvePurchaseLineQtyPresentation({
      itemId: ROD_ITEM_ID,
      uom: 'KG',
      uomId: KG_ID,
      quantity: 16,
      uomQuantity: 800,
      uomConversionFactor: 50,
    })

    expect(pres.dual).toBe(true)
    expect(pres.purchaseQty).toBe(800)
    expect(pres.purchaseUom).toBe('KG')
    expect(pres.baseQty).toBe(16)
    expect(pres.baseUom).toBe('NOS')
  })

  it('repairs legacy planning bug (same 16 on both qty fields, factor 50, line UOM KG)', () => {
    const pres = resolvePurchaseLineQtyPresentation({
      itemId: ROD_ITEM_ID,
      uom: 'KG',
      uomId: KG_ID,
      quantity: 16,
      uomQuantity: 16,
      uomConversionFactor: 50,
    })

    expect(pres.purchaseQty).toBe(800)
    expect(pres.baseQty).toBe(16)
  })

  it('shows single NOS row when PO line was created at factor 1 (NOS purchase)', () => {
    const pres = resolvePurchaseLineQtyPresentation({
      itemId: ROD_ITEM_ID,
      uom: 'NOS',
      uomId: NOS_ID,
      quantity: 16,
      uomQuantity: 16,
      uomConversionFactor: 1,
    })

    expect(pres.dual).toBe(false)
    expect(pres.purchaseQty).toBe(16)
    expect(pres.purchaseUom).toBe('NOS')
    expect(purchaseLineHasDualUom({
      itemId: ROD_ITEM_ID,
      uom: 'NOS',
      uomConversionFactor: 1,
    })).toBe(false)
  })

  it('shows single row for 1:1 NOS items', () => {
    const pres = resolvePurchaseLineQtyPresentation({
      itemId: BOLT_ITEM_ID,
      uom: 'NOS',
      quantity: 25,
      uomQuantity: 25,
      uomConversionFactor: 1,
    })

    expect(pres.dual).toBe(false)
    expect(pres.purchaseQty).toBe(25)
  })
})

describe('resolvePurchaseLineTrackingPresentation', () => {
  it('derives KG received qty from base NOS received', () => {
    const pres = resolvePurchaseLineTrackingPresentation(
      { itemId: ROD_ITEM_ID, uom: 'KG', uomId: KG_ID, uomConversionFactor: 50 },
      9.6,
      9.6,
    )

    expect(pres.dual).toBe(true)
    expect(pres.baseQty).toBe(9.6)
    expect(pres.purchaseQty).toBe(toUomQuantityFromBase(9.6, 50))
    expect(pres.purchaseUom).toBe('KG')
  })
})
