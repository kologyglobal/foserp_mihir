import type { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus } from '@prisma/client'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'
import {
  lineAmountFromVendor,
  resolveDualQuantities,
  toPrimaryUnitCost,
  UomConversionError,
} from '../shared/uom-conversion.js'
import { EMPTY_TAX_SNAPSHOT } from '../shared/purchase-tax-snapshot.js'
import {
  PurchaseOrderValidationError,
  PurchaseOrderWorkflowError,
} from './purchase-order.errors.js'
import type { PurchaseOrderLineInput } from './purchase-order.validation.js'
import { requiresBackdatedPoApproval, type PoBackdatePolicy } from './purchase-order-backdate.js'

export type PoWithLines = PurchaseOrder & { lines: PurchaseOrderLine[] }

/** Statuses where the header/lines may still be edited by the buyer. */
export const PO_EDITABLE_STATUSES: PurchaseOrderStatus[] = ['DRAFT', 'SENT_BACK']

/** Statuses that may be amended via versioned revise (not draft edit). */
export const PO_REVISABLE_STATUSES: PurchaseOrderStatus[] = [
  'SENT_TO_VENDOR',
  'PARTIALLY_RECEIVED',
  'FULLY_RECEIVED',
  'PARTIALLY_INVOICED',
  'FULLY_INVOICED',
]

/** Statuses that may receive goods (Phase 3 GRN gate). */
export const PO_RECEIVABLE_STATUSES: PurchaseOrderStatus[] = [
  'SENT_TO_VENDOR',
  'PARTIALLY_RECEIVED',
]

/** Resolve receivable PO statuses based on release workflow policy. */
export function resolvePoReceivableStatuses(requirePoReleaseWorkflow = true): PurchaseOrderStatus[] {
  if (requirePoReleaseWorkflow) return PO_RECEIVABLE_STATUSES
  return ['DRAFT', ...PO_RECEIVABLE_STATUSES]
}

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

