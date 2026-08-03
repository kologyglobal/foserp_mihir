import { AppError, ConflictError, NotFoundError, ValidationError } from '../../../../utils/errors.js'

export class RecurringInvoiceError extends AppError {
  constructor(statusCode: number, message: string, code: string, errors?: Array<{ field: string; message: string }>) {
    super(statusCode, message, code, errors)
    this.name = 'RecurringInvoiceError'
  }
}

export class RecurringInvoiceScheduleNotFoundError extends NotFoundError {
  constructor() {
    super('Recurring invoice schedule not found')
    Object.defineProperty(this, 'code', { value: 'RECURRING_INVOICE_SCHEDULE_NOT_FOUND' })
  }
}

export class RecurringInvoiceExecutionNotFoundError extends NotFoundError {
  constructor() {
    super('Upcoming recurring invoice not found')
    Object.defineProperty(this, 'code', { value: 'RECURRING_INVOICE_EXECUTION_NOT_FOUND' })
  }
}

export class RecurringInvoiceScheduleNotActiveError extends RecurringInvoiceError {
  constructor() {
    super(422, 'This recurring invoice schedule is not active', 'RECURRING_INVOICE_SCHEDULE_NOT_ACTIVE')
    this.name = 'RecurringInvoiceScheduleNotActiveError'
  }
}

export class RecurringInvoiceExecutionNotScheduledError extends RecurringInvoiceError {
  constructor() {
    super(422, 'This upcoming invoice has already been approved or cancelled', 'RECURRING_INVOICE_EXECUTION_NOT_SCHEDULED')
    this.name = 'RecurringInvoiceExecutionNotScheduledError'
  }
}

export { ValidationError, NotFoundError, ConflictError }
