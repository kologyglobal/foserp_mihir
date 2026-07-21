import type { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus } from '@prisma/client'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'
import {
  PurchaseOrderValidationError,
  PurchaseOrderWorkflowError,
} from './purchase-order.errors.js'
import type { PurchaseOrderLineInput } from './purchase-order.validation.js'

export type PoWithLines = PurchaseOrder & { lines: PurchaseOrderLine[] }

/** Statuses where the header/lines may still be edited by the buyer. */
export const PO_EDITABLE_STATUSES: PurchaseOrderStatus[] = ['DRAFT', 'SENT_BACK']

/** Statuses that may receive goods (Phase 3 GRN gate). */
export const PO_RECEIVABLE_STATUSES: PurchaseOrderStatus[] = [
  'SENT_TO_VENDOR',
  'PARTIALLY_RECEIVED',
]

function workflowError(code: string): PurchaseOrderWorkflowError {
  return new PurchaseOrderWorkflowError(purchaseMessage(code), code)
}

export function parseDateInput(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00.000Z`)
  return new Date(value)
}

export function assertNotDeleted(po: Pick<PurchaseOrder, 'deletedAt'>): void {
  if (po.deletedAt) throw workflowError(PURCHASE_ERROR_CODE.PO_NOT_FOUND)
}

export function assertEditable(po: Pick<PurchaseOrder, 'status' | 'deletedAt'>): void {
  assertNotDeleted(po)
  if (!PO_EDITABLE_STATUSES.includes(po.status)) {
    throw workflowError(PURCHASE_ERROR_CODE.PO_NOT_EDITABLE)
  }
}

export function assertSubmittable(po: PoWithLines): void {
  assertNotDeleted(po)
  if (!PO_EDITABLE_STATUSES.includes(po.status)) {
    throw workflowError(PURCHASE_ERROR_CODE.PO_NOT_SUBMITTABLE)
  }
  if (!po.vendorId) {
    throw new PurchaseOrderValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_VENDOR_REQUIRED),
      PURCHASE_ERROR_CODE.PO_VENDOR_REQUIRED,
      [{ field: 'vendorId', message: purchaseMessage(PURCHASE_ERROR_CODE.PO_VENDOR_REQUIRED) }],
    )
  }
  const validLines = po.lines.filter((l) => Number(l.quantity) > 0)
  if (validLines.length === 0) {
    throw new PurchaseOrderValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_NO_LINES),
      PURCHASE_ERROR_CODE.PO_NO_LINES,
      [{ field: 'lines', message: purchaseMessage(PURCHASE_ERROR_CODE.PO_NO_LINES) }],
    )
  }
  for (const line of validLines) {
    if (!(Number(line.rate) >= 0)) {
      throw new PurchaseOrderValidationError(
        purchaseMessage(PURCHASE_ERROR_CODE.PO_RATE_INVALID),
        PURCHASE_ERROR_CODE.PO_RATE_INVALID,
        [{ field: 'lines.rate', message: purchaseMessage(PURCHASE_ERROR_CODE.PO_RATE_INVALID) }],
      )
    }
  }
}

/** True when the actor is the maker (creator) of the PO. */
export function isSelfApproval(
  po: Pick<PurchaseOrder, 'createdById'>,
  actorId?: string,
): boolean {
  return Boolean(actorId && actorId === po.createdById)
}

export function assertApprovable(
  po: Pick<PurchaseOrder, 'status' | 'deletedAt' | 'createdById'>,
  actorId?: string,
  opts: { allowSelfApproval?: boolean } = {},
): void {
  assertNotDeleted(po)
  if (po.status !== 'PENDING_APPROVAL') {
    throw workflowError(PURCHASE_ERROR_CODE.PO_NOT_APPROVABLE)
  }
  if (!opts.allowSelfApproval && isSelfApproval(po, actorId)) {
    throw workflowError(PURCHASE_ERROR_CODE.APPROVAL_SELF_ACTION_NOT_ALLOWED)
  }
}

export function assertRejectable(po: Pick<PurchaseOrder, 'status' | 'deletedAt'>): void {
  assertNotDeleted(po)
  if (po.status !== 'PENDING_APPROVAL') {
    throw workflowError(PURCHASE_ERROR_CODE.PO_NOT_APPROVABLE)
  }
}

export function assertSendBackable(po: Pick<PurchaseOrder, 'status' | 'deletedAt'>): void {
  assertNotDeleted(po)
  if (po.status !== 'PENDING_APPROVAL') {
    throw workflowError(PURCHASE_ERROR_CODE.PO_NOT_APPROVABLE)
  }
}

export function assertSendableToVendor(po: Pick<PurchaseOrder, 'status' | 'deletedAt'>): void {
  assertNotDeleted(po)
  if (po.status !== 'APPROVED') {
    throw workflowError(PURCHASE_ERROR_CODE.PO_NOT_SENDABLE)
  }
}

export function assertCancellable(po: PoWithLines): void {
  assertNotDeleted(po)
  const allowed: PurchaseOrderStatus[] = [
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'SENT_BACK',
    'SENT_TO_VENDOR',
  ]
  if (!allowed.includes(po.status)) {
    throw workflowError(PURCHASE_ERROR_CODE.PO_INVALID_STATUS)
  }
  // A PO with any receipt against it can no longer be cancelled — it must be closed.
  if (totalReceived(po.lines) > 0) {
    throw workflowError(PURCHASE_ERROR_CODE.PO_CANNOT_CANCEL_RECEIVED)
  }
}

export function assertCloseable(po: Pick<PurchaseOrder, 'status' | 'deletedAt'>): void {
  assertNotDeleted(po)
  const allowed: PurchaseOrderStatus[] = [
    'SENT_TO_VENDOR',
    'PARTIALLY_RECEIVED',
    'FULLY_RECEIVED',
    'PARTIALLY_INVOICED',
    'FULLY_INVOICED',
  ]
  if (!allowed.includes(po.status)) {
    throw workflowError(PURCHASE_ERROR_CODE.PO_NOT_CLOSABLE)
  }
}

export function assertReopenable(po: PoWithLines): void {
  assertNotDeleted(po)
  const allowed: PurchaseOrderStatus[] = ['REJECTED', 'CANCELLED', 'CLOSED']
  if (!allowed.includes(po.status)) {
    throw workflowError(PURCHASE_ERROR_CODE.PO_NOT_REOPENABLE)
  }
  if (po.status === 'CANCELLED' && totalReceived(po.lines) > 0) {
    throw workflowError(PURCHASE_ERROR_CODE.PO_NOT_REOPENABLE)
  }
}

export function assertReasonPresent(reason: string | null | undefined, code: string): string {
  const trimmed = reason?.trim() ?? ''
  if (!trimmed) {
    throw new PurchaseOrderValidationError(purchaseMessage(code), code, [
      { field: 'reason', message: purchaseMessage(code) },
    ])
  }
  return trimmed
}

function totalReceived(lines: Array<Pick<PurchaseOrderLine, 'receivedQuantity'>>): number {
  return lines.reduce((sum, l) => sum + Number(l.receivedQuantity), 0)
}

/**
 * Derive the receipt-driven header status from line quantities.
 * Used on reopen-from-closed and (Phase 3) after every GRN posting.
 */
export function deriveReceiptStatus(
  lines: Array<Pick<PurchaseOrderLine, 'quantity' | 'receivedQuantity'>>,
): Extract<PurchaseOrderStatus, 'SENT_TO_VENDOR' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED'> {
  const ordered = lines.reduce((sum, l) => sum + Number(l.quantity), 0)
  const received = totalReceived(lines as never)
  if (received <= 0) return 'SENT_TO_VENDOR'
  if (received >= ordered) return 'FULLY_RECEIVED'
  return 'PARTIALLY_RECEIVED'
}

/** Round money to 2 decimals without float drift on typical ERP magnitudes. */
export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function normalizeLineInputs(lines: PurchaseOrderLineInput[]): Array<{
  lineNumber: number
  itemId: string | null
  itemCodeSnapshot: string
  itemNameSnapshot: string
  description: string | null
  quantity: number
  uomId: string | null
  rate: number
  amount: number
  requiredDate: Date | null
  remarks: string | null
  purchaseRequisitionLineId: string | null
  purchasePlanningRowId: string | null
}> {
  return lines.map((line, index) => {
    const qty = Number(line.quantity)
    if (!(qty > 0)) {
      throw new PurchaseOrderValidationError(
        purchaseMessage(PURCHASE_ERROR_CODE.PO_QTY_INVALID),
        PURCHASE_ERROR_CODE.PO_QTY_INVALID,
        [{ field: `lines[${index}].quantity`, message: purchaseMessage(PURCHASE_ERROR_CODE.PO_QTY_INVALID) }],
      )
    }
    const rate = Number(line.rate ?? 0)
    if (rate < 0) {
      throw new PurchaseOrderValidationError(
        purchaseMessage(PURCHASE_ERROR_CODE.PO_RATE_INVALID),
        PURCHASE_ERROR_CODE.PO_RATE_INVALID,
        [{ field: `lines[${index}].rate`, message: purchaseMessage(PURCHASE_ERROR_CODE.PO_RATE_INVALID) }],
      )
    }
    return {
      lineNumber: line.lineNumber ?? index + 1,
      itemId: line.itemId ?? null,
      itemCodeSnapshot: (line.itemCode ?? '').trim(),
      itemNameSnapshot: (line.itemName ?? '').trim(),
      description: line.description?.trim() || null,
      quantity: qty,
      uomId: line.uomId ?? null,
      rate,
      amount: money(qty * rate),
      requiredDate: parseDateInput(line.requiredDate ?? undefined) ?? null,
      remarks: line.remarks?.trim() || null,
      purchaseRequisitionLineId: line.purchaseRequisitionLineId ?? null,
      purchasePlanningRowId: line.purchasePlanningRowId ?? null,
    }
  })
}

/** Backend-provided action eligibility so the frontend never guesses. */
export function allowedActions(po: PoWithLines): {
  canEdit: boolean
  canSubmit: boolean
  canApprove: boolean
  canReject: boolean
  canSendBack: boolean
  canSendToVendor: boolean
  canCancel: boolean
  canClose: boolean
  canReopen: boolean
  canReceive: boolean
} {
  const received = totalReceived(po.lines)
  const editable = !po.deletedAt && PO_EDITABLE_STATUSES.includes(po.status)
  const pending = !po.deletedAt && po.status === 'PENDING_APPROVAL'
  return {
    canEdit: editable,
    canSubmit: editable,
    canApprove: pending,
    canReject: pending,
    canSendBack: pending,
    canSendToVendor: !po.deletedAt && po.status === 'APPROVED',
    canCancel:
      !po.deletedAt &&
      received === 0 &&
      ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SENT_BACK', 'SENT_TO_VENDOR'].includes(
        po.status,
      ),
    canClose:
      !po.deletedAt &&
      ['SENT_TO_VENDOR', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'PARTIALLY_INVOICED', 'FULLY_INVOICED'].includes(
        po.status,
      ),
    canReopen:
      !po.deletedAt &&
      (po.status === 'REJECTED' ||
        po.status === 'CLOSED' ||
        (po.status === 'CANCELLED' && received === 0)),
    canReceive: !po.deletedAt && PO_RECEIVABLE_STATUSES.includes(po.status),
  }
}
