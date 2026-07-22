import { AppError, ConflictError, NotFoundError, ValidationError } from '../../../../utils/errors.js'

export const PAYABLE_ALLOCATION_ERROR_CODES = {
  PAYABLE_ALLOCATION_AMOUNT_INVALID: 'PAYABLE_ALLOCATION_AMOUNT_INVALID',
  PAYABLE_ALLOCATION_EXCEEDS_SOURCE: 'PAYABLE_ALLOCATION_EXCEEDS_SOURCE',
  PAYABLE_ALLOCATION_EXCEEDS_TARGET: 'PAYABLE_ALLOCATION_EXCEEDS_TARGET',
  PAYABLE_ALLOCATION_VENDOR_MISMATCH: 'PAYABLE_ALLOCATION_VENDOR_MISMATCH',
  PAYABLE_ALLOCATION_CURRENCY_MISMATCH: 'PAYABLE_ALLOCATION_CURRENCY_MISMATCH',
  PAYABLE_ALLOCATION_CONTROL_ACCOUNT_MISMATCH: 'PAYABLE_ALLOCATION_CONTROL_ACCOUNT_MISMATCH',
  PAYABLE_ALLOCATION_OPEN_ITEM_INVALID: 'PAYABLE_ALLOCATION_OPEN_ITEM_INVALID',
  PAYABLE_ALLOCATION_DUPLICATE_TARGET: 'PAYABLE_ALLOCATION_DUPLICATE_TARGET',
  PAYABLE_ALLOCATION_FX_DIFFERENCE_REQUIRES_POSTING: 'PAYABLE_ALLOCATION_FX_DIFFERENCE_REQUIRES_POSTING',
  PAYABLE_ALLOCATION_IDEMPOTENCY_PAYLOAD_MISMATCH: 'PAYABLE_ALLOCATION_IDEMPOTENCY_PAYLOAD_MISMATCH',
  PAYABLE_ALLOCATION_IDEMPOTENCY_KEY_REQUIRED: 'PAYABLE_ALLOCATION_IDEMPOTENCY_KEY_REQUIRED',
  PAYABLE_ALLOCATION_CONCURRENT_CHANGE: 'PAYABLE_ALLOCATION_CONCURRENT_CHANGE',
  PAYABLE_ALLOCATION_IN_PROGRESS: 'PAYABLE_ALLOCATION_IN_PROGRESS',
  PAYABLE_ALLOCATION_PAYMENT_NOT_FOUND: 'PAYABLE_ALLOCATION_PAYMENT_NOT_FOUND',
  PAYABLE_ALLOCATION_PAYMENT_NOT_POSTED: 'PAYABLE_ALLOCATION_PAYMENT_NOT_POSTED',
  PAYABLE_ALLOCATION_SOURCE_MISSING: 'PAYABLE_ALLOCATION_SOURCE_MISSING',
  PAYABLE_ALLOCATION_SOURCE_INVALID: 'PAYABLE_ALLOCATION_SOURCE_INVALID',
  PAYABLE_ALLOCATION_LEGAL_ENTITY_MISMATCH: 'PAYABLE_ALLOCATION_LEGAL_ENTITY_MISMATCH',
  PAYABLE_ALLOCATION_BRANCH_MISMATCH: 'PAYABLE_ALLOCATION_BRANCH_MISMATCH',
  PAYABLE_ALLOCATION_DATE_INVALID: 'PAYABLE_ALLOCATION_DATE_INVALID',
  PAYABLE_ALLOCATION_PERIOD_CLOSED: 'PAYABLE_ALLOCATION_PERIOD_CLOSED',
  PAYABLE_ALLOCATION_PERIOD_UNDER_REVIEW: 'PAYABLE_ALLOCATION_PERIOD_UNDER_REVIEW',
  PAYABLE_ALLOCATION_NOT_ALLOWED: 'PAYABLE_ALLOCATION_NOT_ALLOWED',
  PAYABLE_ALLOCATION_FAILED: 'PAYABLE_ALLOCATION_FAILED',
  PAYABLE_ALLOCATION_BATCH_NOT_FOUND: 'PAYABLE_ALLOCATION_BATCH_NOT_FOUND',
  PAYABLE_ALLOCATION_DUPLICATE_REFERENCE: 'PAYABLE_ALLOCATION_DUPLICATE_REFERENCE',
  PAYABLE_ALLOCATION_LINE_CONFLICT: 'PAYABLE_ALLOCATION_LINE_CONFLICT',
  PAYABLE_ALLOCATION_DIRECTION_INVALID: 'PAYABLE_ALLOCATION_DIRECTION_INVALID',
  // Phase 4C1 — allocation reversal
  PAYABLE_ALLOCATION_REVERSAL_NOT_ALLOWED: 'PAYABLE_ALLOCATION_REVERSAL_NOT_ALLOWED',
  PAYABLE_ALLOCATION_ALREADY_REVERSED: 'PAYABLE_ALLOCATION_ALREADY_REVERSED',
  PAYABLE_ALLOCATION_NO_ACTIVE_AMOUNT: 'PAYABLE_ALLOCATION_NO_ACTIVE_AMOUNT',
  PAYABLE_ALLOCATION_REVERSAL_LINES_REQUIRED: 'PAYABLE_ALLOCATION_REVERSAL_LINES_REQUIRED',
  PAYABLE_ALLOCATION_REVERSAL_LINE_NOT_FOUND: 'PAYABLE_ALLOCATION_REVERSAL_LINE_NOT_FOUND',
  PAYABLE_ALLOCATION_REVERSAL_LINE_MISMATCH: 'PAYABLE_ALLOCATION_REVERSAL_LINE_MISMATCH',
  PAYABLE_ALLOCATION_REVERSAL_DATE_INVALID: 'PAYABLE_ALLOCATION_REVERSAL_DATE_INVALID',
  PAYABLE_ALLOCATION_REVERSAL_PERIOD_CLOSED: 'PAYABLE_ALLOCATION_REVERSAL_PERIOD_CLOSED',
  PAYABLE_ALLOCATION_REVERSAL_PERIOD_UNDER_REVIEW: 'PAYABLE_ALLOCATION_REVERSAL_PERIOD_UNDER_REVIEW',
  PAYABLE_ALLOCATION_REVERSAL_STALE_VERSION: 'PAYABLE_ALLOCATION_REVERSAL_STALE_VERSION',
  PAYABLE_ALLOCATION_REVERSAL_CONCURRENT_UPDATE: 'PAYABLE_ALLOCATION_REVERSAL_CONCURRENT_UPDATE',
  PAYABLE_ALLOCATION_REVERSAL_IN_PROGRESS: 'PAYABLE_ALLOCATION_REVERSAL_IN_PROGRESS',
  PAYABLE_ALLOCATION_REVERSAL_IDEMPOTENCY_KEY_REQUIRED: 'PAYABLE_ALLOCATION_REVERSAL_IDEMPOTENCY_KEY_REQUIRED',
  PAYABLE_ALLOCATION_REVERSAL_PAYLOAD_MISMATCH: 'PAYABLE_ALLOCATION_REVERSAL_PAYLOAD_MISMATCH',
  PAYABLE_ALLOCATION_REVERSAL_FAILED: 'PAYABLE_ALLOCATION_REVERSAL_FAILED',
  PAYABLE_ALLOCATION_REVERSAL_BALANCE_MISMATCH: 'PAYABLE_ALLOCATION_REVERSAL_BALANCE_MISMATCH',
} as const

