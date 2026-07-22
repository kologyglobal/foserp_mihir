import { AppError, ConflictError } from '../../../../../utils/errors.js'
import { PostingError } from '../../../posting/posting.errors.js'
import { VendorAdjustmentError } from '../vendor-adjustment.errors.js'

export class VendorAdjustmentPostingError extends VendorAdjustmentError {
  constructor(statusCode: number, message: string, code: string, errors?: Array<{ field: string; message: string }>) {
    super(statusCode, message, code)
    this.name = 'VendorAdjustmentPostingError'
    if (errors) {
      Object.defineProperty(this, 'errors', { value: errors })
    }
  }
}

export class VendorAdjustmentNotReadyToPostError extends VendorAdjustmentPostingError {
  constructor(message = 'Only READY_TO_POST vendor invoices can be posted') {
    super(422, message, 'VENDOR_ADJUSTMENT_NOT_READY_TO_POST')
  }
}

export class VendorAdjustmentAlreadyPostedError extends VendorAdjustmentPostingError {
  constructor(message = 'Vendor invoice is already posted') {
    super(422, message, 'VENDOR_ADJUSTMENT_ALREADY_POSTED')
  }
}

export class VendorAdjustmentPostingNotAllowedError extends VendorAdjustmentPostingError {
  constructor(message = 'Missing permission: finance.ap.adjustment.post') {
    super(403, message, 'VENDOR_ADJUSTMENT_POSTING_NOT_ALLOWED')
  }
}

export class VendorAdjustmentChangedAfterReadyError extends VendorAdjustmentPostingError {
  constructor(message = 'Vendor invoice amounts changed after ready-to-post. Revise, revalidate, and mark ready again.') {
    super(422, message, 'VENDOR_ADJUSTMENT_CHANGED_AFTER_READY')
  }
}

export class VendorAdjustmentCalculationVersionChangedError extends VendorAdjustmentPostingError {
  constructor(message = 'Vendor invoice calculation version is obsolete. Revise and revalidate before posting.') {
    super(422, message, 'VENDOR_ADJUSTMENT_CALCULATION_VERSION_CHANGED')
  }
}

export class VendorAdjustmentAccountingPreviewChangedError extends VendorAdjustmentPostingError {
  constructor(message = 'Accounting preview changed after ready-to-post. Revise and revalidate before posting.') {
    super(422, message, 'VENDOR_ADJUSTMENT_ACCOUNTING_PREVIEW_CHANGED')
  }
}

export class VendorAdjustmentApprovalIncompleteError extends VendorAdjustmentPostingError {
  constructor(message = 'Vendor invoice approval is incomplete or not approved') {
    super(422, message, 'VENDOR_ADJUSTMENT_APPROVAL_INCOMPLETE')
  }
}

export class VendorAdjustmentApprovalMismatchError extends VendorAdjustmentPostingError {
  constructor(message = 'Approved amount or approval request does not match the current vendor invoice') {
    super(422, message, 'VENDOR_ADJUSTMENT_APPROVAL_MISMATCH')
  }
}

export class VendorAdjustmentApprovalInvalidatedError extends VendorAdjustmentPostingError {
  constructor(message = 'Vendor invoice approval request is no longer valid for posting') {
    super(422, message, 'VENDOR_ADJUSTMENT_APPROVAL_INVALIDATED')
  }
}

export class VendorAdjustmentUniquenessKeyMissingError extends VendorAdjustmentPostingError {
  constructor(message = 'Supplier invoice uniqueness key is missing') {
    super(422, message, 'VENDOR_ADJUSTMENT_UNIQUENESS_KEY_MISSING')
  }
}

export class VendorAdjustmentVendorInactiveError extends VendorAdjustmentPostingError {
  constructor(message = 'Vendor is inactive or blocked and cannot be posted') {
    super(422, message, 'VENDOR_ADJUSTMENT_VENDOR_INACTIVE')
  }
}

export class VendorAdjustmentPostingPeriodClosedError extends VendorAdjustmentPostingError {
  constructor(message = 'Accounting period is closed for posting') {
    super(422, message, 'VENDOR_ADJUSTMENT_POSTING_PERIOD_CLOSED')
  }
}

