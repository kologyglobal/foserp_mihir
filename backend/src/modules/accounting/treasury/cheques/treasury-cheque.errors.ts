import { AppError, ConflictError, NotFoundError } from '../../../../utils/errors.js'
import { PostingError } from '../../posting/posting.errors.js'

export class TreasuryChequeError extends AppError {
  constructor(statusCode: number, message: string, code: string, errors?: Array<{ field: string; message: string }>) {
    super(statusCode, message, code, errors)
    this.name = 'TreasuryChequeError'
  }
}

export class TreasuryChequeNotFoundError extends NotFoundError {
  constructor(message = 'Treasury cheque not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_CHEQUE_NOT_FOUND' })
  }
}

export class TreasuryChequeStaleVersionError extends ConflictError {
  constructor(message = 'Treasury cheque was changed by another user') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_CHEQUE_STALE_VERSION' })
  }
}

export class TreasuryChequeInvalidStatusError extends TreasuryChequeError {
  constructor(message = 'Invalid treasury cheque status for this action') {
    super(422, message, 'TREASURY_CHEQUE_INVALID_STATUS')
  }
}

export class TreasuryChequeValidationFailedError extends TreasuryChequeError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'TREASURY_CHEQUE_VALIDATION_FAILED', errors)
  }
}

export class TreasuryChequeNotReadyError extends TreasuryChequeError {
  constructor(message = 'Treasury cheque failed validation and is not ready', errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'TREASURY_CHEQUE_NOT_READY', errors)
  }
}

export class TreasuryChequeEditNotAllowedError extends TreasuryChequeError {
  constructor(message = 'Treasury cheque cannot be edited in its current status') {
    super(422, message, 'TREASURY_CHEQUE_EDIT_NOT_ALLOWED')
  }
}

export class TreasuryChequeAccountNotFoundError extends NotFoundError {
  constructor(message = 'Treasury account not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_CHEQUE_ACCOUNT_NOT_FOUND' })
  }
}

export class TreasuryChequeAccountTypeNotSupportedError extends TreasuryChequeError {
  constructor(message = 'Only BANK treasury accounts can be used for cheque management') {
    super(422, message, 'TREASURY_CHEQUE_ACCOUNT_TYPE_NOT_SUPPORTED')
  }
}

export class TreasuryChequeAccountInactiveError extends TreasuryChequeError {
  constructor(message = 'Treasury account is not active') {
    super(422, message, 'TREASURY_CHEQUE_ACCOUNT_INACTIVE')
  }
}

export class TreasuryChequeCounterpartAccountMissingError extends TreasuryChequeError {
  constructor(message = 'No counterpart GL account is configured for this cheque direction') {
    super(422, message, 'TREASURY_CHEQUE_COUNTERPART_ACCOUNT_MISSING')
  }
}

export class TreasuryChequeCounterpartAccountInvalidError extends TreasuryChequeError {
  constructor(message = 'Counterpart GL account is invalid for posting') {
    super(422, message, 'TREASURY_CHEQUE_COUNTERPART_ACCOUNT_INVALID')
  }
}

export class TreasuryChequeDuplicateError extends ConflictError {
  constructor(message = 'A cheque with the same number, direction, and date is already active') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_CHEQUE_DUPLICATE' })
  }
}

export class TreasuryChequeApprovalRequiredError extends TreasuryChequeError {
  constructor(message = 'An approved approval request is required') {
    super(422, message, 'TREASURY_CHEQUE_APPROVAL_REQUIRED')
  }
}

export class TreasuryChequeApprovalIncompleteError extends TreasuryChequeError {
  constructor(message = 'Treasury cheque approval is incomplete or not approved') {
    super(422, message, 'TREASURY_CHEQUE_APPROVAL_INCOMPLETE')
  }
}

export class TreasuryChequeSelfApproveNotAllowedError extends TreasuryChequeError {
  constructor(message = 'The submitter cannot approve their own treasury cheque') {
    super(422, message, 'TREASURY_CHEQUE_SELF_APPROVE_NOT_ALLOWED')
  }
}

export class TreasuryChequeNotReadyToPostError extends TreasuryChequeError {
  constructor(message = 'Only READY treasury cheques can be issued or deposited') {
    super(422, message, 'TREASURY_CHEQUE_NOT_READY_TO_POST')
  }
}

export class TreasuryChequeWrongDirectionError extends TreasuryChequeError {
  constructor(message = 'This action does not match the treasury cheque direction') {
    super(422, message, 'TREASURY_CHEQUE_WRONG_DIRECTION')
  }
}

export class TreasuryChequeInvalidLifecycleActionError extends TreasuryChequeError {
  constructor(message = 'This lifecycle action is not allowed for the current cheque status') {
    super(422, message, 'TREASURY_CHEQUE_INVALID_LIFECYCLE_ACTION')
  }
}

