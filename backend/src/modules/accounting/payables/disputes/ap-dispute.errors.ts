import { InvalidStateError, NotFoundError, ValidationError } from '../../../../utils/errors.js'

export class ApDisputeNotFoundError extends NotFoundError {
  constructor() {
    super('AP dispute not found')
    Object.defineProperty(this, 'code', { value: 'AP_DISPUTE_NOT_FOUND' })
  }
}

export class ApDisputeInvoiceNotFoundError extends NotFoundError {
  constructor() {
    super('Vendor invoice not found')
    Object.defineProperty(this, 'code', { value: 'AP_DISPUTE_INVOICE_NOT_FOUND' })
  }
}

export class ApDisputeOpenItemRequiredError extends ValidationError {
  constructor(message = 'Posted vendor invoice must have a payable open item to dispute') {
    super(message, [{ field: 'vendorInvoiceId', message }])
    Object.defineProperty(this, 'code', { value: 'AP_DISPUTE_OPEN_ITEM_REQUIRED' })
    this.name = 'ApDisputeOpenItemRequiredError'
  }
}

export class ApDisputeTerminalError extends InvalidStateError {
  constructor(message = 'Terminal disputes cannot be edited — transition status instead') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'AP_DISPUTE_TERMINAL' })
    this.name = 'ApDisputeTerminalError'
  }
}

export class ApDisputeAmountInvalidError extends ValidationError {
  constructor(message = 'Disputed amount must be greater than zero') {
    super(message, [{ field: 'disputedAmount', message }])
    Object.defineProperty(this, 'code', { value: 'AP_DISPUTE_AMOUNT_INVALID' })
    this.name = 'ApDisputeAmountInvalidError'
  }
}
