import { AppError, ConflictError, NotFoundError, ValidationError } from '../../../../../utils/errors.js'

export const CREDIT_NOTE_ALLOCATION_ERROR_CODES = {
  CREDIT_NOTE_ALLOCATION_AMOUNT_INVALID: 'CREDIT_NOTE_ALLOCATION_AMOUNT_INVALID',
  CREDIT_NOTE_ALLOCATION_EXCEEDS_CREDIT_NOTE: 'CREDIT_NOTE_ALLOCATION_EXCEEDS_CREDIT_NOTE',
  CREDIT_NOTE_ALLOCATION_EXCEEDS_INVOICE: 'CREDIT_NOTE_ALLOCATION_EXCEEDS_INVOICE',
  CREDIT_NOTE_ALLOCATION_CUSTOMER_MISMATCH: 'CREDIT_NOTE_ALLOCATION_CUSTOMER_MISMATCH',
  CREDIT_NOTE_ALLOCATION_CURRENCY_MISMATCH: 'CREDIT_NOTE_ALLOCATION_CURRENCY_MISMATCH',
  CREDIT_NOTE_ALLOCATION_OPEN_ITEM_INVALID: 'CREDIT_NOTE_ALLOCATION_OPEN_ITEM_INVALID',
  CREDIT_NOTE_ALLOCATION_DUPLICATE_OPEN_ITEM: 'CREDIT_NOTE_ALLOCATION_DUPLICATE_OPEN_ITEM',
  CREDIT_NOTE_ALLOCATION_FOREX_REQUIRED: 'CREDIT_NOTE_ALLOCATION_FOREX_REQUIRED',
  CREDIT_NOTE_ALLOCATION_PAYLOAD_MISMATCH: 'CREDIT_NOTE_ALLOCATION_PAYLOAD_MISMATCH',
  CREDIT_NOTE_ALLOCATION_CONCURRENT_CHANGE: 'CREDIT_NOTE_ALLOCATION_CONCURRENT_CHANGE',
  CREDIT_NOTE_ALLOCATION_NOTE_NOT_POSTED: 'CREDIT_NOTE_ALLOCATION_NOTE_NOT_POSTED',
  CREDIT_NOTE_ALLOCATION_CREDIT_MISSING: 'CREDIT_NOTE_ALLOCATION_CREDIT_MISSING',
  CREDIT_NOTE_ALLOCATION_IDEMPOTENCY_KEY_REQUIRED: 'CREDIT_NOTE_ALLOCATION_IDEMPOTENCY_KEY_REQUIRED',
  CREDIT_NOTE_ALLOCATION_PERIOD_CLOSED: 'CREDIT_NOTE_ALLOCATION_PERIOD_CLOSED',
  CREDIT_NOTE_ALLOCATION_PERIOD_UNDER_REVIEW: 'CREDIT_NOTE_ALLOCATION_PERIOD_UNDER_REVIEW',
  CREDIT_NOTE_ALLOCATION_LEGAL_ENTITY_MISMATCH: 'CREDIT_NOTE_ALLOCATION_LEGAL_ENTITY_MISMATCH',
  CREDIT_NOTE_ALLOCATION_IN_PROGRESS: 'CREDIT_NOTE_ALLOCATION_IN_PROGRESS',
  CREDIT_NOTE_ALLOCATION_NOT_ALLOWED: 'CREDIT_NOTE_ALLOCATION_NOT_ALLOWED',
  CREDIT_NOTE_ALLOCATION_FAILED: 'CREDIT_NOTE_ALLOCATION_FAILED',
  CREDIT_NOTE_ALLOCATION_BATCH_NOT_FOUND: 'CREDIT_NOTE_ALLOCATION_BATCH_NOT_FOUND',
  CREDIT_NOTE_ALLOCATION_BATCH_NOT_REVERSIBLE: 'CREDIT_NOTE_ALLOCATION_BATCH_NOT_REVERSIBLE',
} as const

export type CreditNoteAllocationErrorCode =
  (typeof CREDIT_NOTE_ALLOCATION_ERROR_CODES)[keyof typeof CREDIT_NOTE_ALLOCATION_ERROR_CODES]

export class CreditNoteAllocationError extends AppError {
  constructor(
    statusCode: number,
    message: string,
    code: CreditNoteAllocationErrorCode,
    errors?: Array<{ field: string; message: string }>,
  ) {
    super(statusCode, message, code, errors)
    this.name = 'CreditNoteAllocationError'
  }
}

