import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'
import { PurchaseOrderValidationError } from './purchase-order.errors.js'

export type PoBackdatePolicy = {
  allowBackdatedPo?: boolean
  backdatedPoDaysLimit?: number
  requireApprovalForBackdatedPo?: boolean
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}

export function toPoBackdatePolicy(settings: {
  allowBackdatedPo?: boolean
  backdatedPoDaysLimit?: number
  requireApprovalForBackdatedPo?: boolean
}): PoBackdatePolicy {
  return {
    allowBackdatedPo: Boolean(settings.allowBackdatedPo),
    backdatedPoDaysLimit: Number(settings.backdatedPoDaysLimit ?? 0),
    requireApprovalForBackdatedPo: settings.requireApprovalForBackdatedPo !== false,
  }
}

export function isPoOrderDateBackdated(orderDate: Date): boolean {
  const today = startOfUtcDay(new Date())
  return startOfUtcDay(orderDate) < today
}

export function assertPoOrderDateAllowed(orderDate: Date, policy: PoBackdatePolicy): void {
  if (!isPoOrderDateBackdated(orderDate)) return
  if (!policy.allowBackdatedPo) {
    throw new PurchaseOrderValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_BACKDATE_NOT_ALLOWED),
      PURCHASE_ERROR_CODE.PO_BACKDATE_NOT_ALLOWED,
      [{ field: 'orderDate', message: purchaseMessage(PURCHASE_ERROR_CODE.PO_BACKDATE_NOT_ALLOWED) }],
    )
  }
  const limitDays = policy.backdatedPoDaysLimit ?? 0
  if (limitDays >= 0) {
    const today = startOfUtcDay(new Date())
    const earliest = new Date(today)
    earliest.setUTCDate(earliest.getUTCDate() - limitDays)
    if (startOfUtcDay(orderDate) < startOfUtcDay(earliest)) {
      throw new PurchaseOrderValidationError(
        purchaseMessage(PURCHASE_ERROR_CODE.PO_BACKDATE_EXCEEDS_LIMIT),
        PURCHASE_ERROR_CODE.PO_BACKDATE_EXCEEDS_LIMIT,
        [{ field: 'orderDate', message: purchaseMessage(PURCHASE_ERROR_CODE.PO_BACKDATE_EXCEEDS_LIMIT) }],
      )
    }
  }
}

export function requiresBackdatedPoApproval(orderDate: Date, policy: PoBackdatePolicy): boolean {
  if (!isPoOrderDateBackdated(orderDate)) return false
  return policy.requireApprovalForBackdatedPo !== false
}

export function assertBackdatedPoReleasedThroughApproval(
  orderDate: Date,
  status: string,
  policy: PoBackdatePolicy,
): void {
  if (!requiresBackdatedPoApproval(orderDate, policy)) return
  if (status === 'DRAFT' || status === 'SENT_BACK') {
    throw new PurchaseOrderValidationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_BACKDATE_APPROVAL_REQUIRED),
      PURCHASE_ERROR_CODE.PO_BACKDATE_APPROVAL_REQUIRED,
      [{ field: 'orderDate', message: purchaseMessage(PURCHASE_ERROR_CODE.PO_BACKDATE_APPROVAL_REQUIRED) }],
    )
  }
}
