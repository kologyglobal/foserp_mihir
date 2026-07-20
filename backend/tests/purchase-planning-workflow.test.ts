import { describe, expect, it } from 'vitest'
import {
  PlanningInvalidTransitionError,
  PlanningNotEligibleError,
  PlanningPoNotReadyError,
  PlanningRfqRequiredError,
  PlanningRowReadOnlyError,
  PlanningStatusReasonRequiredError,
  PurchaseOrderCreationError,
} from '../src/modules/purchase/planning/purchase-planning.errors.js'
import {
  assertBulkStatusReason,
  assertPlanningEditable,
  assertPlanningRowReadyForPo,
  assertStatusTransition,
  computeEstimatedAmount,
  computeNetPurchaseQuantity,
  maybeVendorSelectedStatus,
} from '../src/modules/purchase/planning/purchase-planning.workflow.js'
import { PURCHASE_ERROR_CODE } from '../src/modules/purchase/shared/purchase-error-catalog.js'

function readyRow(partial: Record<string, unknown> = {}) {
  return {
    id: 'pps-1',
    tenantId: 't-1',
    status: 'APPROVED' as const,
    deletedAt: null,
    selectedVendorId: 'v-1',
    netPurchaseQuantity: 5 as never,
    expectedRate: 10 as never,
    negotiatedRate: null,
    requiredDate: new Date('2026-07-20T00:00:00.000Z'),
    itemId: 'item-1',
    uomId: 'uom-1',
    ...partial,
  }
}

describe('purchase planning workflow', () => {
  it('computes net purchase quantity floored at zero', () => {
    expect(computeNetPurchaseQuantity(10, 3, 2)).toBe(5)
    expect(computeNetPurchaseQuantity(5, 10, 0)).toBe(0)
    expect(computeEstimatedAmount(5, 12.5)).toBe(62.5)
  })

  it('blocks edits on terminal and PO-created statuses', () => {
    expect(() => assertPlanningEditable({ status: 'CANCELLED', deletedAt: null })).toThrow(
      PlanningRowReadOnlyError,
    )
    expect(() => assertPlanningEditable({ status: 'PO_CREATED', deletedAt: null })).toThrow(
      PlanningRowReadOnlyError,
    )
    expect(() => assertPlanningEditable({ status: 'PENDING_PLANNING', deletedAt: null })).not.toThrow()
  })

  it('allows and rejects status transitions', () => {
    expect(() => assertStatusTransition('PENDING_PLANNING', 'UNDER_REVIEW')).not.toThrow()
    expect(() => assertStatusTransition('PENDING_PLANNING', 'PO_CREATED')).toThrow(
      PlanningInvalidTransitionError,
    )
    expect(() => assertStatusTransition('VENDOR_SELECTED', 'APPROVED')).not.toThrow()
  })

  it('requires reason for cancel/hold bulk status', () => {
    expect(() => assertBulkStatusReason('CANCELLED', '')).toThrow(PlanningStatusReasonRequiredError)
    expect(assertBulkStatusReason('ON_HOLD', ' Waiting stock ')).toBe('Waiting stock')
    expect(assertBulkStatusReason('APPROVED', null)).toBeNull()
  })

  it('auto-promotes to vendor_selected when vendor set', () => {
    expect(maybeVendorSelectedStatus('PENDING_PLANNING', 'v-1')).toBe('VENDOR_SELECTED')
    expect(maybeVendorSelectedStatus('APPROVED', 'v-1')).toBeUndefined()
  })

  it('enforces PO-ready validations with stable codes', () => {
    expect(() => assertPlanningRowReadyForPo(readyRow())).not.toThrow()

    try {
      assertPlanningRowReadyForPo(readyRow({ selectedVendorId: null }))
      expect.fail('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(PlanningPoNotReadyError)
      expect((e as PlanningPoNotReadyError).code).toBe(PURCHASE_ERROR_CODE.PPS_VENDOR_REQUIRED)
    }

    try {
      assertPlanningRowReadyForPo(readyRow({ netPurchaseQuantity: 0 as never }))
      expect.fail('expected throw')
    } catch (e) {
      expect((e as PlanningPoNotReadyError).code).toBe(PURCHASE_ERROR_CODE.PPS_NET_QTY_INVALID)
    }

    try {
      assertPlanningRowReadyForPo(readyRow({ expectedRate: 0 as never, negotiatedRate: null }))
      expect.fail('expected throw')
    } catch (e) {
      expect((e as PlanningPoNotReadyError).code).toBe(PURCHASE_ERROR_CODE.PPS_RATE_REQUIRED)
    }

    try {
      assertPlanningRowReadyForPo(readyRow({ requiredDate: null }))
      expect.fail('expected throw')
    } catch (e) {
      expect((e as PlanningPoNotReadyError).code).toBe(PURCHASE_ERROR_CODE.PPS_REQUIRED_DATE_REQUIRED)
    }

    try {
      assertPlanningRowReadyForPo(readyRow({ status: 'CANCELLED' }))
      expect.fail('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(PlanningNotEligibleError)
      expect((e as PlanningNotEligibleError).code).toBe(PURCHASE_ERROR_CODE.PPS_CANCELLED)
    }

    try {
      assertPlanningRowReadyForPo(readyRow({ status: 'PO_CREATED' }))
      expect.fail('expected throw')
    } catch (e) {
      expect((e as PlanningNotEligibleError).code).toBe(PURCHASE_ERROR_CODE.PO_ALREADY_CONVERTED)
    }

    expect(() => assertPlanningRowReadyForPo(readyRow(), { rfqRequired: true })).toThrow(
      PlanningRfqRequiredError,
    )

    expect(() =>
      assertPlanningRowReadyForPo(readyRow(), { tenantId: 'other-tenant' }),
    ).toThrow(PurchaseOrderCreationError)

    expect(() => assertPlanningRowReadyForPo(readyRow(), { vendorActive: false })).toThrow(
      PurchaseOrderCreationError,
    )
  })
})
