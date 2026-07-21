import { InvalidStateError, NotFoundError } from '../../../utils/errors.js'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'

export class PurchaseApprovalNotFoundError extends NotFoundError {
  constructor(message = purchaseMessage(PURCHASE_ERROR_CODE.APPROVAL_NOT_FOUND)) {
    super(message)
    Object.defineProperty(this, 'code', { value: PURCHASE_ERROR_CODE.APPROVAL_NOT_FOUND })
    this.name = 'PurchaseApprovalNotFoundError'
  }
}

export class PurchaseApprovalActionError extends InvalidStateError {
  constructor(code: string, message = purchaseMessage(code)) {
    super(message)
    Object.defineProperty(this, 'code', { value: code })
    this.name = 'PurchaseApprovalActionError'
  }
}
