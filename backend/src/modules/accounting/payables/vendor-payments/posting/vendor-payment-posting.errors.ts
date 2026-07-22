import { AppError, ConflictError } from '../../../../../utils/errors.js'
import { PostingError } from '../../../posting/posting.errors.js'
import { VendorPaymentError } from '../vendor-payment.errors.js'

export class VendorPaymentPostingError extends VendorPaymentError {
  constructor(statusCode: number, message: string, code: string, errors?: Array<{ field: string; message: string }>) {
    super(statusCode, message, code)
    this.name = 'VendorPaymentPostingError'
    if (errors) {
      Object.defineProperty(this, 'errors', { value: errors })
    }
  }
}

export class VendorPaymentNotReadyToPostError extends VendorPaymentPostingError {
  constructor(message = 'Only READY_TO_POST vendor payments can be posted') {
    super(422, message, 'VENDOR_PAYMENT_NOT_READY_TO_POST')
  }
}

export class VendorPaymentAlreadyPostedError extends VendorPaymentPostingError {
  constructor(message = 'Vendor payment is already posted') {
    super(422, message, 'VENDOR_PAYMENT_ALREADY_POSTED')
  }
}

export class VendorPaymentPostingNotAllowedError extends VendorPaymentPostingError {
  constructor(message = 'Missing permission: finance.ap.payment.post') {
    super(403, message, 'VENDOR_PAYMENT_POSTING_NOT_ALLOWED')
  }
}

export class VendorPaymentChangedAfterReadyError extends VendorPaymentPostingError {
  constructor(message = 'Vendor payment amounts changed after ready-to-post. Revise, revalidate, and mark ready again.') {
    super(422, message, 'VENDOR_PAYMENT_CHANGED_AFTER_READY')
  }
}

export class VendorPaymentCalculationVersionChangedError extends VendorPaymentPostingError {
  constructor(message = 'Vendor payment calculation version is obsolete. Revise and revalidate before posting.') {
    super(422, message, 'VENDOR_PAYMENT_CALCULATION_VERSION_CHANGED')
  }
}

export class VendorPaymentAccountingPreviewChangedError extends VendorPaymentPostingError {
  constructor(message = 'Accounting preview changed after ready-to-post. Revise and revalidate before posting.') {
    super(422, message, 'VENDOR_PAYMENT_ACCOUNTING_PREVIEW_CHANGED')
  }
}

export class VendorPaymentApprovalIncompleteError extends VendorPaymentPostingError {
  constructor(message = 'Vendor payment approval is incomplete or not approved') {
    super(422, message, 'VENDOR_PAYMENT_APPROVAL_INCOMPLETE')
  }
}

export class VendorPaymentApprovalMismatchError extends VendorPaymentPostingError {
  constructor(message = 'Approved amount or approval request does not match the current vendor payment') {
    super(422, message, 'VENDOR_PAYMENT_APPROVAL_MISMATCH')
  }
}

export class VendorPaymentApprovalInvalidatedError extends VendorPaymentPostingError {
  constructor(message = 'Vendor payment approval request is no longer valid for posting') {
    super(422, message, 'VENDOR_PAYMENT_APPROVAL_INVALIDATED')
  }
}

export class VendorPaymentUniquenessKeyMissingError extends VendorPaymentPostingError {
  constructor(message = 'Payment uniqueness key is missing') {
    super(422, message, 'VENDOR_PAYMENT_UNIQUENESS_KEY_MISSING')
  }
}

export class VendorPaymentVendorInactiveError extends VendorPaymentPostingError {
  constructor(message = 'Vendor is inactive or blocked and cannot be posted') {
    super(422, message, 'VENDOR_PAYMENT_VENDOR_INACTIVE')
  }
}

export class VendorPaymentPostingPeriodClosedError extends VendorPaymentPostingError {
  constructor(message = 'Accounting period is closed for posting') {
    super(422, message, 'VENDOR_PAYMENT_POSTING_PERIOD_CLOSED')
  }
}