export type PayableAllocationErrorCode =
  (typeof PAYABLE_ALLOCATION_ERROR_CODES)[keyof typeof PAYABLE_ALLOCATION_ERROR_CODES]

export class PayableAllocationError extends AppError {
  constructor(
    statusCode: number,
    message: string,
    code: PayableAllocationErrorCode,
    errors?: Array<{ field: string; message: string }>,
  ) {
    super(statusCode, message, code, errors)
    this.name = 'PayableAllocationError'
  }
}

export class PayableAllocationValidationError extends PayableAllocationError {
  constructor(
    message: string,
    code: PayableAllocationErrorCode,
    errors?: Array<{ field: string; message: string }>,
  ) {
    super(422, message, code, errors)
    this.name = 'PayableAllocationValidationError'
  }
}

// ─── Foundation error classes (Phase 4B1) — retained for repository/foundation tests ──

export class PayableAllocationBatchNotFoundError extends NotFoundError {
  constructor(message = 'Payable allocation batch not found') {
    super(message)
    Object.defineProperty(this, 'code', {
      value: PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_BATCH_NOT_FOUND,
    })
    this.name = 'PayableAllocationBatchNotFoundError'
  }
}

export class PayableAllocationDuplicateReferenceError extends ConflictError {
  constructor(message = 'Payable allocation reference already exists') {
    super(message)
    Object.defineProperty(this, 'code', {
      value: PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_DUPLICATE_REFERENCE,
    })
    this.name = 'PayableAllocationDuplicateReferenceError'
  }
}