export class CreditNoteAllocationValidationError extends CreditNoteAllocationError {
  constructor(message: string, code: CreditNoteAllocationErrorCode, errors?: Array<{ field: string; message: string }>) {
    super(422, message, code, errors)
    this.name = 'CreditNoteAllocationValidationError'
  }
}

export class CreditNoteAllocationCreditNoteNotFoundError extends NotFoundError {
  constructor() {
    super('Customer credit note not found')
    Object.defineProperty(this, 'code', { value: 'CUSTOMER_CREDIT_NOTE_NOT_FOUND' })
    this.name = 'CreditNoteAllocationCreditNoteNotFoundError'
  }
}

export class CreditNoteAllocationInvoiceNotFoundError extends NotFoundError {
  constructor(invoiceId?: string) {
    super(invoiceId ? `Sales invoice ${invoiceId} not found` : 'Sales invoice not found')
    Object.defineProperty(this, 'code', { value: 'SALES_INVOICE_NOT_FOUND' })
    this.name = 'CreditNoteAllocationInvoiceNotFoundError'
  }
}

export class CreditNoteAllocationIdempotencyKeyRequiredError extends ValidationError {
  constructor() {
    super('Idempotency-Key header is required', [
      { field: 'Idempotency-Key', message: 'Idempotency-Key header is required' },
    ])
    Object.defineProperty(this, 'code', {
      value: CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_IDEMPOTENCY_KEY_REQUIRED,
    })
    this.name = 'CreditNoteAllocationIdempotencyKeyRequiredError'
  }
}

export class CreditNoteAllocationPayloadMismatchError extends ConflictError {
  constructor() {
    super('Idempotency key was reused with a different allocation payload')
    Object.defineProperty(this, 'code', {
      value: CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_PAYLOAD_MISMATCH,
    })
    this.name = 'CreditNoteAllocationPayloadMismatchError'
  }
}

export class CreditNoteAllocationConcurrentChangeError extends ConflictError {
  constructor(message = 'Allocation balances changed concurrently. Refresh and retry.') {
    super(message)
    Object.defineProperty(this, 'code', {
      value: CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_CONCURRENT_CHANGE,
    })
    this.name = 'CreditNoteAllocationConcurrentChangeError'
  }
}

export class CreditNoteAllocationInProgressError extends ConflictError {
  constructor() {
    super('An allocation with this idempotency key is already in progress')
    Object.defineProperty(this, 'code', {
      value: CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_IN_PROGRESS,
    })
    this.name = 'CreditNoteAllocationInProgressError'
  }
}

export class CreditNoteAllocationNotAllowedError extends CreditNoteAllocationError {
  constructor(message = 'Missing permission: finance.ar.allocation.create') {
    super(403, message, CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_NOT_ALLOWED)
    this.name = 'CreditNoteAllocationNotAllowedError'
  }
}

export class CreditNoteAllocationFailedError extends CreditNoteAllocationError {
  constructor(message = 'Credit note allocation failed') {
    super(500, message, CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_FAILED)
    this.name = 'CreditNoteAllocationFailedError'
  }
}

export class CreditNoteAllocationDuplicateOpenItemError extends CreditNoteAllocationValidationError {
  constructor() {
    super(
      'Duplicate invoiceOpenItemId in allocation request',
      CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_DUPLICATE_OPEN_ITEM,
      [{ field: 'allocations', message: 'Duplicate invoiceOpenItemId is not allowed' }],
    )
    this.name = 'CreditNoteAllocationDuplicateOpenItemError'
  }
}

export class CreditNoteAllocationForexRequiredError extends CreditNoteAllocationValidationError {
  constructor() {
    super(
      'Exchange rates differ beyond tolerance; forex posting is required and not supported for allocation',
      CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_FOREX_REQUIRED,
    )
    this.name = 'CreditNoteAllocationForexRequiredError'
  }
}

export class CreditNoteAllocationBatchNotFoundError extends NotFoundError {
  constructor() {
    super('Credit note allocation batch not found')
    Object.defineProperty(this, 'code', {
      value: CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_BATCH_NOT_FOUND,
    })
    this.name = 'CreditNoteAllocationBatchNotFoundError'
  }
}

export class CreditNoteAllocationBatchNotReversibleError extends CreditNoteAllocationValidationError {
  constructor(message = 'Only POSTED allocation batches can be reversed') {
    super(message, CREDIT_NOTE_ALLOCATION_ERROR_CODES.CREDIT_NOTE_ALLOCATION_BATCH_NOT_REVERSIBLE)
    this.name = 'CreditNoteAllocationBatchNotReversibleError'
  }
}