export class VendorPaymentPostingPeriodUnderReviewError extends VendorPaymentPostingError {
  constructor(message = 'Accounting period is under review and cannot accept postings') {
    super(422, message, 'VENDOR_PAYMENT_POSTING_PERIOD_UNDER_REVIEW')
  }
}

export class VendorPaymentNumberSeriesMissingError extends VendorPaymentPostingError {
  constructor(message = 'Vendor payment number series is not configured') {
    super(422, message, 'VENDOR_PAYMENT_NUMBER_SERIES_MISSING')
  }
}

export class VendorPaymentNumberAlreadyAssignedError extends VendorPaymentPostingError {
  constructor(message = 'Vendor payment number is already assigned') {
    super(422, message, 'VENDOR_PAYMENT_NUMBER_ALREADY_ASSIGNED')
  }
}

export class VendorPaymentAccountMissingError extends VendorPaymentPostingError {
  constructor(code: string, message: string) {
    super(422, message, code)
  }
}

export class VendorPaymentAccountingAlreadyLinkedError extends VendorPaymentPostingError {
  constructor(message = 'Vendor payment is already linked to accounting records') {
    super(422, message, 'VENDOR_PAYMENT_ACCOUNTING_ALREADY_LINKED')
  }
}

export class VendorPaymentPayableOpenItemAlreadyExistsError extends VendorPaymentPostingError {
  constructor(message = 'A payable open item already exists for this vendor payment') {
    super(422, message, 'VENDOR_PAYMENT_PAYABLE_OPEN_ITEM_ALREADY_EXISTS')
  }
}

export class VendorPaymentPayableOpenItemCreationFailedError extends VendorPaymentPostingError {
  constructor(message = 'Failed to create vendor payment payable open item') {
    super(500, message, 'VENDOR_PAYMENT_PAYABLE_OPEN_ITEM_CREATION_FAILED')
  }
}

export class VendorPaymentPayableGlMismatchError extends VendorPaymentPostingError {
  constructor(message = 'Payable open-item amount does not match vendor payable GL debit') {
    super(500, message, 'VENDOR_PAYMENT_PAYABLE_GL_MISMATCH')
  }
}

export class VendorPaymentAccountingPreviewUnbalancedError extends VendorPaymentPostingError {
  constructor(message = 'Vendor payment accounting preview is unbalanced') {
    super(422, message, 'VENDOR_PAYMENT_ACCOUNTING_PREVIEW_UNBALANCED')
  }
}

export class VendorPaymentBasePreviewUnbalancedError extends VendorPaymentPostingError {
  constructor(message = 'Vendor payment base-currency accounting preview is unbalanced') {
    super(422, message, 'VENDOR_PAYMENT_BASE_PREVIEW_UNBALANCED')
  }
}

export class VendorPaymentPayloadMismatchError extends VendorPaymentPostingError {
  constructor(message = 'PostingEvent payload hash does not match the current vendor payment') {
    super(422, message, 'VENDOR_PAYMENT_PAYLOAD_MISMATCH')
  }
}

export class VendorPaymentPostingInProgressError extends ConflictError {
  constructor(message = 'Vendor payment posting is already in progress') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_PAYMENT_POSTING_IN_PROGRESS' })
  }
}

export class VendorPaymentConcurrentPostError extends ConflictError {
  constructor(message = 'Another user posted this vendor payment concurrently. Refresh and retry if needed.') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_PAYMENT_CONCURRENT_POST' })
  }
}

export class VendorPaymentPostingFailedError extends VendorPaymentPostingError {
  constructor(message = 'Vendor payment posting failed') {
    super(500, message, 'VENDOR_PAYMENT_POSTING_FAILED')
  }
}

// ─── Phase 4C1 — payment reversal ────────────────────────────────────────────