export function assertRevisable(
  po: Pick<PurchaseOrder, 'status' | 'deletedAt'> & {
    lines?: Array<Pick<PurchaseOrderLine, 'receivedQuantity'>>
  },
): void {
  assertNotDeleted(po)
  if (!PO_REVISABLE_STATUSES.includes(po.status)) {
    throw workflowError(PURCHASE_ERROR_CODE.PO_NOT_REVISABLE)
  }
  const received = (po.lines ?? []).reduce((sum, l) => sum + Number(l.receivedQuantity), 0)
  if (received > 0) {
    throw workflowError(PURCHASE_ERROR_CODE.PO_NOT_REVISABLE)
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

export function assertSendableToVendor(
  po: Pick<PurchaseOrder, 'status' | 'deletedAt'>,
  opts: { requireApprovalOnPo?: boolean } = {},
): void {
  assertNotDeleted(po)
  const requireApproval = opts.requireApprovalOnPo !== false
  if (requireApproval) {
    // Legacy rows may still sit in APPROVED before release.
    if (po.status !== 'APPROVED') {
      throw workflowError(PURCHASE_ERROR_CODE.PO_NOT_SENDABLE)
    }
    return
  }
  // Approval-off: release directly from Open / Sent Back.
  if (!PO_EDITABLE_STATUSES.includes(po.status)) {
    throw workflowError(PURCHASE_ERROR_CODE.PO_NOT_SENDABLE)
  }
}

/** Withdraw from Pending Approved back to Open (Draft). */
export function assertWithdrawFromApproval(po: Pick<PurchaseOrder, 'status' | 'deletedAt'>): void {
  assertNotDeleted(po)
  if (po.status !== 'PENDING_APPROVAL') {
    throw workflowError(PURCHASE_ERROR_CODE.PO_INVALID_STATUS)
  }
}

export function assertCancellable(po: PoWithLines): void {
  assertNotDeleted(po)
  // Cancel = withdraw Pending Approved → Open, or soft-delete an Open (Draft) PO.
  if (po.status !== 'PENDING_APPROVAL' && po.status !== 'DRAFT') {
    throw workflowError(PURCHASE_ERROR_CODE.PO_INVALID_STATUS)
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
  uomQuantity: number
  uomConversionFactor: number
  unitCostPrimary: number
  uomId: string | null
  rate: number
  amount: number
  requiredDate: Date | null
  remarks: string | null
  purchaseRequisitionLineId: string | null
  purchasePlanningRowId: string | null
  requisitionNumber: string | null
  gstGroupId: string | null
  hsnId: string | null
  hsnCodeSnapshot: string
  gstGroupCodeSnapshot: string
  gstRatePctSnapshot: number
  cgstRateSnapshot: number
  sgstRateSnapshot: number
  igstRateSnapshot: number
  gstSchemeSnapshot: string
  binId: string | null
  qcRequiredSnapshot: boolean
  qualityTestGroupCodeSnapshot: string | null
}> {
  return lines.map((line, index) => {
    const rate = Number(line.rate ?? 0)
    if (rate < 0) {
      throw new PurchaseOrderValidationError(
        purchaseMessage(PURCHASE_ERROR_CODE.PO_RATE_INVALID),
        PURCHASE_ERROR_CODE.PO_RATE_INVALID,
        [{ field: `lines[${index}].rate`, message: purchaseMessage(PURCHASE_ERROR_CODE.PO_RATE_INVALID) }],
      )
    }

    let dual: ReturnType<typeof resolveDualQuantities>
    try {
      dual = resolveDualQuantities({
        uomQuantity: line.uomQuantity,
        quantity: line.quantity,
        uomConversionFactor: line.uomConversionFactor ?? 1,
      })
    } catch (err) {
      if (err instanceof UomConversionError) {
        throw new PurchaseOrderValidationError(err.message, PURCHASE_ERROR_CODE.PO_QTY_INVALID, [
          { field: `lines[${index}].uomConversionFactor`, message: err.message },
        ])
      }
      throw err
    }

    if (!(dual.uomQuantity > 0) || !(dual.quantity > 0)) {
      throw new PurchaseOrderValidationError(
        purchaseMessage(PURCHASE_ERROR_CODE.PO_QTY_INVALID),
        PURCHASE_ERROR_CODE.PO_QTY_INVALID,
        [{ field: `lines[${index}].uomQuantity`, message: purchaseMessage(PURCHASE_ERROR_CODE.PO_QTY_INVALID) }],
      )
    }

    const unitCostPrimary =
      line.unitCostPrimary != null && Number(line.unitCostPrimary) >= 0
        ? Number(line.unitCostPrimary)
        : toPrimaryUnitCost(rate, dual.uomConversionFactor)

    return {
      lineNumber: line.lineNumber ?? index + 1,
      itemId: line.itemId ?? null,
      itemCodeSnapshot: (line.itemCode ?? '').trim(),
      itemNameSnapshot: (line.itemName ?? '').trim(),
      description: line.description?.trim() || null,
      quantity: dual.quantity,
      uomQuantity: dual.uomQuantity,
      uomConversionFactor: dual.uomConversionFactor,
      unitCostPrimary,
      uomId: line.uomId ?? null,
      rate,
      amount: money(lineAmountFromVendor(rate, dual.uomQuantity)),
      requiredDate: parseDateInput(line.requiredDate ?? undefined) ?? null,
      remarks: line.remarks?.trim() || null,
      purchaseRequisitionLineId: line.purchaseRequisitionLineId ?? null,
      purchasePlanningRowId: line.purchasePlanningRowId ?? null,
      requisitionNumber: line.requisitionNumber?.trim() || null,
      gstGroupId: line.gstGroupId ?? null,
      hsnId: line.hsnId ?? null,
      hsnCodeSnapshot: '',
      gstGroupCodeSnapshot: '',
      ...EMPTY_TAX_SNAPSHOT,
      binId: line.binId ?? null,
      qcRequiredSnapshot: false,
      qualityTestGroupCodeSnapshot: line.qualityTestGroupCode?.trim() || null,
    }
  })
}

/** Backend-provided action eligibility so the frontend never guesses. */
export function allowedActions(
  po: PoWithLines,
  opts: {
    requireApprovalOnPo?: boolean
    requirePoReleaseWorkflow?: boolean
    backdatePolicy?: PoBackdatePolicy
  } = {},
): {
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
  canRevise: boolean
} {
  const received = totalReceived(po.lines)
  const editable = !po.deletedAt && PO_EDITABLE_STATUSES.includes(po.status)
  const pending = !po.deletedAt && po.status === 'PENDING_APPROVAL'
  const requireApproval = opts.requireApprovalOnPo !== false
  const requireRelease = opts.requirePoReleaseWorkflow !== false
  const backdatePolicy = opts.backdatePolicy ?? {}
  const backdateNeedsApproval = requiresBackdatedPoApproval(po.orderDate, backdatePolicy)
  const receivableStatuses = resolvePoReceivableStatuses(requireRelease)
  return {
    canEdit: editable,
    canSubmit: editable && (requireApproval || backdateNeedsApproval),
    canApprove: pending,
    canReject: pending,
    canSendBack: pending,
    canSendToVendor:
      requireRelease &&
      !po.deletedAt &&
      (requireApproval
        ? po.status === 'APPROVED'
        : PO_EDITABLE_STATUSES.includes(po.status)) &&
      !(backdateNeedsApproval && PO_EDITABLE_STATUSES.includes(po.status)),
    canCancel: pending || (!po.deletedAt && po.status === 'DRAFT'),
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
    canReceive: !po.deletedAt && receivableStatuses.includes(po.status),
    canRevise: !po.deletedAt && PO_REVISABLE_STATUSES.includes(po.status) && received === 0,
  }
}
