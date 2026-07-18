import { AppError, ConflictError, NotFoundError, ValidationError } from '../../../../utils/errors.js'

export const RECEIPT_ALLOCATION_ERROR_CODES = {
  RECEIPT_ALLOCATION_AMOUNT_INVALID: 'RECEIPT_ALLOCATION_AMOUNT_INVALID',
  RECEIPT_ALLOCATION_EXCEEDS_RECEIPT: 'RECEIPT_ALLOCATION_EXCEEDS_RECEIPT',
  RECEIPT_ALLOCATION_EXCEEDS_INVOICE: 'RECEIPT_ALLOCATION_EXCEEDS_INVOICE',
  RECEIPT_ALLOCATION_CUSTOMER_MISMATCH: 'RECEIPT_ALLOCATION_CUSTOMER_MISMATCH',
  RECEIPT_ALLOCATION_CURRENCY_MISMATCH: 'RECEIPT_ALLOCATION_CURRENCY_MISMATCH',
  RECEIPT_ALLOCATION_OPEN_ITEM_INVALID: 'RECEIPT_ALLOCATION_OPEN_ITEM_INVALID',
  RECEIPT_ALLOCATION_DUPLICATE_OPEN_ITEM: 'RECEIPT_ALLOCATION_DUPLICATE_OPEN_ITEM',
  RECEIPT_ALLOCATION_FOREX_REQUIRED: 'RECEIPT_ALLOCATION_FOREX_REQUIRED',
  RECEIPT_ALLOCATION_PAYLOAD_MISMATCH: 'RECEIPT_ALLOCATION_PAYLOAD_MISMATCH',
  RECEIPT_ALLOCATION_CONCURRENT_CHANGE: 'RECEIPT_ALLOCATION_CONCURRENT_CHANGE',
  RECEIPT_ALLOCATION_RECEIPT_NOT_POSTED: 'RECEIPT_ALLOCATION_RECEIPT_NOT_POSTED',
  RECEIPT_ALLOCATION_CREDIT_MISSING: 'RECEIPT_ALLOCATION_CREDIT_MISSING',
  RECEIPT_ALLOCATION_IDEMPOTENCY_KEY_REQUIRED: 'RECEIPT_ALLOCATION_IDEMPOTENCY_KEY_REQUIRED',
  RECEIPT_ALLOCATION_PERIOD_CLOSED: 'RECEIPT_ALLOCATION_PERIOD_CLOSED',
  RECEIPT_ALLOCATION_PERIOD_UNDER_REVIEW: 'RECEIPT_ALLOCATION_PERIOD_UNDER_REVIEW',
  RECEIPT_ALLOCATION_LEGAL_ENTITY_MISMATCH: 'RECEIPT_ALLOCATION_LEGAL_ENTITY_MISMATCH',
  RECEIPT_ALLOCATION_IN_PROGRESS: 'RECEIPT_ALLOCATION_IN_PROGRESS',
  RECEIPT_ALLOCATION_NOT_ALLOWED: 'RECEIPT_ALLOCATION_NOT_ALLOWED',
  RECEIPT_ALLOCATION_FAILED: 'RECEIPT_ALLOCATION_FAILED',
} as const

export type ReceiptAllocationErrorCode =
  (typeof RECEIPT_ALLOCATION_ERROR_CODES)[keyof typeof RECEIPT_ALLOCATION_ERROR_CODES]

export class ReceiptAllocationError extends AppError {
  constructor(
    statusCode: number,
    message: string,
    code: ReceiptAllocationErrorCode,
    errors?: Array<{ field: string; message: string }>,
  ) {
    super(statusCode, message, code, errors)
    this.name = 'ReceiptAllocationError'
  }
}

export class ReceiptAllocationValidationError extends ReceiptAllocationError {
  constructor(message: string, code: ReceiptAllocationErrorCode, errors?: Array<{ field: string; message: string }>) {
    super(422, message, code, errors)
    this.name = 'ReceiptAllocationValidationError'
  }
}

export class ReceiptAllocationReceiptNotFoundError extends NotFoundError {
  constructor() {
    super('Customer receipt not found')
    Object.defineProperty(this, 'code', { value: 'CUSTOMER_RECEIPT_NOT_FOUND' })
    this.name = 'ReceiptAllocationReceiptNotFoundError'
  }
}

export class ReceiptAllocationInvoiceNotFoundError extends NotFoundError {
  constructor(invoiceId?: string) {
    super(invoiceId ? `Sales invoice ${invoiceId} not found` : 'Sales invoice not found')
    Object.defineProperty(this, 'code', { value: 'SALES_INVOICE_NOT_FOUND' })
    this.name = 'ReceiptAllocationInvoiceNotFoundError'
  }
}

export class ReceiptAllocationIdempotencyKeyRequiredError extends ValidationError {
  constructor() {
    super('Idempotency-Key header is required', [
      { field: 'Idempotency-Key', message: 'Idempotency-Key header is required' },
    ])
    Object.defineProperty(this, 'code', {
      value: RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_IDEMPOTENCY_KEY_REQUIRED,
    })
    this.name = 'ReceiptAllocationIdempotencyKeyRequiredError'
  }
}

export class ReceiptAllocationPayloadMismatchError extends ConflictError {
  constructor() {
    super('Idempotency key was reused with a different allocation payload')
    Object.defineProperty(this, 'code', {
      value: RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_PAYLOAD_MISMATCH,
    })
    this.name = 'ReceiptAllocationPayloadMismatchError'
  }
}

export class ReceiptAllocationConcurrentChangeError extends ConflictError {
  constructor(message = 'Allocation balances changed concurrently. Refresh and retry.') {
    super(message)
    Object.defineProperty(this, 'code', {
      value: RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_CONCURRENT_CHANGE,
    })
    this.name = 'ReceiptAllocationConcurrentChangeError'
  }
}

export class ReceiptAllocationInProgressError extends ConflictError {
  constructor() {
    super('An allocation with this idempotency key is already in progress')
    Object.defineProperty(this, 'code', {
      value: RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_IN_PROGRESS,
    })
    this.name = 'ReceiptAllocationInProgressError'
  }
}

export class ReceiptAllocationNotAllowedError extends ReceiptAllocationError {
  constructor(message = 'Missing permission: finance.ar.allocation.create') {
    super(403, message, RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_NOT_ALLOWED)
    this.name = 'ReceiptAllocationNotAllowedError'
  }
}

export class ReceiptAllocationFailedError extends ReceiptAllocationError {
  constructor(message = 'Receipt allocation failed') {
    super(500, message, RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_FAILED)
    this.name = 'ReceiptAllocationFailedError'
  }
}

export class ReceiptAllocationDuplicateOpenItemError extends ReceiptAllocationValidationError {
  constructor() {
    super(
      'Duplicate invoiceOpenItemId in allocation request',
      RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_DUPLICATE_OPEN_ITEM,
      [{ field: 'allocations', message: 'Duplicate invoiceOpenItemId is not allowed' }],
    )
    this.name = 'ReceiptAllocationDuplicateOpenItemError'
  }
}

export class ReceiptAllocationForexRequiredError extends ReceiptAllocationValidationError {
  constructor() {
    super(
      'Exchange rates differ beyond tolerance; forex posting is required and not supported for allocation',
      RECEIPT_ALLOCATION_ERROR_CODES.RECEIPT_ALLOCATION_FOREX_REQUIRED,
    )
    this.name = 'ReceiptAllocationForexRequiredError'
  }
}
