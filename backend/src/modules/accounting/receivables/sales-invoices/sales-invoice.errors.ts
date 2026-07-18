import { AppError, ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../../utils/errors.js'

export class SalesInvoiceError extends AppError {
  constructor(statusCode: number, message: string, code: string, errors?: Array<{ field: string; message: string }>) {
    super(statusCode, message, code, errors)
    this.name = 'SalesInvoiceError'
  }
}

export class SalesInvoiceNotFoundError extends NotFoundError {
  constructor() {
    super('Sales invoice not found')
    Object.defineProperty(this, 'code', { value: 'SALES_INVOICE_NOT_FOUND' })
  }
}

export class SalesInvoiceNotEditableError extends SalesInvoiceError {
  constructor(message = 'Sales invoice is not editable in its current status') {
    super(422, message, 'SALES_INVOICE_NOT_EDITABLE')
    this.name = 'SalesInvoiceNotEditableError'
  }
}

export class SalesInvoiceAlreadyCancelledError extends SalesInvoiceError {
  constructor() {
    super(422, 'Sales invoice is already cancelled', 'SALES_INVOICE_ALREADY_CANCELLED')
    this.name = 'SalesInvoiceAlreadyCancelledError'
  }
}

export class SalesInvoiceInvalidStatusError extends InvalidStateError {
  constructor(message = 'Invalid sales invoice status for this operation') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'SALES_INVOICE_INVALID_STATUS' })
    this.name = 'SalesInvoiceInvalidStatusError'
  }
}

export class SalesInvoiceStaleUpdateError extends ConflictError {
  constructor() {
    super('This invoice was changed by another user. Refresh it before saving your changes.')
    Object.defineProperty(this, 'code', { value: 'SALES_INVOICE_STALE_UPDATE' })
    this.name = 'SalesInvoiceStaleUpdateError'
  }
}

export class SalesInvoiceLinesRequiredError extends ValidationError {
  constructor() {
    super('At least one invoice line is required', [{ field: 'lines', message: 'At least one line is required' }])
    Object.defineProperty(this, 'code', { value: 'SALES_INVOICE_LINES_REQUIRED' })
    this.name = 'SalesInvoiceLinesRequiredError'
  }
}

export class SalesInvoiceDraftCalculationFailedError extends SalesInvoiceError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'SALES_INVOICE_DRAFT_CALCULATION_FAILED', errors)
    this.name = 'SalesInvoiceDraftCalculationFailedError'
  }
}

export class SalesInvoiceValidationFailedError extends SalesInvoiceError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'SALES_INVOICE_VALIDATION_FAILED', errors)
    this.name = 'SalesInvoiceValidationFailedError'
  }
}

export class SalesInvoiceNotReadyError extends SalesInvoiceError {
  constructor(message = 'Sales invoice is not ready to post') {
    super(422, message, 'SALES_INVOICE_NOT_READY')
    this.name = 'SalesInvoiceNotReadyError'
  }
}

export class SalesInvoiceCancellationReasonRequiredError extends ValidationError {
  constructor() {
    super('Cancellation reason is required', [{ field: 'cancellationReason', message: 'Required' }])
    Object.defineProperty(this, 'code', { value: 'SALES_INVOICE_CANCELLATION_REASON_REQUIRED' })
    this.name = 'SalesInvoiceCancellationReasonRequiredError'
  }
}

export class SalesOrderNotFoundError extends SalesInvoiceError {
  constructor(id?: string) {
    super(404, id ? `Sales order not found: ${id}` : 'Sales order not found', 'SALES_ORDER_NOT_FOUND')
    this.name = 'SalesOrderNotFoundError'
  }
}

export class SalesOrderCancelledError extends SalesInvoiceError {
  constructor() {
    super(422, 'Cannot invoice a cancelled sales order', 'SALES_ORDER_CANCELLED')
    this.name = 'SalesOrderCancelledError'
  }
}

export class SalesOrderCustomerMismatchError extends SalesInvoiceError {
  constructor() {
    super(422, 'Customer does not match the linked sales order', 'SALES_ORDER_CUSTOMER_MISMATCH')
    this.name = 'SalesOrderCustomerMismatchError'
  }
}

export { ValidationError, NotFoundError, InvalidStateError, ConflictError }
