import { AppError, ConflictError } from '../../../../../utils/errors.js'
import { PostingError } from '../../../posting/posting.errors.js'
import { VendorInvoiceError } from '../vendor-invoice.errors.js'

export class VendorInvoicePostingError extends VendorInvoiceError {
  constructor(statusCode: number, message: string, code: string, errors?: Array<{ field: string; message: string }>) {
    super(statusCode, message, code)
    this.name = 'VendorInvoicePostingError'
    if (errors) {
      Object.defineProperty(this, 'errors', { value: errors })
    }
  }
}

export class VendorInvoiceNotReadyToPostError extends VendorInvoicePostingError {
  constructor(message = 'Only READY_TO_POST vendor invoices can be posted') {
    super(422, message, 'VENDOR_INVOICE_NOT_READY_TO_POST')
  }
}

export class VendorInvoiceAlreadyPostedError extends VendorInvoicePostingError {
  constructor(message = 'Vendor invoice is already posted') {
    super(422, message, 'VENDOR_INVOICE_ALREADY_POSTED')
  }
}

export class VendorInvoicePostingNotAllowedError extends VendorInvoicePostingError {
  constructor(message = 'Missing permission: finance.ap.vendor_invoice.post') {
    super(403, message, 'VENDOR_INVOICE_POSTING_NOT_ALLOWED')
  }
}

export class VendorInvoiceChangedAfterReadyError extends VendorInvoicePostingError {
  constructor(message = 'Vendor invoice amounts changed after ready-to-post. Revise, revalidate, and mark ready again.') {
    super(422, message, 'VENDOR_INVOICE_CHANGED_AFTER_READY')
  }
}

export class VendorInvoiceCalculationVersionChangedError extends VendorInvoicePostingError {
  constructor(message = 'Vendor invoice calculation version is obsolete. Revise and revalidate before posting.') {
    super(422, message, 'VENDOR_INVOICE_CALCULATION_VERSION_CHANGED')
  }
}

export class VendorInvoiceAccountingPreviewChangedError extends VendorInvoicePostingError {
  constructor(message = 'Accounting preview changed after ready-to-post. Revise and revalidate before posting.') {
    super(422, message, 'VENDOR_INVOICE_ACCOUNTING_PREVIEW_CHANGED')
  }
}

export class VendorInvoiceApprovalIncompleteError extends VendorInvoicePostingError {
  constructor(message = 'Vendor invoice approval is incomplete or not approved') {
    super(422, message, 'VENDOR_INVOICE_APPROVAL_INCOMPLETE')
  }
}

export class VendorInvoiceApprovalMismatchError extends VendorInvoicePostingError {
  constructor(message = 'Approved amount or approval request does not match the current vendor invoice') {
    super(422, message, 'VENDOR_INVOICE_APPROVAL_MISMATCH')
  }
}

export class VendorInvoiceApprovalInvalidatedError extends VendorInvoicePostingError {
  constructor(message = 'Vendor invoice approval request is no longer valid for posting') {
    super(422, message, 'VENDOR_INVOICE_APPROVAL_INVALIDATED')
  }
}

export class VendorInvoiceUniquenessKeyMissingError extends VendorInvoicePostingError {
  constructor(message = 'Supplier invoice uniqueness key is missing') {
    super(422, message, 'VENDOR_INVOICE_UNIQUENESS_KEY_MISSING')
  }
}

export class VendorInvoiceVendorInactiveError extends VendorInvoicePostingError {
  constructor(message = 'Vendor is inactive or blocked and cannot be posted') {
    super(422, message, 'VENDOR_INVOICE_VENDOR_INACTIVE')
  }
}

export class VendorInvoicePostingPeriodClosedError extends VendorInvoicePostingError {
  constructor(message = 'Accounting period is closed for posting') {
    super(422, message, 'VENDOR_INVOICE_POSTING_PERIOD_CLOSED')
  }
}

export class VendorInvoicePostingPeriodUnderReviewError extends VendorInvoicePostingError {
  constructor(message = 'Accounting period is under review and cannot accept postings') {
    super(422, message, 'VENDOR_INVOICE_POSTING_PERIOD_UNDER_REVIEW')
  }
}

export class VendorInvoiceNumberSeriesMissingError extends VendorInvoicePostingError {
  constructor(message = 'Vendor invoice number series is not configured') {
    super(422, message, 'VENDOR_INVOICE_NUMBER_SERIES_MISSING')
  }
}

export class VendorInvoiceNumberAlreadyAssignedError extends VendorInvoicePostingError {
  constructor(message = 'Vendor invoice number is already assigned') {
    super(422, message, 'VENDOR_INVOICE_NUMBER_ALREADY_ASSIGNED')
  }
}

export class VendorInvoiceAccountMissingError extends VendorInvoicePostingError {
  constructor(code: string, message: string) {
    super(422, message, code)
  }
}

export class VendorInvoiceAccountingAlreadyLinkedError extends VendorInvoicePostingError {
  constructor(message = 'Vendor invoice is already linked to accounting records') {
    super(422, message, 'VENDOR_INVOICE_ACCOUNTING_ALREADY_LINKED')
  }
}

