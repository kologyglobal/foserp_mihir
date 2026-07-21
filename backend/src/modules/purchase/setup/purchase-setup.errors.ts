import { ConflictError, ValidationError } from '../../../utils/errors.js'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'

export class PurchaseSetupValidationError extends ValidationError {
  constructor(
    message: string,
    code: string = PURCHASE_ERROR_CODE.SETUP_VALIDATION_FAILED,
    errors?: Array<{ field: string; message: string }>,
  ) {
    super(message, errors ?? [{ field: 'body', message }])
    Object.defineProperty(this, 'code', { value: code })
    this.name = 'PurchaseSetupValidationError'
  }
}

export class PurchaseSetupVersionConflictError extends ConflictError {
  constructor(message = purchaseMessage(PURCHASE_ERROR_CODE.SETUP_VERSION_CONFLICT)) {
    super(message)
    Object.defineProperty(this, 'code', { value: PURCHASE_ERROR_CODE.SETUP_VERSION_CONFLICT })
    this.name = 'PurchaseSetupVersionConflictError'
  }
}
