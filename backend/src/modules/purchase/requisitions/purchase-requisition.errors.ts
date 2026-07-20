import { AppError, ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import {
  PURCHASE_ERROR_CODE,
  purchaseMessage,
} from '../shared/purchase-error-catalog.js'

export class PurchaseRequisitionNotFoundError extends NotFoundError {
  constructor(message = purchaseMessage(PURCHASE_ERROR_CODE.PR_NOT_FOUND)) {
    super(message)
    Object.defineProperty(this, 'code', { value: PURCHASE_ERROR_CODE.PR_NOT_FOUND })
    this.name = 'PurchaseRequisitionNotFoundError'
  }
}

export class PurchaseRequisitionNotEditableError extends InvalidStateError {
  constructor(
    message = purchaseMessage(PURCHASE_ERROR_CODE.PR_NOT_EDITABLE),
    code: string = PURCHASE_ERROR_CODE.PR_NOT_EDITABLE,
  ) {
    super(message)
    Object.defineProperty(this, 'code', { value: code })
    this.name = 'PurchaseRequisitionNotEditableError'
  }
}

export class PurchaseRequisitionNotSubmittableError extends InvalidStateError {
  constructor(
    message = purchaseMessage(PURCHASE_ERROR_CODE.PR_NOT_SUBMITTABLE),
    code: string = PURCHASE_ERROR_CODE.PR_NOT_SUBMITTABLE,
  ) {
    super(message)
    Object.defineProperty(this, 'code', { value: code })
    this.name = 'PurchaseRequisitionNotSubmittableError'
  }
}

export class PurchaseRequisitionNotApprovableError extends InvalidStateError {
  constructor(message = purchaseMessage(PURCHASE_ERROR_CODE.PR_NOT_APPROVABLE)) {
    super(message)
    Object.defineProperty(this, 'code', { value: PURCHASE_ERROR_CODE.PR_NOT_APPROVABLE })
    this.name = 'PurchaseRequisitionNotApprovableError'
  }
}

export class RejectionReasonRequiredError extends ValidationError {
  constructor(message = purchaseMessage(PURCHASE_ERROR_CODE.PR_REJECTION_REASON_REQUIRED)) {
    super(message, [{ field: 'reason', message }])
    Object.defineProperty(this, 'code', { value: PURCHASE_ERROR_CODE.PR_REJECTION_REASON_REQUIRED })
    this.name = 'RejectionReasonRequiredError'
  }
}

export class InvalidPurchaseQuantityError extends ValidationError {
  constructor(
    message = purchaseMessage(PURCHASE_ERROR_CODE.PR_QTY_INVALID),
    field = 'requiredQuantity',
  ) {
    super(message, [{ field, message }])
    Object.defineProperty(this, 'code', { value: PURCHASE_ERROR_CODE.PR_QTY_INVALID })
    this.name = 'InvalidPurchaseQuantityError'
  }
}

export class PurchaseRequisitionValidationError extends ValidationError {
  constructor(
    message: string,
    code: string = PURCHASE_ERROR_CODE.PR_VALIDATION_FAILED,
    errors?: Array<{ field: string; message: string }>,
  ) {
    super(message, errors ?? [{ field: 'body', message }])
    Object.defineProperty(this, 'code', { value: code })
    this.name = 'PurchaseRequisitionValidationError'
  }
}

/** Domain helper when a custom AppError with a purchase code is needed. */
export class PurchaseRequisitionError extends AppError {
  constructor(statusCode: number, message: string, code: string) {
    super(statusCode, message, code)
    this.name = 'PurchaseRequisitionError'
  }
}

// Re-export Conflict for RFQ-flag style conflicts if needed by callers
export { ConflictError }