export class VendorInvoicePayableOpenItemAlreadyExistsError extends VendorInvoicePostingError {
  constructor(message = 'A payable open item already exists for this vendor invoice') {
    super(422, message, 'VENDOR_INVOICE_PAYABLE_OPEN_ITEM_ALREADY_EXISTS')
  }
}

export class VendorInvoicePayableOpenItemCreationFailedError extends VendorInvoicePostingError {
  constructor(message = 'Failed to create vendor payable open item') {
    super(500, message, 'VENDOR_INVOICE_PAYABLE_OPEN_ITEM_CREATION_FAILED')
  }
}

export class VendorInvoicePayableGlMismatchError extends VendorInvoicePostingError {
  constructor(message = 'Payable open-item amount does not match vendor payable GL credit') {
    super(500, message, 'VENDOR_INVOICE_PAYABLE_GL_MISMATCH')
  }
}

export class VendorInvoiceAccountingPreviewUnbalancedError extends VendorInvoicePostingError {
  constructor(message = 'Vendor invoice accounting preview is unbalanced') {
    super(422, message, 'VENDOR_INVOICE_ACCOUNTING_PREVIEW_UNBALANCED')
  }
}

export class VendorInvoiceBasePreviewUnbalancedError extends VendorInvoicePostingError {
  constructor(message = 'Vendor invoice base-currency accounting preview is unbalanced') {
    super(422, message, 'VENDOR_INVOICE_BASE_PREVIEW_UNBALANCED')
  }
}

export class VendorInvoicePayloadMismatchError extends VendorInvoicePostingError {
  constructor(message = 'PostingEvent payload hash does not match the current vendor invoice') {
    super(422, message, 'VENDOR_INVOICE_PAYLOAD_MISMATCH')
  }
}

export class VendorInvoicePostingInProgressError extends ConflictError {
  constructor(message = 'Vendor invoice posting is already in progress') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_INVOICE_POSTING_IN_PROGRESS' })
  }
}

export class VendorInvoiceConcurrentPostError extends ConflictError {
  constructor(message = 'Another user posted this vendor invoice concurrently. Refresh and retry if needed.') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_INVOICE_CONCURRENT_POST' })
  }
}

export class VendorInvoicePostingFailedError extends VendorInvoicePostingError {
  constructor(message = 'Vendor invoice posting failed') {
    super(500, message, 'VENDOR_INVOICE_POSTING_FAILED')
  }
}

// ─── Phase 4C1 — vendor invoice reversal (§62) ───────────────────────────────

export class VendorInvoiceReversalNotAllowedError extends VendorInvoicePostingError {
  constructor(message = 'Missing permission: finance.ap.vendor_invoice.reverse') {
    super(403, message, 'VENDOR_INVOICE_REVERSAL_NOT_ALLOWED')
  }
}

export class VendorInvoiceAlreadyReversedError extends VendorInvoicePostingError {
  constructor(message = 'Vendor invoice is already reversed') {
    super(422, message, 'VENDOR_INVOICE_ALREADY_REVERSED')
  }
}

export class VendorInvoiceActiveAllocationsExistError extends VendorInvoicePostingError {
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
      'VENDOR_INVOICE_ACTIVE_ALLOCATIONS_EXIST',
      allocations.map((a) => ({
        field: a.allocationLineId,
        message: `${a.allocationReference}: ${a.activeAmount}`,
      })),
    )
    this.name = 'VendorInvoiceActiveAllocationsExistError'
  }
}

export class VendorInvoiceOpenItemNotFullyRestoredError extends VendorInvoicePostingError {
  constructor(message = 'Invoice CREDIT open item is not fully restored before accounting reversal') {
    super(422, message, 'VENDOR_INVOICE_OPEN_ITEM_NOT_FULLY_RESTORED')
  }
}

export class VendorInvoiceOriginalVoucherMissingError extends VendorInvoicePostingError {
  constructor(message = 'Original accounting voucher is missing for invoice reversal') {
    super(422, message, 'VENDOR_INVOICE_ORIGINAL_VOUCHER_MISSING')
  }
}

export class VendorInvoiceOriginalPostingEventMissingError extends VendorInvoicePostingError {
  constructor(message = 'Original posting event is missing for invoice reversal') {
    super(422, message, 'VENDOR_INVOICE_ORIGINAL_POSTING_EVENT_MISSING')
  }
}

export class VendorInvoiceReversalPeriodClosedError extends VendorInvoicePostingError {
  constructor(message = 'Accounting period is closed for invoice reversal') {
    super(422, message, 'VENDOR_INVOICE_REVERSAL_PERIOD_CLOSED')
  }
}

export class VendorInvoiceReversalPeriodUnderReviewError extends VendorInvoicePostingError {
  constructor(message = 'Accounting period is under review for invoice reversal') {
    super(422, message, 'VENDOR_INVOICE_REVERSAL_PERIOD_UNDER_REVIEW')
  }
}

export class VendorInvoiceReversalDateInvalidError extends VendorInvoicePostingError {
  constructor(message = 'Invoice reversal date is invalid') {
    super(422, message, 'VENDOR_INVOICE_REVERSAL_DATE_INVALID')
  }
}

