import { AppError, ConflictError } from '../../../../../utils/errors.js'
import { PostingError } from '../../../posting/posting.errors.js'
import { CustomerReceiptError } from '../customer-receipt.errors.js'

export class CustomerReceiptPostingError extends CustomerReceiptError {
  constructor(statusCode: number, message: string, code: string, errors?: Array<{ field: string; message: string }>) {
    super(statusCode, message, code, errors)
    this.name = 'CustomerReceiptPostingError'
  }
}

export class CustomerReceiptAlreadyPostedError extends CustomerReceiptPostingError {
  constructor() {
    super(422, 'Customer receipt is already posted', 'CUSTOMER_RECEIPT_ALREADY_POSTED')
    this.name = 'CustomerReceiptAlreadyPostedError'
  }
}

export class CustomerReceiptChangedAfterReadyError extends CustomerReceiptPostingError {
  constructor() {
    super(
      422,
      'Receipt amounts changed since it was marked ready. Re-validate and mark ready before posting.',
      'CUSTOMER_RECEIPT_CHANGED_AFTER_READY',
    )
    this.name = 'CustomerReceiptChangedAfterReadyError'
  }
}

export class CustomerReceiptPostingValidationFailedError extends CustomerReceiptPostingError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'CUSTOMER_RECEIPT_POSTING_VALIDATION_FAILED', errors)
    this.name = 'CustomerReceiptPostingValidationFailedError'
  }
}

export class CustomerReceiptPostingPeriodClosedError extends CustomerReceiptPostingError {
  constructor(message = 'Accounting period is closed for posting') {
    super(422, message, 'CUSTOMER_RECEIPT_POSTING_PERIOD_CLOSED')
    this.name = 'CustomerReceiptPostingPeriodClosedError'
  }
}

export class CustomerReceiptPostingPeriodUnderReviewError extends CustomerReceiptPostingError {
  constructor(message = 'Accounting period is under review and cannot accept postings') {
    super(422, message, 'CUSTOMER_RECEIPT_POSTING_PERIOD_UNDER_REVIEW')
    this.name = 'CustomerReceiptPostingPeriodUnderReviewError'
  }
}

export class CustomerReceiptPostingAccountNotReadyError extends CustomerReceiptPostingError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'CUSTOMER_RECEIPT_ACCOUNT_NOT_READY', errors)
    this.name = 'CustomerReceiptPostingAccountNotReadyError'
  }
}

export class CustomerReceiptNumberSeriesNotConfiguredError extends CustomerReceiptPostingError {
  constructor() {
    super(422, 'Customer receipt number series is not configured', 'CUSTOMER_RECEIPT_NUMBER_SERIES_NOT_CONFIGURED')
    this.name = 'CustomerReceiptNumberSeriesNotConfiguredError'
  }
}

export class CustomerReceiptConcurrentPostError extends ConflictError {
  constructor() {
    super('Another user posted this receipt concurrently. Refresh and retry if needed.')
    Object.defineProperty(this, 'code', { value: 'CUSTOMER_RECEIPT_CONCURRENT_POST' })
    this.name = 'CustomerReceiptConcurrentPostError'
  }
}

export class CustomerReceiptPostingFailedError extends CustomerReceiptPostingError {
  constructor(message: string) {
    super(500, message, 'CUSTOMER_RECEIPT_POSTING_FAILED')
    this.name = 'CustomerReceiptPostingFailedError'
  }
}

export class CustomerReceiptPostingNotAllowedError extends CustomerReceiptPostingError {
  constructor(message = 'Missing permission: finance.ar.receipt.post') {
    super(403, message, 'CUSTOMER_RECEIPT_POSTING_NOT_ALLOWED')
    this.name = 'CustomerReceiptPostingNotAllowedError'
  }
}

export function mapPostingErrorToCustomerReceiptError(error: unknown): never {
  if (error instanceof CustomerReceiptPostingError || error instanceof CustomerReceiptConcurrentPostError) {
    throw error
  }
  if (error instanceof PostingError) {
    if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
      throw new CustomerReceiptPostingPeriodClosedError(error.message)
    }
    if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
      throw new CustomerReceiptPostingPeriodUnderReviewError(error.message)
    }
    if (error.code === 'NUMBER_SERIES_NOT_CONFIGURED' || error.code === 'NUMBER_SERIES_INACTIVE') {
      throw new CustomerReceiptNumberSeriesNotConfiguredError()
    }
    if (error.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH') {
      throw new CustomerReceiptChangedAfterReadyError()
    }
    if (error.code === 'POSTING_EVENT_IN_PROGRESS' || error.code === 'POSTING_CONCURRENT_ACTION') {
      throw new CustomerReceiptConcurrentPostError()
    }
    throw new CustomerReceiptPostingFailedError(error.message)
  }
  if (error instanceof AppError) throw error
  throw new CustomerReceiptPostingFailedError(error instanceof Error ? error.message : 'Customer receipt posting failed')
}