export class VendorPaymentReversalNotAllowedError extends VendorPaymentPostingError {
  constructor(message = 'Missing permission: finance.ap.payment.reverse') {
    super(403, message, 'VENDOR_PAYMENT_REVERSAL_NOT_ALLOWED')
  }
}

export class VendorPaymentAlreadyReversedError extends VendorPaymentPostingError {
  constructor(message = 'Vendor payment is already reversed') {
    super(422, message, 'VENDOR_PAYMENT_ALREADY_REVERSED')
  }
}

export class VendorPaymentActiveAllocationsExistError extends VendorPaymentPostingError {
  constructor(
    public readonly allocations: Array<{
      allocationBatchId: string
      allocationReference: string
      allocationLineId: string
      activeAmount: string
    }>,
  ) {
    super(
      422,
      'Active payable allocations exist. Reverse allocations first or set cascadeAllocationReversals=true.',
      'VENDOR_PAYMENT_ACTIVE_ALLOCATIONS_EXIST',
      allocations.map((a) => ({
        field: a.allocationLineId,
        message: `${a.allocationReference}: ${a.activeAmount}`,
      })),
    )
    this.name = 'VendorPaymentActiveAllocationsExistError'
  }
}

export class VendorPaymentOpenItemNotFullyRestoredError extends VendorPaymentPostingError {
  constructor(message = 'Payment DEBIT open item is not fully restored before accounting reversal') {
    super(422, message, 'VENDOR_PAYMENT_OPEN_ITEM_NOT_FULLY_RESTORED')
  }
}

export class VendorPaymentOriginalVoucherMissingError extends VendorPaymentPostingError {
  constructor(message = 'Original accounting voucher is missing for payment reversal') {
    super(422, message, 'VENDOR_PAYMENT_ORIGINAL_VOUCHER_MISSING')
  }
}

export class VendorPaymentOriginalPostingEventMissingError extends VendorPaymentPostingError {
  constructor(message = 'Original posting event is missing for payment reversal') {
    super(422, message, 'VENDOR_PAYMENT_ORIGINAL_POSTING_EVENT_MISSING')
  }
}

export class VendorPaymentReversalPeriodClosedError extends VendorPaymentPostingError {
  constructor(message = 'Accounting period is closed for payment reversal') {
    super(422, message, 'VENDOR_PAYMENT_REVERSAL_PERIOD_CLOSED')
  }
}

export class VendorPaymentReversalPeriodUnderReviewError extends VendorPaymentPostingError {
  constructor(message = 'Accounting period is under review for payment reversal') {
    super(422, message, 'VENDOR_PAYMENT_REVERSAL_PERIOD_UNDER_REVIEW')
  }
}

export class VendorPaymentReversalDateInvalidError extends VendorPaymentPostingError {
  constructor(message = 'Payment reversal date is invalid') {
    super(422, message, 'VENDOR_PAYMENT_REVERSAL_DATE_INVALID')
  }
}

export class VendorPaymentReversalNotPostedError extends VendorPaymentPostingError {
  constructor(message = 'Only POSTED vendor payments can be reversed') {
    super(422, message, 'VENDOR_PAYMENT_REVERSAL_NOT_ALLOWED')
  }
}

export class VendorPaymentReversalEligibilityError extends VendorPaymentPostingError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'VENDOR_PAYMENT_REVERSAL_NOT_ALLOWED', errors)
  }
}

export class VendorPaymentReversalFailedError extends VendorPaymentPostingError {
  constructor(message = 'Vendor payment reversal failed') {
    super(500, message, 'VENDOR_PAYMENT_REVERSAL_FAILED')
  }
}

