import { AppError, ConflictError, NotFoundError } from '../../../../utils/errors.js'
import { PostingError } from '../../posting/posting.errors.js'

export class TreasuryAdjustmentError extends AppError {
  constructor(statusCode: number, message: string, code: string, errors?: Array<{ field: string; message: string }>) {
    super(statusCode, message, code, errors)
    this.name = 'TreasuryAdjustmentError'
  }
}

export class TreasuryAdjustmentNotFoundError extends NotFoundError {
  constructor(message = 'Treasury adjustment not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_ADJUSTMENT_NOT_FOUND' })
  }
}

export class TreasuryAdjustmentStaleVersionError extends ConflictError {
  constructor(message = 'Treasury adjustment was changed by another user') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_ADJUSTMENT_STALE_VERSION' })
  }
}

export class TreasuryAdjustmentInvalidStatusError extends TreasuryAdjustmentError {
  constructor(message = 'Invalid treasury adjustment status for this action') {
    super(422, message, 'TREASURY_ADJUSTMENT_INVALID_STATUS')
  }
}

export class TreasuryAdjustmentValidationFailedError extends TreasuryAdjustmentError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'TREASURY_ADJUSTMENT_VALIDATION_FAILED', errors)
  }
}

export class TreasuryAdjustmentNotReadyError extends TreasuryAdjustmentError {
  constructor(message = 'Treasury adjustment failed validation and is not ready', errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'TREASURY_ADJUSTMENT_NOT_READY', errors)
  }
}

export class TreasuryAdjustmentEditNotAllowedError extends TreasuryAdjustmentError {
  constructor(message = 'Treasury adjustment cannot be edited in its current status') {
    super(422, message, 'TREASURY_ADJUSTMENT_EDIT_NOT_ALLOWED')
  }
}

export class TreasuryAdjustmentAccountNotFoundError extends NotFoundError {
  constructor(message = 'Treasury account not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_ADJUSTMENT_ACCOUNT_NOT_FOUND' })
  }
}

export class TreasuryAdjustmentAccountInactiveError extends TreasuryAdjustmentError {
  constructor(message = 'Treasury account is not active') {
    super(422, message, 'TREASURY_ADJUSTMENT_ACCOUNT_INACTIVE')
  }
}

export class TreasuryAdjustmentLineAccountInvalidError extends TreasuryAdjustmentError {
  constructor(message = 'One or more offset line GL accounts are invalid for posting') {
    super(422, message, 'TREASURY_ADJUSTMENT_LINE_ACCOUNT_INVALID')
  }
}

export class TreasuryAdjustmentMappingKeyUnresolvedError extends TreasuryAdjustmentError {
  constructor(message = 'No default account mapping is configured for the requested mapping key') {
    super(422, message, 'TREASURY_ADJUSTMENT_MAPPING_KEY_UNRESOLVED')
  }
}

export class TreasuryAdjustmentApprovalRequiredError extends TreasuryAdjustmentError {
  constructor(message = 'An approved approval request is required') {
    super(422, message, 'TREASURY_ADJUSTMENT_APPROVAL_REQUIRED')
  }
}

export class TreasuryAdjustmentApprovalIncompleteError extends TreasuryAdjustmentError {
  constructor(message = 'Treasury adjustment approval is incomplete or not approved') {
    super(422, message, 'TREASURY_ADJUSTMENT_APPROVAL_INCOMPLETE')
  }
}

export class TreasuryAdjustmentSelfApproveNotAllowedError extends TreasuryAdjustmentError {
  constructor(message = 'The submitter cannot approve their own treasury adjustment') {
    super(422, message, 'TREASURY_ADJUSTMENT_SELF_APPROVE_NOT_ALLOWED')
  }
}

export class TreasuryAdjustmentNotReadyToPostError extends TreasuryAdjustmentError {
  constructor(message = 'Only READY_TO_POST treasury adjustments can be posted') {
    super(422, message, 'TREASURY_ADJUSTMENT_NOT_READY_TO_POST')
  }
}

export class TreasuryAdjustmentAlreadyPostedError extends TreasuryAdjustmentError {
  constructor(message = 'Treasury adjustment is already posted') {
    super(422, message, 'TREASURY_ADJUSTMENT_ALREADY_POSTED')
  }
}

export class TreasuryAdjustmentAccountingAlreadyLinkedError extends TreasuryAdjustmentError {
  constructor(message = 'Treasury adjustment is already linked to accounting records') {
    super(422, message, 'TREASURY_ADJUSTMENT_ACCOUNTING_ALREADY_LINKED')
  }
}

export class TreasuryAdjustmentNumberSeriesMissingError extends TreasuryAdjustmentError {
  constructor(message = 'Treasury adjustment number series is not configured') {
    super(422, message, 'TREASURY_ADJUSTMENT_NUMBER_SERIES_MISSING')
  }
}

export class TreasuryAdjustmentConcurrentPostError extends ConflictError {
  constructor(message = 'Another user modified this treasury adjustment concurrently. Refresh and retry.') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_ADJUSTMENT_CONCURRENT_POST' })
  }
}

export class TreasuryAdjustmentPostingInProgressError extends ConflictError {
  constructor(message = 'Treasury adjustment posting is already in progress') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_ADJUSTMENT_POSTING_IN_PROGRESS' })
  }
}

