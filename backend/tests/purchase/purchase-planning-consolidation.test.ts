import { describe, expect, it } from 'vitest'
import {
  allocateVendorQtyFifo,
  assertAllocationBalances,
  buildPlanningConsolidationKey,
  consolidatePlanningRows,
} from '../../src/modules/purchase/planning/purchase-planning-consolidation.js'

describe('purchase planning consolidation', () => {
  it('groups by item + uom + location without merging member PRs', () => {
    const groups = consolidatePlanningRows([
      {
        id: 'p1',
        itemId: 'item-1',
        itemCode: 'FAST',
        itemName: 'Tank Fastener Set',
        uomId: 'uom-nos',
        deliveryLocationId: 'wh-1',
        requiredQuantity: 120,
        netPurchaseQuantity: 120,
        requiredDate: '2026-08-01',
        purchaseRequisitionId: 'pr1',
        purchaseRequisitionNumber: 'PR-00015',
        purchaseRequisitionLineId: 'prl1',
        expectedRate: 10,
        status: 'vendor_selected',
        planningNumber: 'PPS-1',
      },
      {
        id: 'p2',
        itemId: 'item-1',
        itemCode: 'FAST',
        itemName: 'Tank Fastener Set',
        uomId: 'uom-nos',
        deliveryLocationId: 'wh-1',
        requiredQuantity: 2100,
        netPurchaseQuantity: 2100,
        requiredDate: '2026-08-03',
        purchaseRequisitionId: 'pr2',
        purchaseRequisitionNumber: 'PR-00018',
        purchaseRequisitionLineId: 'prl2',
        expectedRate: 10,
        status: 'vendor_selected',
        planningNumber: 'PPS-2',
      },
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].totalNetQty).toBe(2220)
    expect(groups[0].prCount).toBe(2)
    expect(groups[0].members.map((m) => m.purchaseRequisitionNumber)).toEqual([
      'PR-00015',
      'PR-00018',
    ])
    expect(
      buildPlanningConsolidationKey({
        itemId: 'item-1',
        uomId: 'uom-nos',
        deliveryLocationId: 'wh-1',
      }),
    ).toBe(groups[0].groupKey)
  })

  it('validates full or partial allocation (≤ required) and FIFO-sliced PR qtys', () => {
    assertAllocationBalances(2220, [
      { vendorId: 'v1', quantity: 1500, rate: 10 },
      { vendorId: 'v2', quantity: 500, rate: 11 },
      { vendorId: 'v3', quantity: 220, rate: 12 },
    ])
    // Partial raise: allocated < required is OK
    assertAllocationBalances(1002, [
      { vendorId: 'v-metro', quantity: 50, rate: 10 },
      { vendorId: 'v-kar', quantity: 50, rate: 11 },
    ])
    expect(() =>
      assertAllocationBalances(100, [{ vendorId: 'v1', quantity: 140, rate: 1 }]),
    ).toThrow(/cannot exceed required/)
    expect(() =>
      assertAllocationBalances(100, [{ vendorId: 'v1', quantity: 0, rate: 1 }]),
    ).toThrow(/greater than zero/)

    const pool = [
      {
        planningRowId: 'p1',
        purchaseRequisitionId: 'pr1',
        purchaseRequisitionLineId: 'prl1',
        purchaseRequisitionNumber: 'PR-00015',
        planningNumber: 'PPS-1',
        remainingQty: 120,
        requiredDate: '2026-08-01',
      },
      {
        planningRowId: 'p2',
        purchaseRequisitionId: 'pr2',
        purchaseRequisitionLineId: 'prl2',
        purchaseRequisitionNumber: 'PR-00018',
        planningNumber: 'PPS-2',
        remainingQty: 2100,
        requiredDate: '2026-08-03',
      },
    ]
    const a = allocateVendorQtyFifo(pool, 1500)
    expect(a.slices).toEqual([
      expect.objectContaining({ purchaseRequisitionNumber: 'PR-00015', quantity: 120 }),
      expect.objectContaining({ purchaseRequisitionNumber: 'PR-00018', quantity: 1380 }),
    ])
    expect(pool.find((p) => p.planningRowId === 'p2')?.remainingQty).toBe(720)
  })

  it('partial multi-vendor allocate leaves residual open on later PR lines (FIFO)', () => {
    const pool = [
      {
        planningRowId: 'p1',
        purchaseRequisitionId: 'pr1',
        purchaseRequisitionLineId: 'prl1',
        purchaseRequisitionNumber: 'PR-A',
        planningNumber: 'PPS-1',
        remainingQty: 1002,
        requiredDate: '2026-08-01',
      },
    ]
    const metro = allocateVendorQtyFifo(pool, 50)
    expect(metro.slices).toEqual([
      expect.objectContaining({ planningRowId: 'p1', quantity: 50 }),
    ])
    expect(pool[0].remainingQty).toBe(952)

    const kar = allocateVendorQtyFifo(pool, 50)
    expect(kar.slices).toEqual([
      expect.objectContaining({ planningRowId: 'p1', quantity: 50 }),
    ])
    // 100 of 1002 ordered → 902 residual still open for later raise
    expect(pool[0].remainingQty).toBe(902)
    const ordered =
      metro.slices.reduce((s, x) => s + x.quantity, 0) +
      kar.slices.reduce((s, x) => s + x.quantity, 0)
    expect(ordered + pool[0].remainingQty).toBe(1002)
  })
})

