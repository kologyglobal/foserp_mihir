/**
 * Phase 2 — GRN + QC workflow hardening (pure unit tests, no DB).
 *
 * Covers:
 *  - Normal GRN (no QC): Accepted/Rejected derive from Received as before.
 *  - QC required at receiving: GRN defers Accepted/Rejected fully to QC —
 *    a stale/tampered client payload cannot pre-judge acceptance.
 *  - QC acceptance / QC rejection: completed QI syncs GRN accepted/rejected
 *    qty in both base (stock) and purchase/vendor UOM using the factor
 *    snapshot (never a fresh live lookup).
 *  - Multi-UOM casting rejection: QI mapper shows received/accepted/rejected
 *    in both purchase UOM and base UOM using the conversion factor snapshot.
 */
import { describe, expect, it } from 'vitest'
import { resolveGrnLineAcceptReject } from '../../src/modules/purchase/grn/goods-receipt.workflow.js'
import { syncGrnAcceptedRejectedUomFromBase } from '../../src/modules/purchase/shared/uom-conversion.js'
import { mapQualityInspection } from '../../src/modules/purchase/quality-inspections/quality-inspection.mapper.js'

describe('Normal GRN (no QC)', () => {
  it('accepts full received qty when no rejection/damage entered', () => {
    const r = resolveGrnLineAcceptReject({ receivedQuantity: 100, qcRequired: false })
    expect(r).toEqual({ accepted: 100, rejected: 0, damaged: 0 })
  })

  it('splits accepted/rejected from explicit rejected input', () => {
    const r = resolveGrnLineAcceptReject({
      receivedQuantity: 100,
      qcRequired: false,
      rejectedQuantityInput: 15,
    })
    expect(r).toEqual({ accepted: 85, rejected: 15, damaged: 0 })
  })

  it('damaged qty feeds rejected when rejected not explicitly provided', () => {
    const r = resolveGrnLineAcceptReject({
      receivedQuantity: 50,
      qcRequired: false,
      damagedQuantityInput: 5,
    })
    expect(r).toEqual({ accepted: 45, rejected: 5, damaged: 5 })
  })
})

describe('GRN deferred to QC (inspection required)', () => {
  it('holds Accepted/Rejected at 0 regardless of received qty', () => {
    const r = resolveGrnLineAcceptReject({ receivedQuantity: 100, qcRequired: true })
    expect(r).toEqual({ accepted: 0, rejected: 0, damaged: 0 })
  })

  it('cannot be spoofed by a stale/tampered client payload', () => {
    const r = resolveGrnLineAcceptReject({
      receivedQuantity: 100,
      qcRequired: true,
      rejectedQuantityInput: 999,
      acceptedQuantityInput: 999,
      damagedQuantityInput: 999,
    })
    expect(r).toEqual({ accepted: 0, rejected: 0, damaged: 0 })
  })

  it('zero received stays zero even when QC required', () => {
    const r = resolveGrnLineAcceptReject({ receivedQuantity: 0, qcRequired: true })
    expect(r).toEqual({ accepted: 0, rejected: 0, damaged: 0 })
  })
})

describe('QC acceptance syncs GRN qty (base + purchase UOM)', () => {
  it('full acceptance at factor 1 mirrors base into commercial UOM', () => {
    const uom = syncGrnAcceptedRejectedUomFromBase(100, 0, 1)
    expect(uom).toEqual({ acceptedUomQuantity: 100, rejectedUomQuantity: 0 })
  })

  it('partial acceptance (deviation) at a non-1 factor', () => {
    // 1 NOS purchase unit = 10 KG stock/base unit.
    const uom = syncGrnAcceptedRejectedUomFromBase(9, 1, 10)
    expect(uom).toEqual({ acceptedUomQuantity: 90, rejectedUomQuantity: 10 })
  })
})

describe('QC rejection syncs GRN qty (base + purchase UOM)', () => {
  it('full rejection at factor 1', () => {
    const uom = syncGrnAcceptedRejectedUomFromBase(0, 100, 1)
    expect(uom).toEqual({ acceptedUomQuantity: 0, rejectedUomQuantity: 100 })
  })

  it('mixed accept/reject at a non-1 factor', () => {
    // 90 NOS accepted + 10 NOS rejected at 50 KG per NOS.
    const uom = syncGrnAcceptedRejectedUomFromBase(90, 10, 50)
    expect(uom).toEqual({ acceptedUomQuantity: 4500, rejectedUomQuantity: 500 })
  })
})

