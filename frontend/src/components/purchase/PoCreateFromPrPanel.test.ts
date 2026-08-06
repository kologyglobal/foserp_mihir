import { describe, expect, it } from 'vitest'
import { isOpenPrLineForPo, prLineRemainingQty } from './PoCreateFromPrPanel'
import type { PurchaseRequisitionLine } from '@/types/purchaseDomain'

function line(partial: Partial<PurchaseRequisitionLine>): PurchaseRequisitionLine {
  return {
    id: partial.id ?? 'l1',
    lineNo: partial.lineNo ?? 1,
    itemType: 'raw_material',
    itemId: 'i1',
    itemCode: 'X',
    itemName: 'Item',
    specification: '',
    category: 'raw_material',
    uom: 'NOS',
    hsnCode: '',
    sacCode: null,
    quantity: partial.quantity ?? 10,
    orderedQuantity: partial.orderedQuantity,
    remainingQuantity: partial.remainingQuantity,
    estimatedRate: 1,
    amount: 10,
    currentStock: 0,
    openPoQty: 0,
    preferredVendorId: null,
    preferredVendorName: null,
    vendorNumber: '',
    requiredDate: '2026-08-01',
    orderDate: '2026-08-01',
    customerName: '',
    locationId: 'loc',
    locationName: 'Loc',
    binCode: '',
    purchaseOrderId: null,
    purchaseOrderNumber: '',
    purchaseQuoteNumber: '',
    purpose: '',
    remarks: '',
    attachmentNote: '',
    ...partial,
  } as PurchaseRequisitionLine
}

describe('PR open lines for partial PO', () => {
  it('uses remainingQuantity when present', () => {
    expect(prLineRemainingQty(line({ quantity: 10, remainingQuantity: 4 }))).toBe(4)
    expect(isOpenPrLineForPo(line({ remainingQuantity: 4 }))).toBe(true)
  })

  it('derives remaining from orderedQuantity', () => {
    expect(prLineRemainingQty(line({ quantity: 10, orderedQuantity: 6 }))).toBe(4)
  })

  it('closes fully ordered lines', () => {
    expect(isOpenPrLineForPo(line({ quantity: 10, orderedQuantity: 10, remainingQuantity: 0 }))).toBe(
      false,
    )
  })
})