const ACCOUNT_COMPONENT_CODES: Record<string, string> = {
  VENDOR_PAYABLE: 'VENDOR_PAYMENT_PAYABLE_ACCOUNT_MISSING',
  PAYMENT_ACCOUNT: 'VENDOR_PAYMENT_PAYMENT_ACCOUNT_MISSING',
  TDS_PAYABLE: 'VENDOR_PAYMENT_TDS_ACCOUNT_MISSING',
  DISCOUNT_RECEIVED: 'VENDOR_PAYMENT_DISCOUNT_ACCOUNT_MISSING',
  RETENTION_PAYABLE: 'VENDOR_PAYMENT_RETENTION_ACCOUNT_MISSING',
  WITHHOLDING_PAYABLE: 'VENDOR_PAYMENT_WITHHOLDING_ACCOUNT_MISSING',
  BANK_CHARGE: 'VENDOR_PAYMENT_BANK_CHARGE_ACCOUNT_MISSING',
  PROCESSING_CHARGE: 'VENDOR_PAYMENT_PROCESSING_ACCOUNT_MISSING',
  ROUND_OFF_DEBIT: 'VENDOR_PAYMENT_ROUND_OFF_ACCOUNT_MISSING',
  ROUND_OFF_CREDIT: 'VENDOR_PAYMENT_ROUND_OFF_ACCOUNT_MISSING',
  OTHER_ADJUSTMENT: 'VENDOR_PAYMENT_OTHER_ACCOUNT_MISSING',
}

export function accountMissingErrorForComponent(component: string, message: string): VendorPaymentAccountMissingError {
  return new VendorPaymentAccountMissingError(
    ACCOUNT_COMPONENT_CODES[component] ?? 'VENDOR_PAYMENT_PAYMENT_ACCOUNT_MISSING',
    message,
  )
}

export function mapPostingErrorToVendorPaymentError(error: unknown): never {
  if (
    error instanceof VendorPaymentPostingError ||
    error instanceof VendorPaymentConcurrentPostError ||
    error instanceof VendorPaymentPostingInProgressError
  ) {
    throw error
  }
  if (error instanceof PostingError) {
    if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
      throw new VendorPaymentPostingPeriodClosedError(error.message)
    }
    if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
      throw new VendorPaymentPostingPeriodUnderReviewError(error.message)
    }
    if (error.code === 'NUMBER_SERIES_NOT_CONFIGURED' || error.code === 'NUMBER_SERIES_INACTIVE') {
      throw new VendorPaymentNumberSeriesMissingError(error.message)
    }
    if (error.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH') {
      throw new VendorPaymentPayloadMismatchError(error.message)
    }
    if (error.code === 'POSTING_EVENT_IN_PROGRESS' || error.code === 'POSTING_CONCURRENT_ACTION') {
      throw new VendorPaymentPostingInProgressError(error.message)
    }
    throw new VendorPaymentPostingFailedError(error.message)
  }
  if (error instanceof AppError) throw error
  throw new VendorPaymentPostingFailedError(error instanceof Error ? error.message : 'Vendor payment posting failed')
}

export function mapPostingErrorToVendorPaymentReversalError(error: unknown): never {
  if (
    error instanceof VendorPaymentPostingError ||
    error instanceof VendorPaymentConcurrentPostError ||
    error instanceof VendorPaymentPostingInProgressError
  ) {
    throw error
  }
  if (error instanceof PostingError) {
    if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
      throw new VendorPaymentReversalPeriodClosedError(error.message)
    }
    if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
      throw new VendorPaymentReversalPeriodUnderReviewError(error.message)
    }
    if (error.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH') {
      throw new VendorPaymentPayloadMismatchError(error.message)
    }
    if (error.code === 'POSTING_EVENT_IN_PROGRESS' || error.code === 'POSTING_CONCURRENT_ACTION') {
      throw new VendorPaymentPostingInProgressError(error.message)
    }
    throw new VendorPaymentReversalFailedError(error.message)
  }
  if (error instanceof AppError) throw error
  throw new VendorPaymentReversalFailedError(error instanceof Error ? error.message : 'Vendor payment reversal failed')
}
