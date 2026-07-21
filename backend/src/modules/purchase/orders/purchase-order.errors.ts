import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'

export class PurchaseOrderNotFoundError extends NotFoundError {
  constructor(message = purchaseMessage(PURCHASE_ERROR_CODE.PO_NOT_FOUND)) {
    super(message)
    Object.defineProperty(this, 'code', { value: PURCHASE_ERROR_CODE.PO_NOT_FOUND })
    this.name = 'PurchaseOrderNotFoundError'
  }
}

/** Invalid lifecycle transition or state guard failure (422). */
export class PurchaseOrderWorkflowError extends InvalidStateError {
  constructor(message: string, code: string = PURCHASE_ERROR_CODE.PO_INVALID_STATUS) {
    super(message)
    Object.defineProperty(this, 'code', { value: code })
    this.name = 'PurchaseOrderWorkflowError'
  }
}

/** Field-level validation failure with stable business code. */
export class PurchaseOrderValidationError extends ValidationError {
  constructor(
    message: string,
    code: string = PURCHASE_ERROR_CODE.PO_VALIDATION_FAILED,
    errors?: Array<{ field: string; message: string }>,
  ) {
    super(message, errors ?? [{ field: 'body', message }])
    Object.defineProperty(this, 'code', { value: code })
    this.name = 'PurchaseOrderValidationError'
  }
}