export class PayableAllocationLineConflictError extends ConflictError {
  constructor(message = 'Payable allocation line conflict for target open item') {
    super(message)
    Object.defineProperty(this, 'code', {
      value: PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_LINE_CONFLICT,
    })
    this.name = 'PayableAllocationLineConflictError'
  }
}

export class PayableAllocationDirectionError extends ValidationError {
  constructor(message = 'Invalid payable allocation direction or party scope') {
    super(message)
    Object.defineProperty(this, 'code', {
      value: PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_DIRECTION_INVALID,
    })
    this.name = 'PayableAllocationDirectionError'
  }
}

export class PayableAllocationAmountInvalidError extends ValidationError {
  constructor(message = 'Payable allocation amounts must be positive') {
    super(message)
    Object.defineProperty(this, 'code', {
      value: PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_AMOUNT_INVALID,
    })
    this.name = 'PayableAllocationAmountInvalidError'
  }
}

// ─── Phase 4B4 execution error classes ────────────────────────────────────────

export class PayableAllocationPaymentNotFoundError extends NotFoundError {
  constructor(message = 'Vendor payment not found') {
    super(message)
    Object.defineProperty(this, 'code', {
      value: PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_PAYMENT_NOT_FOUND,
    })
    this.name = 'PayableAllocationPaymentNotFoundError'
  }
}

export class PayableAllocationPaymentNotPostedError extends PayableAllocationValidationError {
  constructor(message = 'Only POSTED vendor payments can be allocated') {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_PAYMENT_NOT_POSTED)
    this.name = 'PayableAllocationPaymentNotPostedError'
  }
}

export class PayableAllocationSourceMissingError extends PayableAllocationValidationError {
  constructor(message = 'Posted vendor payment is missing a DEBIT payable open item') {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_SOURCE_MISSING)
    this.name = 'PayableAllocationSourceMissingError'
  }
}

export class PayableAllocationSourceInvalidError extends PayableAllocationValidationError {
  constructor(message: string) {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_SOURCE_INVALID)
    this.name = 'PayableAllocationSourceInvalidError'
  }
}

export class PayableAllocationOpenItemInvalidError extends PayableAllocationValidationError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_OPEN_ITEM_INVALID, errors)
    this.name = 'PayableAllocationOpenItemInvalidError'
  }
}

export class PayableAllocationVendorMismatchError extends PayableAllocationValidationError {
  constructor(message = 'Allocation vendor must match source payment and target invoices') {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_VENDOR_MISMATCH)
    this.name = 'PayableAllocationVendorMismatchError'
  }
}

export class PayableAllocationCurrencyMismatchError extends PayableAllocationValidationError {
  constructor(message = 'Payment currency must match invoice currency for allocation') {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_CURRENCY_MISMATCH)
    this.name = 'PayableAllocationCurrencyMismatchError'
  }
}

export class PayableAllocationControlAccountMismatchError extends PayableAllocationValidationError {
  constructor(message = 'Payment and invoice must share the same vendor payable control account') {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_CONTROL_ACCOUNT_MISMATCH)
    this.name = 'PayableAllocationControlAccountMismatchError'
  }
}

