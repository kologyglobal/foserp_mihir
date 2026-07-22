import { AppError, InvalidStateError, NotFoundError, ValidationError } from '../../../../utils/errors.js'

export class ArDisputeError extends AppError {
  constructor(statusCode: number, message: string, code: string, errors?: Array<{ field: string; message: string }>) {
    super(statusCode, message, code, errors)
    this.name = 'ArDisputeError'
  }
}

export class ArDisputeNotFoundError extends NotFoundError {
  constructor() {
    super('AR dispute not found')
    Object.defineProperty(this, 'code', { value: 'AR_DISPUTE_NOT_FOUND' })
  }
}

export class ArDisputeInvoiceNotFoundError extends NotFoundError {
  constructor() {
    super('Sales invoice not found')
    Object.defineProperty(this, 'code', { value: 'AR_DISPUTE_INVOICE_NOT_FOUND' })
  }
}

export class ArDisputeOpenItemRequiredError extends ValidationError {
  constructor(message = 'Posted invoice must have an open receivable item to dispute') {
    super(message, [{ field: 'salesInvoiceId', message }])
    Object.defineProperty(this, 'code', { value: 'AR_DISPUTE_OPEN_ITEM_REQUIRED' })
    this.name = 'ArDisputeOpenItemRequiredError'
  }
}

export class ArDisputeTerminalError extends InvalidStateError {
  constructor(message = 'Terminal disputes cannot be edited — transition status instead') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'AR_DISPUTE_TERMINAL' })
    this.name = 'ArDisputeTerminalError'
  }
}

export class ArDisputeAmountInvalidError extends ValidationError {
  constructor(message = 'Disputed amount must be greater than zero') {
    super(message, [{ field: 'disputedAmount', message }])
    Object.defineProperty(this, 'code', { value: 'AR_DISPUTE_AMOUNT_INVALID' })
    this.name = 'ArDisputeAmountInvalidError'
  }
}