export class VendorAdjustmentPostingPeriodUnderReviewError extends VendorAdjustmentPostingError {
  constructor(message = 'Accounting period is under review and cannot accept postings') {
    super(422, message, 'VENDOR_ADJUSTMENT_POSTING_PERIOD_UNDER_REVIEW')
  }
}

export class VendorAdjustmentNumberSeriesMissingError extends VendorAdjustmentPostingError {
  constructor(message = 'Vendor invoice number series is not configured') {
    super(422, message, 'VENDOR_ADJUSTMENT_NUMBER_SERIES_MISSING')
  }
}

export class VendorAdjustmentNumberAlreadyAssignedError extends VendorAdjustmentPostingError {
  constructor(message = 'Vendor invoice number is already assigned') {
    super(422, message, 'VENDOR_ADJUSTMENT_NUMBER_ALREADY_ASSIGNED')
  }
}

export class VendorAdjustmentAccountMissingError extends VendorAdjustmentPostingError {
  constructor(code: string, message: string) {
    super(422, message, code)
  }
}

export class VendorAdjustmentAccountingAlreadyLinkedError extends VendorAdjustmentPostingError {
  constructor(message = 'Vendor invoice is already linked to accounting records') {
    super(422, message, 'VENDOR_ADJUSTMENT_ACCOUNTING_ALREADY_LINKED')
  }
}

export class VendorAdjustmentPayableOpenItemAlreadyExistsError extends VendorAdjustmentPostingError {
  constructor(message = 'A payable open item already exists for this vendor invoice') {
    super(422, message, 'VENDOR_ADJUSTMENT_PAYABLE_OPEN_ITEM_ALREADY_EXISTS')
  }
}

export class VendorAdjustmentPayableOpenItemCreationFailedError extends VendorAdjustmentPostingError {
  constructor(message = 'Failed to create vendor payable open item') {
    super(500, message, 'VENDOR_ADJUSTMENT_PAYABLE_OPEN_ITEM_CREATION_FAILED')
  }
}

export class VendorAdjustmentPayableGlMismatchError extends VendorAdjustmentPostingError {
  constructor(message = 'Payable open-item amount does not match vendor payable GL credit') {
    super(500, message, 'VENDOR_ADJUSTMENT_PAYABLE_GL_MISMATCH')
  }
}

export class VendorAdjustmentAccountingPreviewUnbalancedError extends VendorAdjustmentPostingError {
  constructor(message = 'Vendor invoice accounting preview is unbalanced') {
    super(422, message, 'VENDOR_ADJUSTMENT_ACCOUNTING_PREVIEW_UNBALANCED')
  }
}

export class VendorAdjustmentBasePreviewUnbalancedError extends VendorAdjustmentPostingError {
  constructor(message = 'Vendor invoice base-currency accounting preview is unbalanced') {
    super(422, message, 'VENDOR_ADJUSTMENT_BASE_PREVIEW_UNBALANCED')
  }
}

export class VendorAdjustmentPayloadMismatchError extends VendorAdjustmentPostingError {
  constructor(message = 'PostingEvent payload hash does not match the current vendor invoice') {
    super(422, message, 'VENDOR_ADJUSTMENT_PAYLOAD_MISMATCH')
  }
}

export class VendorAdjustmentPostingInProgressError extends ConflictError {
  constructor(message = 'Vendor invoice posting is already in progress') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_ADJUSTMENT_POSTING_IN_PROGRESS' })
  }
}

export class VendorAdjustmentConcurrentPostError extends ConflictError {
  constructor(message = 'Another user posted this vendor invoice concurrently. Refresh and retry if needed.') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_ADJUSTMENT_CONCURRENT_POST' })
  }
}

export class VendorAdjustmentPostingFailedError extends VendorAdjustmentPostingError {
  constructor(message = 'Vendor invoice posting failed') {
    super(500, message, 'VENDOR_ADJUSTMENT_POSTING_FAILED')
  }
}

// ─── Phase 4C1 — vendor invoice reversal (§62) ───────────────────────────────

