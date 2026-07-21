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
  const valid = grn.lines.filter((l) => Number(l.receivedQuantity) > 0)
  if (valid.length === 0) {
    throw new GoodsReceiptValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.GRN_NO_LINES),
      PURCHASE_ERROR_CODE.GRN_NO_LINES,
      [{ field: 'lines', message: purchaseMessage(PURCHASE_ERROR_CODE.GRN_NO_LINES) }],
    )
  }
}

export function assertCancellable(grn: Pick<GoodsReceipt, 'status' | 'deletedAt'>): void {
  assertNotDeleted(grn)
  if (!['DRAFT', 'SUBMITTED', 'RECEIVING_COMPLETED', 'QC_PENDING'].includes(grn.status)) {
    throw workflowError(PURCHASE_ERROR_CODE.GRN_NOT_CANCELLABLE)
  }
}

export function assertReversible(grn: Pick<GoodsReceipt, 'status' | 'deletedAt'>): void {
  assertNotDeleted(grn)
  if (!['SUBMITTED', 'RECEIVING_COMPLETED', 'QC_PENDING', 'PARTIALLY_ACCEPTED', 'FULLY_ACCEPTED'].includes(grn.status)) {
    throw workflowError(PURCHASE_ERROR_CODE.GRN_NOT_REVERSIBLE)
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

export function allowedActions(grn: Pick<GoodsReceipt, 'status' | 'deletedAt'>): {
  canEdit: boolean
  canSubmit: boolean
  canCancel: boolean
  canReverse: boolean
} {
  const active = !grn.deletedAt
  return {
    canEdit: active && grn.status === 'DRAFT',
    canSubmit: active && grn.status === 'DRAFT',
    canCancel: active && ['DRAFT', 'SUBMITTED', 'RECEIVING_COMPLETED', 'QC_PENDING'].includes(grn.status),
    canReverse:
      active &&
      ['SUBMITTED', 'RECEIVING_COMPLETED', 'QC_PENDING', 'PARTIALLY_ACCEPTED', 'FULLY_ACCEPTED'].includes(
        grn.status,
      ),
  }
}