export class TreasuryChequeAlreadyPostedError extends TreasuryChequeError {
  constructor(message = 'Treasury cheque is already issued/deposited') {
    super(422, message, 'TREASURY_CHEQUE_ALREADY_POSTED')
  }
}

export class TreasuryChequeAccountingAlreadyLinkedError extends TreasuryChequeError {
  constructor(message = 'Treasury cheque is already linked to accounting records') {
    super(422, message, 'TREASURY_CHEQUE_ACCOUNTING_ALREADY_LINKED')
  }
}

export class TreasuryChequeNumberSeriesMissingError extends TreasuryChequeError {
  constructor(message = 'Treasury cheque number series is not configured') {
    super(422, message, 'TREASURY_CHEQUE_NUMBER_SERIES_MISSING')
  }
}

export class TreasuryChequeConcurrentPostError extends ConflictError {
  constructor(message = 'Another user modified this treasury cheque concurrently. Refresh and retry.') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_CHEQUE_CONCURRENT_POST' })
  }
}

export class TreasuryChequePostingInProgressError extends ConflictError {
  constructor(message = 'Treasury cheque posting is already in progress') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_CHEQUE_POSTING_IN_PROGRESS' })
  }
}

export class TreasuryChequePostingPeriodClosedError extends TreasuryChequeError {
  constructor(message = 'Accounting period is closed for posting') {
    super(422, message, 'TREASURY_CHEQUE_POSTING_PERIOD_CLOSED')
  }
}

export class TreasuryChequePostingPeriodUnderReviewError extends TreasuryChequeError {
  constructor(message = 'Accounting period is under review and cannot accept postings') {
    super(422, message, 'TREASURY_CHEQUE_POSTING_PERIOD_UNDER_REVIEW')
  }
}

export class TreasuryChequePostingFailedError extends TreasuryChequeError {
  constructor(message = 'Treasury cheque posting failed') {
    super(500, message, 'TREASURY_CHEQUE_POSTING_FAILED')
  }
}

export class TreasuryChequeReversalNotAllowedError extends TreasuryChequeError {
  constructor(message = 'Missing permission for this reversal action') {
    super(403, message, 'TREASURY_CHEQUE_REVERSAL_NOT_ALLOWED')
  }
}

export class TreasuryChequeReversalNotEligibleError extends TreasuryChequeError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'TREASURY_CHEQUE_REVERSAL_NOT_ELIGIBLE', errors)
  }
}

export class TreasuryChequeAlreadyReversedError extends TreasuryChequeError {
  constructor(message = 'Treasury cheque is already reversed') {
    super(422, message, 'TREASURY_CHEQUE_ALREADY_REVERSED')
  }
}

export class TreasuryChequeReversalFailedError extends TreasuryChequeError {
  constructor(message = 'Treasury cheque reversal failed') {
    super(500, message, 'TREASURY_CHEQUE_REVERSAL_FAILED')
  }
}

export function mapPostingErrorToTreasuryChequeError(error: unknown): never {
  if (
    error instanceof TreasuryChequeError ||
    error instanceof TreasuryChequeConcurrentPostError ||
    error instanceof TreasuryChequePostingInProgressError
  ) {
    throw error
  }
  if (error instanceof PostingError) {
    if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
      throw new TreasuryChequePostingPeriodClosedError(error.message)
    }
    if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
      throw new TreasuryChequePostingPeriodUnderReviewError(error.message)
    }
    if (error.code === 'NUMBER_SERIES_NOT_CONFIGURED' || error.code === 'NUMBER_SERIES_INACTIVE') {
      throw new TreasuryChequeNumberSeriesMissingError(error.message)
    }
    if (error.code === 'POSTING_EVENT_IN_PROGRESS' || error.code === 'POSTING_CONCURRENT_ACTION') {
      throw new TreasuryChequePostingInProgressError(error.message)
    }
    throw new TreasuryChequePostingFailedError(error.message)
  }
  if (error instanceof AppError) throw error
  throw new TreasuryChequePostingFailedError(error instanceof Error ? error.message : 'Treasury cheque posting failed')
}

export function mapPostingErrorToTreasuryChequeReversalError(error: unknown): never {
  if (
    error instanceof TreasuryChequeError ||
    error instanceof TreasuryChequeConcurrentPostError ||
    error instanceof TreasuryChequePostingInProgressError
  ) {
    throw error
  }
  if (error instanceof PostingError) {
    if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
      throw new TreasuryChequePostingPeriodClosedError(error.message)
    }
    if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
      throw new TreasuryChequePostingPeriodUnderReviewError(error.message)
    }
    if (error.code === 'POSTING_EVENT_IN_PROGRESS' || error.code === 'POSTING_CONCURRENT_ACTION') {
      throw new TreasuryChequePostingInProgressError(error.message)
    }
    throw new TreasuryChequeReversalFailedError(error.message)
  }
  if (error instanceof AppError) throw error
  throw new TreasuryChequeReversalFailedError(error instanceof Error ? error.message : 'Treasury cheque reversal failed')
}
