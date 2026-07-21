import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
export class PurchaseReturnNotFoundError extends NotFoundError {
  constructor() { super('Purchase return not found.'); Object.defineProperty(this, 'code', { value: 'PURCHASE_RETURN_NOT_FOUND' }) }
}
export class PurchaseReturnWorkflowError extends InvalidStateError {
  constructor(message: string) { super(message); Object.defineProperty(this, 'code', { value: 'PURCHASE_RETURN_INVALID_STATE' }) }
}
export class PurchaseReturnValidationError extends ValidationError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(message, errors ?? [{ field: 'body', message }])
    Object.defineProperty(this, 'code', { value: 'PURCHASE_RETURN_VALIDATION_FAILED' })
  }
}
