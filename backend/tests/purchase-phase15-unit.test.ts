import { describe, expect, it } from 'vitest'
import { syncPurchasePlanningRowsFromApprovedPr } from '../src/modules/purchase/planning/purchase-planning-sync.service.js'
import {
  computeNetPurchaseQuantity,
  derivePrConversionStatus,
  groupPlanningRowsByVendor,
} from '../src/modules/purchase/planning/purchase-planning.workflow.js'
import { isValidSubmittableLine } from '../src/modules/purchase/requisitions/purchase-requisition.workflow.js'

describe('Phase 15 — purchase unit (qty, grouping, conversion, line validity)', () => {
  it('5–6. Net Purchase Quantity is correct and never negative', () => {
    expect(computeNetPurchaseQuantity(10, 3, 2)).toBe(5)
    expect(computeNetPurchaseQuantity(5, 10, 0)).toBe(0)
    expect(computeNetPurchaseQuantity(5, 2, 10)).toBe(0)
    expect(computeNetPurchaseQuantity(0, 0, 0)).toBe(0)
  })

  it('4. Invalid PR lines are not submittable (ignored by sync)', () => {
    expect(
      isValidSubmittableLine({
        itemId: null,
        itemCodeSnapshot: '',
        itemNameSnapshot: '',
        requiredQuantity: 5,
        uomId: 'uom-1',
      }),
    ).toBe(false)
    expect(
      isValidSubmittableLine({
        itemId: 'i-1',
        itemCodeSnapshot: 'A',
        itemNameSnapshot: 'Alpha',
        requiredQuantity: 0,
        uomId: 'uom-1',
      }),
    ).toBe(false)
    expect(
      isValidSubmittableLine({
        itemId: 'i-1',
        itemCodeSnapshot: 'A',
        itemNameSnapshot: 'Alpha',
        requiredQuantity: 2,
        uomId: null,
      }),
    ).toBe(false)
    expect(
      isValidSubmittableLine({
        itemId: 'i-1',
        itemCodeSnapshot: 'A',
        itemNameSnapshot: 'Alpha',
        requiredQuantity: 2,
        uomId: 'uom-1',
      }),
    ).toBe(true)
  })

  it('11–12. Selected rows are grouped by vendor (one PO per vendor)', () => {
    const groups = groupPlanningRowsByVendor([
      { id: '1', selectedVendorId: 'v-a' },
      { id: '2', selectedVendorId: 'v-b' },
      { id: '3', selectedVendorId: 'v-a' },
      { id: '4', selectedVendorId: null },
    ])
    expect(groups.size).toBe(2)
    expect(groups.get('v-a')?.map((r) => r.id)).toEqual(['1', '3'])
    expect(groups.get('v-b')?.map((r) => r.id)).toEqual(['2'])
  })

  it('14–15. PR conversion status derived from planning row statuses', () => {
    expect(derivePrConversionStatus(['PENDING_PLANNING', 'VENDOR_SELECTED'])).toBeNull()
    expect(derivePrConversionStatus(['PO_CREATED', 'VENDOR_SELECTED'])).toBe('PARTIALLY_CONVERTED')
    expect(derivePrConversionStatus(['PO_CREATED', 'PO_CREATED'])).toBe('CONVERTED_TO_PO')
    expect(derivePrConversionStatus(['PO_CREATED', 'COMPLETED'])).toBe('CONVERTED_TO_PO')
  })

  it('sync service is exported for integration coverage', () => {
    expect(typeof syncPurchasePlanningRowsFromApprovedPr).toBe('function')
  })
})
