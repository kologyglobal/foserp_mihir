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

/**
 * Received/Accepted/Rejected split for a GRN line at create/update time.
 *
 * Phase 2 hardening — fully deferred to QC: when inspection is required, this
 * GRN line only captures Received. Accepted/Rejected always resolve to 0 here
 * regardless of client input (even a stale/tampered payload cannot pre-judge
 * acceptance) — they are set only when the Quality Inspection completes, via
 * a separate write path (`quality-inspection.service.ts`).
 */
export function resolveGrnLineAcceptReject(input: {
  receivedQuantity: number
  qcRequired: boolean
  /** Raw client input — `null`/`undefined` means "not provided" (distinct from 0). */
  rejectedQuantityInput?: unknown
  acceptedQuantityInput?: unknown
  damagedQuantityInput?: unknown
}): { accepted: number; rejected: number; damaged: number } {
  const received = Math.max(0, input.receivedQuantity)
  const qcRequired = Boolean(input.qcRequired)
  const damaged = qcRequired ? 0 : qty(input.damagedQuantityInput)
  const rejected =
    received <= 0 || qcRequired
      ? 0
      : input.rejectedQuantityInput != null
        ? qty(input.rejectedQuantityInput)
        : damaged
  const accepted =
    received <= 0
      ? 0
      : qcRequired
        ? 0
        : input.acceptedQuantityInput != null
          ? qty(input.acceptedQuantityInput)
          : Math.max(0, received - rejected)
  return { accepted, rejected, damaged }
}

export function isGrnLineFullyReversed(
  line: Pick<GoodsReceiptLine, 'receivedQuantity'> & { reversedQuantity?: unknown },
): boolean {
  const received = qty(line.receivedQuantity)
  return received > 0 && remainingReversibleReceived(line) <= 0
}

/**
 * Quantity already sent back to the vendor via a completed Material Return has, from a
 * stock-on-hand perspective, already had its own stock-out movement posted — reversing
 * the GRN on top of it would remove the same units a second time (e.g. 50 received, 15
 * already returned, would otherwise still offer "50 reversible" instead of the 35 that
 * are actually still on hand from this GRN). Netting the returned qty into the
 * "already reversed" buckets keeps every reverse calculation (remaining qty, full-reversal
 * check, accepted/rejected split) consistent without duplicating this logic per call site.
 * Returns are assumed to come out of the rejected bucket first (the common QC-reject
 * return case), spilling into accepted only once rejected is exhausted.
 */
export function netLineForReverse<
  T extends Pick<GoodsReceiptLine, 'receivedQuantity' | 'acceptedQuantity' | 'rejectedQuantity'> & {
    reversedQuantity?: unknown
    reversedAcceptedQuantity?: unknown
    reversedRejectedQuantity?: unknown
  },
>(line: T, returnedQuantity: number): T {
  const returned = qty(returnedQuantity)
  if (returned <= 0) return line
  const remRejected = remainingReversibleRejected(line)
  const returnedFromRejected = Math.min(remRejected, returned)
  const returnedFromAccepted = Math.max(0, returned - returnedFromRejected)
  return {
    ...line,
    reversedQuantity: qty(line.reversedQuantity) + returned,
    reversedAcceptedQuantity: qty(line.reversedAcceptedQuantity) + returnedFromAccepted,
    reversedRejectedQuantity: qty(line.reversedRejectedQuantity) + returnedFromRejected,
  }
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
