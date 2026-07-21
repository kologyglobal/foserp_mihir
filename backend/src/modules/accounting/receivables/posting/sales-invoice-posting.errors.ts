import { AppError, ConflictError } from '../../../../utils/errors.js'
import { PostingError } from '../../posting/posting.errors.js'
import { SalesInvoiceError } from '../sales-invoices/sales-invoice.errors.js'

export class SalesInvoicePostingError extends SalesInvoiceError {
  constructor(statusCode: number, message: string, code: string, errors?: Array<{ field: string; message: string }>) {
    super(statusCode, message, code, errors)
    this.name = 'SalesInvoicePostingError'
  }
}

export class SalesInvoiceAlreadyPostedError extends SalesInvoicePostingError {
  constructor() {
    super(422, 'Sales invoice is already posted', 'SALES_INVOICE_ALREADY_POSTED')
    this.name = 'SalesInvoiceAlreadyPostedError'
  }
}

export class SalesInvoiceChangedAfterReadyError extends SalesInvoicePostingError {
  constructor() {
    super(
      422,
      'Invoice amounts changed since it was marked ready. Re-validate and mark ready before posting.',
      'SALES_INVOICE_CHANGED_AFTER_READY',
    )
    this.name = 'SalesInvoiceChangedAfterReadyError'
  }
}

export class SalesInvoicePostingValidationFailedError extends SalesInvoicePostingError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'SALES_INVOICE_POSTING_VALIDATION_FAILED', errors)
    this.name = 'SalesInvoicePostingValidationFailedError'
  }
}

export class SalesInvoicePostingPeriodClosedError extends SalesInvoicePostingError {
  constructor(message = 'Accounting period is closed for posting') {
    super(422, message, 'SALES_INVOICE_POSTING_PERIOD_CLOSED')
    this.name = 'SalesInvoicePostingPeriodClosedError'
  }
}

export class SalesInvoicePostingPeriodUnderReviewError extends SalesInvoicePostingError {
  constructor(message = 'Accounting period is under review and cannot accept postings') {
    super(422, message, 'SALES_INVOICE_POSTING_PERIOD_UNDER_REVIEW')
    this.name = 'SalesInvoicePostingPeriodUnderReviewError'
  }
}

export class SalesInvoicePostingAccountNotReadyError extends SalesInvoicePostingError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'SALES_INVOICE_ACCOUNT_NOT_READY', errors)
    this.name = 'SalesInvoicePostingAccountNotReadyError'
  }
}

export class SalesInvoiceNumberSeriesNotConfiguredError extends SalesInvoicePostingError {
  constructor() {
    super(422, 'Sales invoice number series is not configured', 'SALES_INVOICE_NUMBER_SERIES_NOT_CONFIGURED')
    this.name = 'SalesInvoiceNumberSeriesNotConfiguredError'
  }
}

export class SalesInvoiceConcurrentPostError extends ConflictError {
  constructor() {
    super('Another user posted this invoice concurrently. Refresh and retry if needed.')
    Object.defineProperty(this, 'code', { value: 'SALES_INVOICE_CONCURRENT_POST' })
    this.name = 'SalesInvoiceConcurrentPostError'
  }
}

export class SalesInvoicePostingFailedError extends SalesInvoicePostingError {
  constructor(message: string) {
    super(500, message, 'SALES_INVOICE_POSTING_FAILED')
    this.name = 'SalesInvoicePostingFailedError'
  }
}

export class SalesInvoicePostingNotAllowedError extends SalesInvoicePostingError {
  constructor(message = 'Missing permission: finance.ar.invoice.post') {
    super(403, message, 'SALES_INVOICE_POSTING_NOT_ALLOWED')
    this.name = 'SalesInvoicePostingNotAllowedError'
  }
}

export class SalesInvoiceReversalNotAllowedError extends SalesInvoicePostingError {
  constructor(message = 'Missing permission: finance.ar.invoice.reverse') {
    super(403, message, 'SALES_INVOICE_REVERSAL_NOT_ALLOWED')
    this.name = 'SalesInvoiceReversalNotAllowedError'
  }
}

export class SalesInvoiceNotPostedForReversalError extends SalesInvoicePostingError {
  constructor(message = 'Only POSTED sales invoices can be reversed') {
    super(422, message, 'SALES_INVOICE_NOT_POSTED_FOR_REVERSAL')
    this.name = 'SalesInvoiceNotPostedForReversalError'
  }
}

export class SalesInvoiceAllocationsMustBeReversedError extends SalesInvoicePostingError {
  constructor(
    message = 'All posted receipt and credit-note allocations must be reversed before reversing the invoice',
  ) {
    super(422, message, 'SALES_INVOICE_ALLOCATIONS_MUST_BE_REVERSED')
    this.name = 'SalesInvoiceAllocationsMustBeReversedError'
  }
}

export class SalesInvoiceReversalDebitNotClearError extends SalesInvoicePostingError {
  constructor(message = 'Invoice debit open item must be fully unallocated before reversal') {
    super(422, message, 'SALES_INVOICE_REVERSAL_DEBIT_NOT_CLEAR')
    this.name = 'SalesInvoiceReversalDebitNotClearError'
  }
}

export class SalesInvoiceReversalEligibilityError extends SalesInvoicePostingError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'SALES_INVOICE_REVERSAL_ELIGIBILITY', errors)
    this.name = 'SalesInvoiceReversalEligibilityError'
  }
}

export function mapPostingErrorToSalesInvoiceError(error: unknown): never {
  if (error instanceof SalesInvoicePostingError || error instanceof SalesInvoiceConcurrentPostError) {
    throw error
  }
  if (error instanceof PostingError) {
    if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
      throw new SalesInvoicePostingPeriodClosedError(error.message)
    }
    if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
      throw new SalesInvoicePostingPeriodUnderReviewError(error.message)
    }
    if (error.code === 'NUMBER_SERIES_NOT_CONFIGURED' || error.code === 'NUMBER_SERIES_INACTIVE') {
      throw new SalesInvoiceNumberSeriesNotConfiguredError()
    }
    if (error.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH') {
      throw new SalesInvoiceChangedAfterReadyError()
    }
    if (error.code === 'POSTING_EVENT_IN_PROGRESS' || error.code === 'POSTING_CONCURRENT_ACTION') {
      throw new SalesInvoiceConcurrentPostError()
    }
    throw new SalesInvoicePostingFailedError(error.message)
  }
  if (error instanceof AppError) throw error
  throw new SalesInvoicePostingFailedError(error instanceof Error ? error.message : 'Sales invoice posting failed')
}