export class TreasuryAdjustmentPostingPeriodClosedError extends TreasuryAdjustmentError {
  constructor(message = 'Accounting period is closed for posting') {
    super(422, message, 'TREASURY_ADJUSTMENT_POSTING_PERIOD_CLOSED')
  }
}

export class TreasuryAdjustmentPostingPeriodUnderReviewError extends TreasuryAdjustmentError {
  constructor(message = 'Accounting period is under review and cannot accept postings') {
    super(422, message, 'TREASURY_ADJUSTMENT_POSTING_PERIOD_UNDER_REVIEW')
  }
}

export class TreasuryAdjustmentPostingFailedError extends TreasuryAdjustmentError {
  constructor(message = 'Treasury adjustment posting failed') {
    super(500, message, 'TREASURY_ADJUSTMENT_POSTING_FAILED')
  }
}

export class TreasuryAdjustmentReversalNotAllowedError extends TreasuryAdjustmentError {
  constructor(message = 'Missing permission for this reversal action') {
    super(403, message, 'TREASURY_ADJUSTMENT_REVERSAL_NOT_ALLOWED')
  }
}

export class TreasuryAdjustmentReversalNotEligibleError extends TreasuryAdjustmentError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'TREASURY_ADJUSTMENT_REVERSAL_NOT_ELIGIBLE', errors)
  }
}

export class TreasuryAdjustmentActiveReconciliationMatchError extends TreasuryAdjustmentError {
  constructor(message = 'Treasury adjustment has an active bank reconciliation match and cannot be reversed') {
    super(422, message, 'TREASURY_ADJUSTMENT_ACTIVE_RECONCILIATION_MATCH')
  }
}

export class TreasuryAdjustmentAlreadyReversedError extends TreasuryAdjustmentError {
  constructor(message = 'Treasury adjustment is already reversed') {
    super(422, message, 'TREASURY_ADJUSTMENT_ALREADY_REVERSED')
  }
}

export class TreasuryAdjustmentReversalFailedError extends TreasuryAdjustmentError {
  constructor(message = 'Treasury adjustment reversal failed') {
    super(500, message, 'TREASURY_ADJUSTMENT_REVERSAL_FAILED')
  }
}

export class TreasuryAdjustmentStatementLineAlreadyLinkedError extends ConflictError {
  constructor(message = 'This bank statement line is already linked to a treasury adjustment') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_ADJUSTMENT_STATEMENT_LINE_ALREADY_LINKED' })
  }
}

/** FinanceSettings.useTreasuryAdjustmentsForStatementItems === false */
export class TreasuryAdjustmentStatementPathDisabledError extends TreasuryAdjustmentError {
  constructor(
    message = 'Statement-led treasury adjustments are disabled for this legal entity. Use the legacy create-journal-draft path or enable useTreasuryAdjustmentsForStatementItems in Finance Settings.',
  ) {
    super(422, message, 'TREASURY_ADJUSTMENT_STATEMENT_PATH_DISABLED')
  }
}

export class TreasuryAdjustmentStatementMatchFailedError extends TreasuryAdjustmentError {
  constructor(message = 'Posting succeeded but statement reconciliation match failed and was rolled back') {
    super(422, message, 'TREASURY_ADJUSTMENT_STATEMENT_MATCH_FAILED')
  }
}

export function mapPostingErrorToTreasuryAdjustmentError(error: unknown): never {
  if (
    error instanceof TreasuryAdjustmentError ||
    error instanceof TreasuryAdjustmentConcurrentPostError ||
    error instanceof TreasuryAdjustmentPostingInProgressError
  ) {
    throw error
  }
  if (error instanceof PostingError) {
    if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
      throw new TreasuryAdjustmentPostingPeriodClosedError(error.message)
    }
    if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
      throw new TreasuryAdjustmentPostingPeriodUnderReviewError(error.message)
    }
    if (error.code === 'NUMBER_SERIES_NOT_CONFIGURED' || error.code === 'NUMBER_SERIES_INACTIVE') {
      throw new TreasuryAdjustmentNumberSeriesMissingError(error.message)
    }
    if (error.code === 'POSTING_EVENT_IN_PROGRESS' || error.code === 'POSTING_CONCURRENT_ACTION') {
      throw new TreasuryAdjustmentPostingInProgressError(error.message)
    }
    throw new TreasuryAdjustmentPostingFailedError(error.message)
  }
  if (error instanceof AppError) throw error
  throw new TreasuryAdjustmentPostingFailedError(error instanceof Error ? error.message : 'Treasury adjustment posting failed')
}

export function mapPostingErrorToTreasuryAdjustmentReversalError(error: unknown): never {
  if (
    error instanceof TreasuryAdjustmentError ||
    error instanceof TreasuryAdjustmentConcurrentPostError ||
    error instanceof TreasuryAdjustmentPostingInProgressError
  ) {
    throw error
  }
  if (error instanceof PostingError) {
    if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
      throw new TreasuryAdjustmentPostingPeriodClosedError(error.message)
    }
    if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
      throw new TreasuryAdjustmentPostingPeriodUnderReviewError(error.message)
    }
    if (error.code === 'POSTING_EVENT_IN_PROGRESS' || error.code === 'POSTING_CONCURRENT_ACTION') {
      throw new TreasuryAdjustmentPostingInProgressError(error.message)
    }
    throw new TreasuryAdjustmentReversalFailedError(error.message)
  }
  if (error instanceof AppError) throw error
  throw new TreasuryAdjustmentReversalFailedError(error instanceof Error ? error.message : 'Treasury adjustment reversal failed')
}
