import { describe, expect, it } from 'vitest'
import type { PurchaseRequisition, PurchaseRequisitionLine } from '@prisma/client'
import {
  PurchaseRequisitionNotApprovableError,
  PurchaseRequisitionNotEditableError,
  PurchaseRequisitionValidationError,
  RejectionReasonRequiredError,
  InvalidPurchaseQuantityError,
} from '../src/modules/purchase/requisitions/purchase-requisition.errors.js'
import {
  assertApprovable,
  assertCancellable,
  assertDraftEditable,
  assertQuantityPositive,
  assertRejectable,
  assertRejectionReason,
  assertReopenable,
  assertRequiredDateNotBeforeRequisition,
  assertSubmittable,
  isValidSubmittableLine,
  normalizeLineInputs,
} from '../src/modules/purchase/requisitions/purchase-requisition.workflow.js'
import { PURCHASE_ERROR_CODE } from '../src/modules/purchase/shared/purchase-error-catalog.js'

function pr(
  partial: Partial<PurchaseRequisition> & { lines?: PurchaseRequisitionLine[] },
): PurchaseRequisition & { lines: PurchaseRequisitionLine[] } {
  return {
    id: 'pr-1',
    tenantId: 't-1',
    requisitionNumber: 'PR-000001',
    requisitionDate: new Date('2026-07-01T00:00:00.000Z'),
    departmentId: 'dept-1',
    requestedById: 'user-1',
    warehouseId: null,
    requiredDate: new Date('2026-07-15T00:00:00.000Z'),
    priority: 'NORMAL',
    purchasePurpose: null,
    rfqRequired: true,
    status: 'DRAFT',
    submittedAt: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    remarks: null,
    createdById: null,
    updatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    lines: [],
    ...partial,
  } as PurchaseRequisition & { lines: PurchaseRequisitionLine[] }
}

function line(partial: Partial<PurchaseRequisitionLine> = {}): PurchaseRequisitionLine {
  return {
    id: 'line-1',
    tenantId: 't-1',
    purchaseRequisitionId: 'pr-1',
    lineNumber: 1,
    itemId: 'item-1',
    itemCodeSnapshot: 'ITM-1',
    itemNameSnapshot: 'Bolt',
    description: null,
    requiredQuantity: 10 as never,
    uomId: 'uom-1',
    estimatedRate: 5 as never,
    estimatedAmount: 50 as never,
    warehouseId: null,
    binId: null,
    preferredVendorId: null,
    requiredDate: null,
    remarks: null,
    status: 'OPEN',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as PurchaseRequisitionLine
}

describe('purchase requisition workflow', () => {
  it('allows draft edit and blocks submitted / approved edit with stable codes', () => {
    expect(() => assertDraftEditable(pr({ status: 'DRAFT' }))).not.toThrow()
    try {
      assertDraftEditable(pr({ status: 'PENDING_APPROVAL' }))
      expect.fail('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(PurchaseRequisitionNotEditableError)
      expect((e as PurchaseRequisitionNotEditableError).code).toBe(PURCHASE_ERROR_CODE.PR_NOT_EDITABLE)
      expect((e as Error).message).toBe('Submitted PR cannot be edited.')
    }
    try {
      assertDraftEditable(pr({ status: 'APPROVED' }))
      expect.fail('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(PurchaseRequisitionNotEditableError)
      expect((e as PurchaseRequisitionNotEditableError).code).toBe(PURCHASE_ERROR_CODE.PR_MUST_REOPEN)
      expect((e as Error).message).toBe('Approved PR must be reopened before amendment.')
    }
  })

  it('requires header fields and at least one valid line to submit', () => {
    expect(() => assertSubmittable(pr({ lines: [] }))).toThrow(PurchaseRequisitionValidationError)
    expect(() =>
      assertSubmittable(pr({ lines: [line({ itemId: null, itemCodeSnapshot: '', itemNameSnapshot: '' })] })),
    ).toThrow(PurchaseRequisitionValidationError)
    expect(() => assertSubmittable(pr({ departmentId: null, lines: [line()] }))).toThrow(
      PurchaseRequisitionValidationError,
    )
    expect(() => assertSubmittable(pr({ lines: [line()] }))).not.toThrow()
  })

  it('rejects required date before requisition date', () => {
    expect(() =>
      assertRequiredDateNotBeforeRequisition(
        new Date('2026-07-10T00:00:00.000Z'),
        new Date('2026-07-01T00:00:00.000Z'),
      ),
    ).toThrow(PurchaseRequisitionValidationError)
  })

  it('enforces quantity > 0', () => {
    expect(() => assertQuantityPositive(0)).toThrow(InvalidPurchaseQuantityError)
    expect(() => assertQuantityPositive(-1)).toThrow(InvalidPurchaseQuantityError)
    expect(() => assertQuantityPositive(0.5)).not.toThrow()
  })

  it('approve/reject only from pending/submitted', () => {
    expect(() => assertApprovable(pr({ status: 'PENDING_APPROVAL' }))).not.toThrow()
    expect(() => assertApprovable(pr({ status: 'DRAFT' }))).toThrow(PurchaseRequisitionNotApprovableError)
    expect(() => assertRejectable(pr({ status: 'APPROVED' }))).toThrow(PurchaseRequisitionNotApprovableError)
  })

  it('requires rejection reason', () => {
    expect(() => assertRejectionReason('')).toThrow(RejectionReasonRequiredError)
    expect(() => assertRejectionReason('  ')).toThrow(RejectionReasonRequiredError)
    expect(assertRejectionReason(' Missing docs ')).toBe('Missing docs')
  })

  it('cancel and reopen guards (approved can reopen for amendment)', () => {
    expect(() => assertCancellable(pr({ status: 'DRAFT' }))).not.toThrow()
    expect(() => assertCancellable(pr({ status: 'APPROVED' }))).toThrow(PurchaseRequisitionNotEditableError)
    expect(() => assertReopenable(pr({ status: 'REJECTED' }))).not.toThrow()
    expect(() => assertReopenable(pr({ status: 'APPROVED' }))).not.toThrow()
    expect(() => assertReopenable(pr({ status: 'DRAFT' }))).toThrow(PurchaseRequisitionNotEditableError)
  })

  it('normalizes line inputs and computes amount', () => {
    const lines = normalizeLineInputs([
      { itemCode: 'A', itemName: 'Alpha', requiredQuantity: 2, estimatedRate: 10, uomId: 'uom-1' },
    ])
    expect(lines[0].estimatedAmount).toBe(20)
    expect(lines[0].lineNumber).toBe(1)
    expect(isValidSubmittableLine(lines[0])).toBe(true)
  })
})