export class VendorAdjustmentReversalNotAllowedError extends VendorAdjustmentPostingError {
  constructor(message = 'Missing permission: finance.ap.adjustment.reverse') {
    super(403, message, 'VENDOR_ADJUSTMENT_REVERSAL_NOT_ALLOWED')
  }
}

export class VendorAdjustmentAlreadyReversedError extends VendorAdjustmentPostingError {
  constructor(message = 'Vendor invoice is already reversed') {
    super(422, message, 'VENDOR_ADJUSTMENT_ALREADY_REVERSED')
  }
}

export class VendorAdjustmentActiveAllocationsExistError extends VendorAdjustmentPostingError {
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
      'VENDOR_ADJUSTMENT_ACTIVE_ALLOCATIONS_EXIST',
      allocations.map((a) => ({
        field: a.allocationLineId,
        message: `${a.allocationReference}: ${a.activeAmount}`,
      })),
    )
    this.name = 'VendorAdjustmentActiveAllocationsExistError'
  }
}

export class VendorAdjustmentOpenItemNotFullyRestoredError extends VendorAdjustmentPostingError {
  constructor(message = 'Invoice CREDIT open item is not fully restored before accounting reversal') {
    super(422, message, 'VENDOR_ADJUSTMENT_OPEN_ITEM_NOT_FULLY_RESTORED')
  }
}

export class VendorAdjustmentOriginalVoucherMissingError extends VendorAdjustmentPostingError {
  constructor(message = 'Original accounting voucher is missing for invoice reversal') {
    super(422, message, 'VENDOR_ADJUSTMENT_ORIGINAL_VOUCHER_MISSING')
  }
}

export class VendorAdjustmentOriginalPostingEventMissingError extends VendorAdjustmentPostingError {
  constructor(message = 'Original posting event is missing for invoice reversal') {
    super(422, message, 'VENDOR_ADJUSTMENT_ORIGINAL_POSTING_EVENT_MISSING')
  }
}

export class VendorAdjustmentReversalPeriodClosedError extends VendorAdjustmentPostingError {
  constructor(message = 'Accounting period is closed for invoice reversal') {
    super(422, message, 'VENDOR_ADJUSTMENT_REVERSAL_PERIOD_CLOSED')
  }
}

export class VendorAdjustmentReversalPeriodUnderReviewError extends VendorAdjustmentPostingError {
  constructor(message = 'Accounting period is under review for invoice reversal') {
    super(422, message, 'VENDOR_ADJUSTMENT_REVERSAL_PERIOD_UNDER_REVIEW')
  }
}

export class VendorAdjustmentReversalDateInvalidError extends VendorAdjustmentPostingError {
  constructor(message = 'Invoice reversal date is invalid') {
    super(422, message, 'VENDOR_ADJUSTMENT_REVERSAL_DATE_INVALID')
  }
}

export class VendorAdjustmentReversalNotPostedError extends VendorAdjustmentPostingError {
  constructor(message = 'Only POSTED vendor invoices can be reversed') {
    super(422, message, 'VENDOR_ADJUSTMENT_REVERSAL_NOT_ALLOWED')
  }
}

export class VendorAdjustmentReversalEligibilityError extends VendorAdjustmentPostingError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'VENDOR_ADJUSTMENT_REVERSAL_NOT_ALLOWED', errors)
  }
}

export class VendorAdjustmentReversalFailedError extends VendorAdjustmentPostingError {
  constructor(message = 'Vendor invoice reversal failed') {
    super(500, message, 'VENDOR_ADJUSTMENT_REVERSAL_FAILED')
  }
}