describe('Multi-UOM casting rejection — QI mapper dual UOM display', () => {
  const now = new Date('2026-01-15T00:00:00.000Z')
  const baseQi = {
    id: 'qi-1',
    tenantId: 't1',
    inspectionNumber: 'QI-00099',
    inspectionDate: now,
    goodsReceiptId: 'grn-1',
    purchaseOrderId: 'po-1',
    vendorId: 'v1',
    status: 'REJECTED',
    result: 'REJECT',
    decisionCode: 'REJECT',
    decisionReason: 'Casting dimension out of spec',
    priority: 'NORMAL',
    warehouseId: 'wh-1',
    inspectionPlanId: null,
    inspectionPlanRevisionId: null,
    planCodeSnapshot: null,
    planRevisionSnapshot: null,
    inspectionPlan: '',
    remarks: null,
    deviationRemarks: null,
    inspectedById: null,
    inspectedByName: null,
    assignedAt: null,
    startedAt: null,
    completedAt: now,
    createdById: null,
    updatedById: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  } as const

  it('derives rejected qty in purchase UOM from the base qty using the GRN factor snapshot', () => {
    // Casting item: 1 NOS (purchase) = 25 KG (base/stock). Received 8 NOS,
    // QC rejects 2 NOS worth (= 50 KG) of casting for surface defects.
    const qi = {
      ...baseQi,
      lines: [
        {
          id: 'qi-line-1',
          tenantId: 't1',
          qualityInspectionId: 'qi-1',
          lineNumber: 1,
          goodsReceiptLineId: 'grn-line-1',
          purchaseOrderLineId: 'po-line-1',
          itemId: 'item-casting-1',
          itemCodeSnapshot: 'CAST-001',
          itemNameSnapshot: 'Steel Casting Block',
          inspectedQuantity: 8,
          acceptedQuantity: 6,
          rejectedQuantity: 2,
          deviationQuantity: 0,
          remarks: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      parameters: [],
    }
    const enrichment = {
      lineItemFallbacks: new Map([
        [
          'grn-line-1',
          {
            itemId: 'item-casting-1',
            itemCode: 'CAST-001',
            itemName: 'Steel Casting Block',
            receivedQuantity: 8,
            uomCode: 'NOS',
            uomConversionFactor: 25,
          },
        ],
      ]),
    }

    const dto = mapQualityInspection(qi as never, enrichment)

    expect(dto.lines[0]!.uomCode).toBe('NOS')
    expect(dto.lines[0]!.uomConversionFactor).toBe(25)
    expect(dto.lines[0]!.inspectedUomQuantity).toBe(200) // 8 base * 25
    expect(dto.lines[0]!.acceptedUomQuantity).toBe(150) // 6 base * 25
    expect(dto.lines[0]!.rejectedUomQuantity).toBe(50) // 2 base * 25

    // Header-level totals + uom code/factor mirror the (dominant single) line.
    expect(dto.uomCode).toBe('NOS')
    expect(dto.uomConversionFactor).toBe(25)
    expect(dto.totals.rejected).toBe(2)
    expect(dto.totals.rejectedUom).toBe(50)
    expect(dto.totals.acceptedUom).toBe(150)
  })

  it('falls back to factor 1 (base == purchase UOM) when no GRN line snapshot is available', () => {
    const qi = {
      ...baseQi,
      lines: [
        {
          id: 'qi-line-1',
          tenantId: 't1',
          qualityInspectionId: 'qi-1',
          lineNumber: 1,
          goodsReceiptLineId: null,
          purchaseOrderLineId: null,
          itemId: 'item-2',
          itemCodeSnapshot: 'ITM-002',
          itemNameSnapshot: 'Generic Item',
          inspectedQuantity: 10,
          acceptedQuantity: 0,
          rejectedQuantity: 10,
          deviationQuantity: 0,
          remarks: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      parameters: [],
    }
    const dto = mapQualityInspection(qi as never)
    expect(dto.lines[0]!.uomConversionFactor).toBe(1)
    expect(dto.lines[0]!.rejectedUomQuantity).toBe(10)
    expect(dto.uomCode).toBeNull()
  })
})
