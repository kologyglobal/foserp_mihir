import type { PurchaseRequisition, PurchaseRequisitionLine, PurchaseRequisitionStatus } from '@prisma/client'
import {
  InvalidPurchaseQuantityError,
  PurchaseRequisitionNotApprovableError,
  PurchaseRequisitionNotEditableError,
  PurchaseRequisitionNotSubmittableError,
  PurchaseRequisitionValidationError,
  RejectionReasonRequiredError,
} from './purchase-requisition.errors.js'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'
import type { PurchaseRequisitionLineInput } from './purchase-requisition.validation.js'

export type PrWithLines = PurchaseRequisition & { lines: PurchaseRequisitionLine[] }

export function parseDateInput(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00.000Z`)
  return new Date(value)
}

export function toDateOnlyKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function assertRequiredDateNotBeforeRequisition(
  requisitionDate: Date,
  requiredDate: Date | null | undefined,
): void {
  if (!requiredDate) return
  if (toDateOnlyKey(requiredDate) < toDateOnlyKey(requisitionDate)) {
    throw new PurchaseRequisitionValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PR_REQUIRED_DATE_BEFORE_REQUISITION),
      PURCHASE_ERROR_CODE.PR_REQUIRED_DATE_BEFORE_REQUISITION,
      [{ field: 'requiredDate', message: purchaseMessage(PURCHASE_ERROR_CODE.PR_REQUIRED_DATE_BEFORE_REQUISITION) }],
    )
  }
}

export function isLineIdentityPresent(line: {
  itemId?: string | null
  itemCode?: string | null
  itemName?: string | null
  itemCodeSnapshot?: string | null
  itemNameSnapshot?: string | null
}): boolean {
  const code = (line.itemCode ?? line.itemCodeSnapshot ?? '').trim()
  const name = (line.itemName ?? line.itemNameSnapshot ?? '').trim()
  return Boolean(line.itemId || code || name)
}

export function isValidSubmittableLine(line: {
  itemId?: string | null
  itemCode?: string | null
  itemName?: string | null
  itemCodeSnapshot?: string | null
  itemNameSnapshot?: string | null
  requiredQuantity: number | { toString(): string }
  uomId?: string | null
}): boolean {
  const qty = Number(line.requiredQuantity)
  const uomOk = Boolean(line.uomId && String(line.uomId).trim())
  return isLineIdentityPresent(line) && qty > 0 && uomOk
}

export function assertQuantityPositive(qty: number, field = 'requiredQuantity'): void {
  if (!(qty > 0)) {
    throw new InvalidPurchaseQuantityError(purchaseMessage(PURCHASE_ERROR_CODE.PR_QTY_INVALID), field)
  }
}

export function assertDraftEditable(pr: Pick<PurchaseRequisition, 'status' | 'deletedAt'>): void {
  if (pr.deletedAt) {
    throw new PurchaseRequisitionNotEditableError(
      purchaseMessage(PURCHASE_ERROR_CODE.PR_NOT_FOUND),
      PURCHASE_ERROR_CODE.PR_NOT_FOUND,
    )
  }
  if (pr.status === 'DRAFT') return

  if (pr.status === 'SUBMITTED' || pr.status === 'PENDING_APPROVAL') {
    throw new PurchaseRequisitionNotEditableError(
      purchaseMessage(PURCHASE_ERROR_CODE.PR_NOT_EDITABLE),
      PURCHASE_ERROR_CODE.PR_NOT_EDITABLE,
    )
  }

  if (pr.status === 'APPROVED') {
    throw new PurchaseRequisitionNotEditableError(
      purchaseMessage(PURCHASE_ERROR_CODE.PR_MUST_REOPEN),
      PURCHASE_ERROR_CODE.PR_MUST_REOPEN,
    )
  }

  throw new PurchaseRequisitionNotEditableError(
    purchaseMessage(PURCHASE_ERROR_CODE.PR_INVALID_STATUS),
    PURCHASE_ERROR_CODE.PR_INVALID_STATUS,
  )
}

function assertHeaderSubmittable(pr: PrWithLines): void {
  if (!(pr.departmentId ?? '').trim()) {
    throw new PurchaseRequisitionValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PR_DEPARTMENT_REQUIRED),
      PURCHASE_ERROR_CODE.PR_DEPARTMENT_REQUIRED,
      [{ field: 'departmentId', message: purchaseMessage(PURCHASE_ERROR_CODE.PR_DEPARTMENT_REQUIRED) }],
    )
  }
  if (!(pr.requestedById ?? '').trim()) {
    throw new PurchaseRequisitionValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PR_REQUESTED_BY_REQUIRED),
      PURCHASE_ERROR_CODE.PR_REQUESTED_BY_REQUIRED,
      [{ field: 'requestedById', message: purchaseMessage(PURCHASE_ERROR_CODE.PR_REQUESTED_BY_REQUIRED) }],
    )
  }
  if (!pr.requisitionDate) {
    throw new PurchaseRequisitionValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PR_REQUISITION_DATE_REQUIRED),
      PURCHASE_ERROR_CODE.PR_REQUISITION_DATE_REQUIRED,
      [{ field: 'requisitionDate', message: purchaseMessage(PURCHASE_ERROR_CODE.PR_REQUISITION_DATE_REQUIRED) }],
    )
  }
  if (!pr.requiredDate) {
    throw new PurchaseRequisitionValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PR_REQUIRED_DATE_REQUIRED),
      PURCHASE_ERROR_CODE.PR_REQUIRED_DATE_REQUIRED,
      [{ field: 'requiredDate', message: purchaseMessage(PURCHASE_ERROR_CODE.PR_REQUIRED_DATE_REQUIRED) }],
    )
  }
  if (typeof pr.rfqRequired !== 'boolean') {
    throw new PurchaseRequisitionValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PR_RFQ_REQUIRED_SELECTION),
      PURCHASE_ERROR_CODE.PR_RFQ_REQUIRED_SELECTION,
      [{ field: 'rfqRequired', message: purchaseMessage(PURCHASE_ERROR_CODE.PR_RFQ_REQUIRED_SELECTION) }],
    )
  }
}

export function assertSubmittable(pr: PrWithLines): void {
  if (pr.deletedAt) {
    throw new PurchaseRequisitionNotSubmittableError(
      purchaseMessage(PURCHASE_ERROR_CODE.PR_NOT_FOUND),
      PURCHASE_ERROR_CODE.PR_NOT_FOUND,
    )
  }
  if (pr.status !== 'DRAFT') {
    throw new PurchaseRequisitionNotSubmittableError(
      purchaseMessage(PURCHASE_ERROR_CODE.PR_INVALID_STATUS),
      PURCHASE_ERROR_CODE.PR_INVALID_STATUS,
    )
  }

  assertHeaderSubmittable(pr)

  const candidateLines = pr.lines.filter((l) => isLineIdentityPresent(l) || Number(l.requiredQuantity) > 0)
  if (candidateLines.length === 0 && pr.lines.length === 0) {
    throw new PurchaseRequisitionValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PR_NO_LINES),
      PURCHASE_ERROR_CODE.PR_NO_LINES,
      [{ field: 'lines', message: purchaseMessage(PURCHASE_ERROR_CODE.PR_NO_LINES) }],
    )
  }

  const validLines = pr.lines.filter((l) => isValidSubmittableLine(l))
  if (validLines.length === 0) {
    // Diagnose first incomplete line for a stable code
    for (const line of pr.lines) {
      if (!isLineIdentityPresent(line)) {
        throw new PurchaseRequisitionValidationError(
          purchaseMessage(PURCHASE_ERROR_CODE.PR_ITEM_REQUIRED),
          PURCHASE_ERROR_CODE.PR_ITEM_REQUIRED,
          [{ field: 'lines.itemId', message: purchaseMessage(PURCHASE_ERROR_CODE.PR_ITEM_REQUIRED) }],
        )
      }
      if (!(Number(line.requiredQuantity) > 0)) {
        throw new InvalidPurchaseQuantityError()
      }
      if (!(line.uomId && String(line.uomId).trim())) {
        throw new PurchaseRequisitionValidationError(
          purchaseMessage(PURCHASE_ERROR_CODE.PR_UOM_REQUIRED),
          PURCHASE_ERROR_CODE.PR_UOM_REQUIRED,
          [{ field: 'lines.uomId', message: purchaseMessage(PURCHASE_ERROR_CODE.PR_UOM_REQUIRED) }],
        )
      }
    }
    throw new PurchaseRequisitionValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PR_NO_LINES),
      PURCHASE_ERROR_CODE.PR_NO_LINES,
      [{ field: 'lines', message: purchaseMessage(PURCHASE_ERROR_CODE.PR_NO_LINES) }],
    )
  }

  for (const line of validLines) {
    assertQuantityPositive(Number(line.requiredQuantity))
    if (!(line.uomId && String(line.uomId).trim())) {
      throw new PurchaseRequisitionValidationError(
        purchaseMessage(PURCHASE_ERROR_CODE.PR_UOM_REQUIRED),
        PURCHASE_ERROR_CODE.PR_UOM_REQUIRED,
        [{ field: 'lines.uomId', message: purchaseMessage(PURCHASE_ERROR_CODE.PR_UOM_REQUIRED) }],
      )
    }
    if (line.requiredDate) {
      assertRequiredDateNotBeforeRequisition(pr.requisitionDate, line.requiredDate)
    }
  }
  assertRequiredDateNotBeforeRequisition(pr.requisitionDate, pr.requiredDate)
}

export function assertApprovable(pr: Pick<PurchaseRequisition, 'status' | 'deletedAt'>): void {
  if (pr.deletedAt) {
    throw new PurchaseRequisitionNotApprovableError(purchaseMessage(PURCHASE_ERROR_CODE.PR_NOT_FOUND))
  }
  if (pr.status !== 'PENDING_APPROVAL' && pr.status !== 'SUBMITTED') {
    throw new PurchaseRequisitionNotApprovableError(purchaseMessage(PURCHASE_ERROR_CODE.PR_INVALID_STATUS))
  }
}

export function assertRejectable(pr: Pick<PurchaseRequisition, 'status' | 'deletedAt'>): void {
  if (pr.deletedAt) {
    throw new PurchaseRequisitionNotApprovableError(purchaseMessage(PURCHASE_ERROR_CODE.PR_NOT_FOUND))
  }
  if (pr.status !== 'PENDING_APPROVAL' && pr.status !== 'SUBMITTED') {
    throw new PurchaseRequisitionNotApprovableError(purchaseMessage(PURCHASE_ERROR_CODE.PR_INVALID_STATUS))
  }
}

export function assertRejectionReason(reason: string | null | undefined): string {
  const trimmed = reason?.trim() ?? ''
  if (!trimmed) throw new RejectionReasonRequiredError()
  return trimmed
}

export function assertCancellable(pr: Pick<PurchaseRequisition, 'status' | 'deletedAt'>): void {
  if (pr.deletedAt) {
    throw new PurchaseRequisitionNotEditableError(
      purchaseMessage(PURCHASE_ERROR_CODE.PR_NOT_FOUND),
      PURCHASE_ERROR_CODE.PR_NOT_FOUND,
    )
  }
  const allowed: PurchaseRequisitionStatus[] = ['DRAFT', 'REJECTED', 'SUBMITTED', 'PENDING_APPROVAL']
  if (!allowed.includes(pr.status)) {
    throw new PurchaseRequisitionNotEditableError(
      purchaseMessage(PURCHASE_ERROR_CODE.PR_INVALID_STATUS),
      PURCHASE_ERROR_CODE.PR_INVALID_STATUS,
    )
  }
}

export function assertReopenable(pr: Pick<PurchaseRequisition, 'status' | 'deletedAt'>): void {
  if (pr.deletedAt) {
    throw new PurchaseRequisitionNotEditableError(
      purchaseMessage(PURCHASE_ERROR_CODE.PR_NOT_FOUND),
      PURCHASE_ERROR_CODE.PR_NOT_FOUND,
    )
  }
  const allowed: PurchaseRequisitionStatus[] = ['REJECTED', 'CANCELLED', 'APPROVED']
  if (!allowed.includes(pr.status)) {
    throw new PurchaseRequisitionNotEditableError(
      purchaseMessage(PURCHASE_ERROR_CODE.PR_INVALID_STATUS),
      PURCHASE_ERROR_CODE.PR_INVALID_STATUS,
    )
  }
}

export function normalizeLineInputs(lines: PurchaseRequisitionLineInput[]): Array<{
  id?: string
  lineNumber: number
  itemId: string | null
  itemCodeSnapshot: string
  itemNameSnapshot: string
  description: string | null
  requiredQuantity: number
  uomId: string | null
  estimatedRate: number
  estimatedAmount: number
  warehouseId: string | null
  binId: string | null
  preferredVendorId: string | null
  requiredDate: Date | null
  remarks: string | null
}> {
  return lines.map((line, index) => {
    const qty = Number(line.requiredQuantity)
    if (qty < 0) {
      throw new InvalidPurchaseQuantityError('Quantity cannot be negative')
    }
    // Draft may include placeholder zero-qty rows; submit enforces > 0 on valid lines.
    const rate = Number(line.estimatedRate ?? 0)
    return {
      id: line.id,
      lineNumber: line.lineNumber ?? index + 1,
      itemId: line.itemId ?? null,
      itemCodeSnapshot: (line.itemCode ?? '').trim(),
      itemNameSnapshot: (line.itemName ?? '').trim(),
      description: line.description?.trim() || null,
      requiredQuantity: qty,
      uomId: line.uomId ?? null,
      estimatedRate: rate,
      estimatedAmount: Number((qty * rate).toFixed(2)),
      warehouseId: line.warehouseId ?? null,
      binId: line.binId?.trim() || null,
      preferredVendorId: line.preferredVendorId ?? null,
      requiredDate: parseDateInput(line.requiredDate ?? undefined) ?? null,
      remarks: line.remarks?.trim() || null,
    }
  })
}