const ACCOUNT_COMPONENT_CODES: Record<string, string> = {
  LINE_OFFSET: 'VENDOR_ADJUSTMENT_DEBIT_ACCOUNT_MISSING',
  INPUT_CGST: 'VENDOR_ADJUSTMENT_INPUT_CGST_ACCOUNT_MISSING',
  INPUT_SGST: 'VENDOR_ADJUSTMENT_INPUT_SGST_ACCOUNT_MISSING',
  INPUT_IGST: 'VENDOR_ADJUSTMENT_INPUT_IGST_ACCOUNT_MISSING',
  INPUT_CESS: 'VENDOR_ADJUSTMENT_INPUT_CESS_ACCOUNT_MISSING',
  OTHER_RECOVERABLE_TAX: 'VENDOR_ADJUSTMENT_OTHER_TAX_ACCOUNT_MISSING',
  TDS_PAYABLE: 'VENDOR_ADJUSTMENT_TDS_ACCOUNT_MISSING',
  RCM_CGST_PAYABLE: 'VENDOR_ADJUSTMENT_RCM_ACCOUNT_MISSING',
  RCM_SGST_PAYABLE: 'VENDOR_ADJUSTMENT_RCM_ACCOUNT_MISSING',
  RCM_IGST_PAYABLE: 'VENDOR_ADJUSTMENT_RCM_ACCOUNT_MISSING',
  VENDOR_PAYABLE: 'VENDOR_ADJUSTMENT_PAYABLE_ACCOUNT_MISSING',
  FREIGHT: 'VENDOR_ADJUSTMENT_FREIGHT_ACCOUNT_MISSING',
  OTHER_CHARGE: 'VENDOR_ADJUSTMENT_CHARGE_ACCOUNT_MISSING',
  ROUND_OFF: 'VENDOR_ADJUSTMENT_ROUND_OFF_ACCOUNT_MISSING',
}

export function accountMissingErrorForComponent(component: string, message: string): VendorAdjustmentAccountMissingError {
  return new VendorAdjustmentAccountMissingError(
    ACCOUNT_COMPONENT_CODES[component] ?? 'VENDOR_ADJUSTMENT_DEBIT_ACCOUNT_MISSING',
    message,
  )
}

export function mapPostingErrorToVendorAdjustmentError(error: unknown): never {
  if (
    error instanceof VendorAdjustmentPostingError ||
    error instanceof VendorAdjustmentConcurrentPostError ||
    error instanceof VendorAdjustmentPostingInProgressError
  ) {
    throw error
  }
  if (error instanceof PostingError) {
    if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
      throw new VendorAdjustmentPostingPeriodClosedError(error.message)
    }
    if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
      throw new VendorAdjustmentPostingPeriodUnderReviewError(error.message)
    }
    if (error.code === 'NUMBER_SERIES_NOT_CONFIGURED' || error.code === 'NUMBER_SERIES_INACTIVE') {
      throw new VendorAdjustmentNumberSeriesMissingError(error.message)
    }
    if (error.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH') {
      throw new VendorAdjustmentPayloadMismatchError(error.message)
    }
    if (error.code === 'POSTING_EVENT_IN_PROGRESS' || error.code === 'POSTING_CONCURRENT_ACTION') {
      throw new VendorAdjustmentPostingInProgressError(error.message)
    }
    throw new VendorAdjustmentPostingFailedError(error.message)
  }
  if (error instanceof AppError) throw error
  throw new VendorAdjustmentPostingFailedError(error instanceof Error ? error.message : 'Vendor invoice posting failed')
}

export function mapPostingErrorToVendorAdjustmentReversalError(error: unknown): never {
  if (
    error instanceof VendorAdjustmentPostingError ||
    error instanceof VendorAdjustmentConcurrentPostError ||
    error instanceof VendorAdjustmentPostingInProgressError
  ) {
    throw error
  }
  if (error instanceof PostingError) {
    if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
      throw new VendorAdjustmentReversalPeriodClosedError(error.message)
    }
    if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
      throw new VendorAdjustmentReversalPeriodUnderReviewError(error.message)
    }
    if (error.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH') {
      throw new VendorAdjustmentPayloadMismatchError(error.message)
    }
    if (error.code === 'POSTING_EVENT_IN_PROGRESS' || error.code === 'POSTING_CONCURRENT_ACTION') {
      throw new VendorAdjustmentPostingInProgressError(error.message)
    }
    throw new VendorAdjustmentReversalFailedError(error.message)
  }
  if (error instanceof AppError) throw error
  throw new VendorAdjustmentReversalFailedError(error instanceof Error ? error.message : 'Vendor invoice reversal failed')
}
