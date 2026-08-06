import type { GoodsReceipt, GoodsReceiptLine, GoodsReceiptStatus } from '@prisma/client'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'
import {
  GoodsReceiptValidationError,
  GoodsReceiptWorkflowError,
} from './goods-receipt.errors.js'

export type GrnWithLines = GoodsReceipt & { lines: GoodsReceiptLine[] }

export const GRN_EDITABLE_STATUSES: GoodsReceiptStatus[] = ['DRAFT']
export const GRN_SUBMITTED_STATUSES: GoodsReceiptStatus[] = [
  'SUBMITTED',
  'RECEIVING_COMPLETED',
  'QC_PENDING',
  'PARTIALLY_ACCEPTED',
  'FULLY_ACCEPTED',
  'INVENTORY_POSTED',
]

function workflowError(code: string): GoodsReceiptWorkflowError {
  return new GoodsReceiptWorkflowError(purchaseMessage(code), code)
}

export function parseDateInput(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00.000Z`)
  return new Date(value)
}

export function assertNotDeleted(grn: Pick<GoodsReceipt, 'deletedAt'>): void {
  if (grn.deletedAt) throw workflowError(PURCHASE_ERROR_CODE.GRN_NOT_FOUND)
}

export function assertEditable(grn: Pick<GoodsReceipt, 'status' | 'deletedAt'>): void {
  assertNotDeleted(grn)
  if (!GRN_EDITABLE_STATUSES.includes(grn.status)) {
    throw workflowError(PURCHASE_ERROR_CODE.GRN_NOT_EDITABLE)
  }
}

export function assertSubmittable(grn: GrnWithLines): void {
  assertEditable(grn)
  if (!grn.warehouseId) {
    throw new GoodsReceiptValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.GRN_WAREHOUSE_REQUIRED),
      PURCHASE_ERROR_CODE.GRN_WAREHOUSE_REQUIRED,
      [{ field: 'warehouseId', message: purchaseMessage(PURCHASE_ERROR_CODE.GRN_WAREHOUSE_REQUIRED) }],
    )
  }
  if (grn.lines.length === 0) {
    throw new GoodsReceiptValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.GRN_NO_LINES),
      PURCHASE_ERROR_CODE.GRN_NO_LINES,
      [{ field: 'lines', message: purchaseMessage(PURCHASE_ERROR_CODE.GRN_NO_LINES) }],
    )
  }
}

export function assertToleranceApprovable(grn: Pick<GoodsReceipt, 'status' | 'deletedAt'>): void {
  assertNotDeleted(grn)
  if (grn.status !== 'PENDING_TOLERANCE_APPROVAL') {
    throw workflowError(PURCHASE_ERROR_CODE.GRN_TOLERANCE_NOT_PENDING)
  }
}

export function assertCancellable(grn: Pick<GoodsReceipt, 'status' | 'deletedAt'>): void {
  assertNotDeleted(grn)
  if (
    !['DRAFT', 'PENDING_TOLERANCE_APPROVAL', 'SUBMITTED', 'RECEIVING_COMPLETED', 'QC_PENDING'].includes(
      grn.status,
    )
  ) {
    throw workflowError(PURCHASE_ERROR_CODE.GRN_NOT_CANCELLABLE)
  }
}

export function assertReversible(grn: Pick<GoodsReceipt, 'status' | 'deletedAt'>): void {
  assertNotDeleted(grn)
  if (
    ![
      'SUBMITTED',
      'RECEIVING_COMPLETED',
      'QC_PENDING',
      'PARTIALLY_ACCEPTED',
      'FULLY_ACCEPTED',
      'INVENTORY_POSTED',
    ].includes(grn.status)
  ) {
    throw workflowError(PURCHASE_ERROR_CODE.GRN_NOT_REVERSIBLE)
  }
}

export function assertInventoryPostable(grn: Pick<GoodsReceipt, 'status' | 'deletedAt' | 'warehouseId' | 'inspectionRequired'>): void {
  assertNotDeleted(grn)
  if (!grn.warehouseId) {
    throw new GoodsReceiptValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.GRN_WAREHOUSE_REQUIRED),
      PURCHASE_ERROR_CODE.GRN_WAREHOUSE_REQUIRED,
    )
  }
  if (grn.status === 'INVENTORY_POSTED') return
  const allowed = grn.inspectionRequired
    ? ['PARTIALLY_ACCEPTED', 'FULLY_ACCEPTED']
    : ['SUBMITTED', 'RECEIVING_COMPLETED', 'PARTIALLY_ACCEPTED', 'FULLY_ACCEPTED']
  if (!allowed.includes(grn.status)) {
    throw workflowError(PURCHASE_ERROR_CODE.GRN_NOT_EDITABLE)
  }
}

/** Round money to 2 decimals without float drift. */
export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function qty(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** Remaining primary received qty that can still be reversed on a GRN line. */
export function remainingReversibleReceived(
  line: Pick<GoodsReceiptLine, 'receivedQuantity'> & { reversedQuantity?: unknown },
): number {
  return Math.max(0, qty(line.receivedQuantity) - qty(line.reversedQuantity))
}

export function remainingReversibleAccepted(
  line: Pick<GoodsReceiptLine, 'acceptedQuantity'> & { reversedAcceptedQuantity?: unknown },
): number {
  return Math.max(0, qty(line.acceptedQuantity) - qty(line.reversedAcceptedQuantity))
}

export function remainingReversibleRejected(
  line: Pick<GoodsReceiptLine, 'rejectedQuantity'> & { reversedRejectedQuantity?: unknown },
): number {
  return Math.max(0, qty(line.rejectedQuantity) - qty(line.reversedRejectedQuantity))
}

/** Line has net received/accepted/rejected stock that can still be reversed. */
export function isGrnLineReversible(
  line: Pick<GoodsReceiptLine, 'receivedQuantity' | 'acceptedQuantity' | 'rejectedQuantity'> & {
    reversedQuantity?: unknown
    reversedAcceptedQuantity?: unknown
    reversedRejectedQuantity?: unknown
  },
): boolean {
  return (
    remainingReversibleReceived(line) > 0 ||
    remainingReversibleAccepted(line) > 0 ||
    remainingReversibleRejected(line) > 0
  )
}

export function isGrnLineFullyReversed(
  line: Pick<GoodsReceiptLine, 'receivedQuantity'> & { reversedQuantity?: unknown },
): boolean {
  const received = qty(line.receivedQuantity)
  return received > 0 && remainingReversibleReceived(line) <= 0
}

/** Split a partial reverse qty across remaining accepted/rejected on the line. */
export function allocatePartialReverseQuantities(
  line: Pick<GoodsReceiptLine, 'receivedQuantity' | 'acceptedQuantity' | 'rejectedQuantity'> & {
    reversedQuantity?: unknown
    reversedAcceptedQuantity?: unknown
    reversedRejectedQuantity?: unknown
  },
  reverseReceivedQty: number,
): { received: number; accepted: number; rejected: number } {
  const remaining = remainingReversibleReceived(line)
  const reverseReceived = Math.min(remaining, Math.max(0, qty(reverseReceivedQty)))
  if (reverseReceived <= 0) return { received: 0, accepted: 0, rejected: 0 }

  const remAccepted = remainingReversibleAccepted(line)
  const remRejected = remainingReversibleRejected(line)
  const remTotal = remAccepted + remRejected
  if (remTotal <= 0) {
    return { received: reverseReceived, accepted: reverseReceived, rejected: 0 }
  }

  let accepted = Number(((reverseReceived * remAccepted) / remTotal).toFixed(6))
  if (accepted > remAccepted) accepted = remAccepted
  let rejected = Number((reverseReceived - accepted).toFixed(6))
  if (rejected > remRejected) {
    rejected = remRejected
    accepted = Number((reverseReceived - rejected).toFixed(6))
  }
  return { received: reverseReceived, accepted, rejected }
}

export function allowedActions(
  grn: Pick<GoodsReceipt, 'status' | 'deletedAt' | 'inspectionRequired'> & {
    lines?: Array<
      Pick<GoodsReceiptLine, 'receivedQuantity' | 'acceptedQuantity' | 'rejectedQuantity'> & {
        reversedQuantity?: unknown
        reversedAcceptedQuantity?: unknown
        reversedRejectedQuantity?: unknown
      }
    >
  },
): {
  canEdit: boolean
  canSubmit: boolean
  canCancel: boolean
  canReverse: boolean
  canPostInventory: boolean
  canApproveTolerance: boolean
  canRejectTolerance: boolean
} {
  const active = !grn.deletedAt
  const canPostInventory =
    active &&
    grn.status !== 'INVENTORY_POSTED' &&
    (grn.inspectionRequired
      ? ['PARTIALLY_ACCEPTED', 'FULLY_ACCEPTED'].includes(grn.status)
      : ['SUBMITTED', 'RECEIVING_COMPLETED', 'PARTIALLY_ACCEPTED', 'FULLY_ACCEPTED'].includes(grn.status))
  const pendingTol = active && grn.status === 'PENDING_TOLERANCE_APPROVAL'
  const statusReversible =
    active &&
    [
      'SUBMITTED',
      'RECEIVING_COMPLETED',
      'QC_PENDING',
      'PARTIALLY_ACCEPTED',
      'FULLY_ACCEPTED',
      'INVENTORY_POSTED',
    ].includes(grn.status)
  const hasReversibleLines =
    !grn.lines || grn.lines.length === 0
      ? statusReversible
      : grn.lines.some((l) => isGrnLineReversible(l))
  return {
    canEdit: active && grn.status === 'DRAFT',
    canSubmit: active && grn.status === 'DRAFT',
    canCancel: active &&
      ['DRAFT', 'PENDING_TOLERANCE_APPROVAL', 'SUBMITTED', 'RECEIVING_COMPLETED', 'QC_PENDING'].includes(
        grn.status,
      ),
    canReverse: statusReversible && hasReversibleLines,
    canPostInventory,
    canApproveTolerance: pendingTol,
    canRejectTolerance: pendingTol,
  }
}
