import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'

export class PurchaseInvoiceNotFoundError extends NotFoundError {
  constructor(message = 'Purchase invoice not found.') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'PURCHASE_INVOICE_NOT_FOUND' })
  }
}

export class PurchaseInvoiceWorkflowError extends InvalidStateError {
  constructor(message: string, code = 'PURCHASE_INVOICE_INVALID_STATE') {
    super(message)
    Object.defineProperty(this, 'code', { value: code })
  }
}

export class PurchaseInvoiceValidationError extends ValidationError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(message, errors ?? [{ field: 'body', message }])
    Object.defineProperty(this, 'code', { value: 'PURCHASE_INVOICE_VALIDATION_FAILED' })
  }
}