export class VendorInvoiceReversalNotPostedError extends VendorInvoicePostingError {
  constructor(message = 'Only POSTED vendor invoices can be reversed') {
    super(422, message, 'VENDOR_INVOICE_REVERSAL_NOT_ALLOWED')
  }
}

export class VendorInvoiceReversalEligibilityError extends VendorInvoicePostingError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'VENDOR_INVOICE_REVERSAL_NOT_ALLOWED', errors)
  }
}

export class VendorInvoiceReversalFailedError extends VendorInvoicePostingError {
  constructor(message = 'Vendor invoice reversal failed') {
    super(500, message, 'VENDOR_INVOICE_REVERSAL_FAILED')
  }
}

const ACCOUNT_COMPONENT_CODES: Record<string, string> = {
  LINE_DEBIT: 'VENDOR_INVOICE_DEBIT_ACCOUNT_MISSING',
  INPUT_CGST: 'VENDOR_INVOICE_INPUT_CGST_ACCOUNT_MISSING',
  INPUT_SGST: 'VENDOR_INVOICE_INPUT_SGST_ACCOUNT_MISSING',
  INPUT_IGST: 'VENDOR_INVOICE_INPUT_IGST_ACCOUNT_MISSING',
  INPUT_CESS: 'VENDOR_INVOICE_INPUT_CESS_ACCOUNT_MISSING',
  OTHER_RECOVERABLE_TAX: 'VENDOR_INVOICE_OTHER_TAX_ACCOUNT_MISSING',
  TDS_PAYABLE: 'VENDOR_INVOICE_TDS_ACCOUNT_MISSING',
  RCM_CGST_PAYABLE: 'VENDOR_INVOICE_RCM_ACCOUNT_MISSING',
  RCM_SGST_PAYABLE: 'VENDOR_INVOICE_RCM_ACCOUNT_MISSING',
  RCM_IGST_PAYABLE: 'VENDOR_INVOICE_RCM_ACCOUNT_MISSING',
  VENDOR_PAYABLE: 'VENDOR_INVOICE_PAYABLE_ACCOUNT_MISSING',
  FREIGHT: 'VENDOR_INVOICE_FREIGHT_ACCOUNT_MISSING',
  OTHER_CHARGE: 'VENDOR_INVOICE_CHARGE_ACCOUNT_MISSING',
  ROUND_OFF: 'VENDOR_INVOICE_ROUND_OFF_ACCOUNT_MISSING',
}

export function accountMissingErrorForComponent(component: string, message: string): VendorInvoiceAccountMissingError {
  return new VendorInvoiceAccountMissingError(
    ACCOUNT_COMPONENT_CODES[component] ?? 'VENDOR_INVOICE_DEBIT_ACCOUNT_MISSING',
    message,
  )
}

export function mapPostingErrorToVendorInvoiceError(error: unknown): never {
  if (
    error instanceof VendorInvoicePostingError ||
    error instanceof VendorInvoiceConcurrentPostError ||
    error instanceof VendorInvoicePostingInProgressError
  ) {
    throw error
  }
  if (error instanceof PostingError) {
    if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
      throw new VendorInvoicePostingPeriodClosedError(error.message)
    }
    if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
      throw new VendorInvoicePostingPeriodUnderReviewError(error.message)
    }
    if (error.code === 'NUMBER_SERIES_NOT_CONFIGURED' || error.code === 'NUMBER_SERIES_INACTIVE') {
      throw new VendorInvoiceNumberSeriesMissingError(error.message)
    }
    if (error.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH') {
      throw new VendorInvoicePayloadMismatchError(error.message)
    }
    if (error.code === 'POSTING_EVENT_IN_PROGRESS' || error.code === 'POSTING_CONCURRENT_ACTION') {
      throw new VendorInvoicePostingInProgressError(error.message)
    }
    throw new VendorInvoicePostingFailedError(error.message)
  }
  if (error instanceof AppError) throw error
  throw new VendorInvoicePostingFailedError(error instanceof Error ? error.message : 'Vendor invoice posting failed')
}

export function mapPostingErrorToVendorInvoiceReversalError(error: unknown): never {
  if (
    error instanceof VendorInvoicePostingError ||
    error instanceof VendorInvoiceConcurrentPostError ||
    error instanceof VendorInvoicePostingInProgressError
  ) {
    throw error
  }
  if (error instanceof PostingError) {
    if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
      throw new VendorInvoiceReversalPeriodClosedError(error.message)
    }
    if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
      throw new VendorInvoiceReversalPeriodUnderReviewError(error.message)
    }
    if (error.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH') {
      throw new VendorInvoicePayloadMismatchError(error.message)
    }
    if (error.code === 'POSTING_EVENT_IN_PROGRESS' || error.code === 'POSTING_CONCURRENT_ACTION') {
      throw new VendorInvoicePostingInProgressError(error.message)
    }
    throw new VendorInvoiceReversalFailedError(error.message)
  }
  if (error instanceof AppError) throw error
  throw new VendorInvoiceReversalFailedError(error instanceof Error ? error.message : 'Vendor invoice reversal failed')
}