export class PayableAllocationLegalEntityMismatchError extends PayableAllocationValidationError {
  constructor(message = 'Allocation legal entity must match payment and invoices') {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_LEGAL_ENTITY_MISMATCH)
    this.name = 'PayableAllocationLegalEntityMismatchError'
  }
}

export class PayableAllocationBranchMismatchError extends PayableAllocationValidationError {
  constructor(message = 'Allocation branch must match when same-branch allocation is required') {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_BRANCH_MISMATCH)
    this.name = 'PayableAllocationBranchMismatchError'
  }
}

export class PayableAllocationExceedsSourceError extends PayableAllocationValidationError {
  constructor(message = 'Total allocation exceeds vendor payment outstanding') {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_EXCEEDS_SOURCE)
    this.name = 'PayableAllocationExceedsSourceError'
  }
}

export class PayableAllocationExceedsTargetError extends PayableAllocationValidationError {
  constructor(message = 'Allocation amount exceeds invoice outstanding') {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_EXCEEDS_TARGET)
    this.name = 'PayableAllocationExceedsTargetError'
  }
}

export class PayableAllocationDuplicateTargetError extends PayableAllocationValidationError {
  constructor() {
    super(
      'Duplicate target credit open item in allocation request',
      PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_DUPLICATE_TARGET,
      [{ field: 'lines', message: 'Duplicate targetCreditOpenItemId is not allowed' }],
    )
    this.name = 'PayableAllocationDuplicateTargetError'
  }
}

export class PayableAllocationForexRequiredError extends PayableAllocationValidationError {
  constructor() {
    super(
      'Exchange rates differ beyond tolerance; forex posting is required and not supported for allocation',
      PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_FX_DIFFERENCE_REQUIRES_POSTING,
    )
    this.name = 'PayableAllocationForexRequiredError'
  }
}

export class PayableAllocationDateInvalidError extends PayableAllocationValidationError {
  constructor(message = 'Allocation date must be on or after all source and target posting dates') {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_DATE_INVALID)
    this.name = 'PayableAllocationDateInvalidError'
  }
}

export class PayableAllocationPeriodClosedError extends PayableAllocationValidationError {
  constructor(message = 'Accounting period is closed for allocation') {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_PERIOD_CLOSED)
    this.name = 'PayableAllocationPeriodClosedError'
  }
}

export class PayableAllocationPeriodUnderReviewError extends PayableAllocationValidationError {
  constructor(message = 'Accounting period is under review and cannot accept allocations') {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_PERIOD_UNDER_REVIEW)
    this.name = 'PayableAllocationPeriodUnderReviewError'
  }
}

export class PayableAllocationPayloadMismatchError extends ConflictError {
  constructor() {
    super('Idempotency key was reused with a different allocation payload')
    Object.defineProperty(this, 'code', {
      value: PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_IDEMPOTENCY_PAYLOAD_MISMATCH,
    })
    this.name = 'PayableAllocationPayloadMismatchError'
  }
}

export class PayableAllocationConcurrentChangeError extends ConflictError {
  constructor(message = 'Allocation balances changed concurrently. Refresh and retry.') {
    super(message)
    Object.defineProperty(this, 'code', {
      value: PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_CONCURRENT_CHANGE,
    })
    this.name = 'PayableAllocationConcurrentChangeError'
  }
}

export class PayableAllocationInProgressError extends ConflictError {
  constructor() {
    super('An allocation with this idempotency key is already in progress')
    Object.defineProperty(this, 'code', {
      value: PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_IN_PROGRESS,
    })
    this.name = 'PayableAllocationInProgressError'
  }
}

export class PayableAllocationIdempotencyKeyRequiredError extends ValidationError {
  constructor() {
    super('Idempotency-Key header is required', [
      { field: 'Idempotency-Key', message: 'Idempotency-Key header is required' },
    ])
    Object.defineProperty(this, 'code', {
      value: PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_IDEMPOTENCY_KEY_REQUIRED,
    })
    this.name = 'PayableAllocationIdempotencyKeyRequiredError'
  }
}

export class PayableAllocationNotAllowedError extends PayableAllocationError {
  constructor(message = 'Missing permission: finance.ap.allocation.create') {
    super(403, message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_NOT_ALLOWED)
    this.name = 'PayableAllocationNotAllowedError'
  }
}

export class PayableAllocationFailedError extends PayableAllocationError {
  constructor(message = 'Payable allocation failed') {
    super(500, message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_FAILED)
    this.name = 'PayableAllocationFailedError'
  }
}

// ─── Phase 4C1 — allocation reversal errors ──────────────────────────────────

export class PayableAllocationReversalNotAllowedError extends PayableAllocationError {
  constructor(message = 'Missing permission: finance.ap.allocation.reverse') {
    super(403, message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_REVERSAL_NOT_ALLOWED)
    this.name = 'PayableAllocationReversalNotAllowedError'
  }
}

export class PayableAllocationAlreadyReversedError extends PayableAllocationValidationError {
  constructor(message = 'Payable allocation batch is already fully reversed') {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_ALREADY_REVERSED)
    this.name = 'PayableAllocationAlreadyReversedError'
  }
}

export class PayableAllocationNoActiveAmountError extends PayableAllocationValidationError {
  constructor(message = 'No active allocation amount remains to reverse') {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_NO_ACTIVE_AMOUNT)
    this.name = 'PayableAllocationNoActiveAmountError'
  }
}

export class PayableAllocationReversalLineNotFoundError extends PayableAllocationValidationError {
  constructor(message = 'Selected allocation line not found on this batch') {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_REVERSAL_LINE_NOT_FOUND)
    this.name = 'PayableAllocationReversalLineNotFoundError'
  }
}

export class PayableAllocationReversalDateInvalidError extends PayableAllocationValidationError {
  constructor(message = 'Allocation reversal date is invalid') {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_REVERSAL_DATE_INVALID)
    this.name = 'PayableAllocationReversalDateInvalidError'
  }
}

export class PayableAllocationReversalPeriodClosedError extends PayableAllocationValidationError {
  constructor(message = 'Accounting period is closed for allocation reversal') {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_REVERSAL_PERIOD_CLOSED)
    this.name = 'PayableAllocationReversalPeriodClosedError'
  }
}

export class PayableAllocationReversalPeriodUnderReviewError extends PayableAllocationValidationError {
  constructor(message = 'Accounting period is under review for allocation reversal') {
    super(message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_REVERSAL_PERIOD_UNDER_REVIEW)
    this.name = 'PayableAllocationReversalPeriodUnderReviewError'
  }
}

export class PayableAllocationReversalStaleVersionError extends ConflictError {
  constructor(message = 'Allocation or open-item version is stale. Refresh and retry.') {
    super(message)
    Object.defineProperty(this, 'code', {
      value: PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_REVERSAL_STALE_VERSION,
    })
    this.name = 'PayableAllocationReversalStaleVersionError'
  }
}

export class PayableAllocationReversalConcurrentUpdateError extends ConflictError {
  constructor(message = 'Allocation balances changed concurrently during reversal. Refresh and retry.') {
    super(message)
    Object.defineProperty(this, 'code', {
      value: PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_REVERSAL_CONCURRENT_UPDATE,
    })
    this.name = 'PayableAllocationReversalConcurrentUpdateError'
  }
}

export class PayableAllocationReversalPayloadMismatchError extends ConflictError {
  constructor(message = 'Idempotency key was reused with a different allocation-reversal payload') {
    super(message)
    Object.defineProperty(this, 'code', {
      value: PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_REVERSAL_PAYLOAD_MISMATCH,
    })
    this.name = 'PayableAllocationReversalPayloadMismatchError'
  }
}

export class PayableAllocationReversalFailedError extends PayableAllocationError {
  constructor(message = 'Payable allocation reversal failed') {
    super(500, message, PAYABLE_ALLOCATION_ERROR_CODES.PAYABLE_ALLOCATION_REVERSAL_FAILED)
    this.name = 'PayableAllocationReversalFailedError'
  }
}
