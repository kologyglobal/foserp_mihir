import { AppError, ConflictError, NotFoundError } from '../../../../utils/errors.js'
import { PostingError } from '../../posting/posting.errors.js'

export class TreasuryTransferError extends AppError {
  constructor(statusCode: number, message: string, code: string, errors?: Array<{ field: string; message: string }>) {
    super(statusCode, message, code, errors)
    this.name = 'TreasuryTransferError'
  }
}

export class TreasuryTransferNotFoundError extends NotFoundError {
  constructor(message = 'Treasury transfer not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_TRANSFER_NOT_FOUND' })
  }
}

export class TreasuryTransferStaleVersionError extends ConflictError {
  constructor(message = 'Treasury transfer was changed by another user') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_TRANSFER_STALE_VERSION' })
  }
}

export class TreasuryTransferInvalidStatusError extends TreasuryTransferError {
  constructor(message = 'Invalid treasury transfer status for this action') {
    super(422, message, 'TREASURY_TRANSFER_INVALID_STATUS')
  }
}

export class TreasuryTransferValidationFailedError extends TreasuryTransferError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'TREASURY_TRANSFER_VALIDATION_FAILED', errors)
  }
}

export class TreasuryTransferNotReadyError extends TreasuryTransferError {
  constructor(message = 'Treasury transfer failed validation and is not ready', errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'TREASURY_TRANSFER_NOT_READY', errors)
  }
}

export class TreasuryTransferEditNotAllowedError extends TreasuryTransferError {
  constructor(message = 'Treasury transfer cannot be edited in its current status') {
    super(422, message, 'TREASURY_TRANSFER_EDIT_NOT_ALLOWED')
  }
}

export class TreasuryTransferAccountNotFoundError extends NotFoundError {
  constructor(message = 'Treasury account not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_TRANSFER_ACCOUNT_NOT_FOUND' })
  }
}

export class TreasuryTransferSameAccountError extends TreasuryTransferError {
  constructor(message = 'Source and destination treasury accounts must be different') {
    super(422, message, 'TREASURY_TRANSFER_SAME_ACCOUNT')
  }
}

export class TreasuryTransferAccountTypeNotSupportedError extends TreasuryTransferError {
  constructor(message = 'Only BANK and CASH treasury accounts can be used for internal transfers') {
    super(422, message, 'TREASURY_TRANSFER_ACCOUNT_TYPE_NOT_SUPPORTED')
  }
}

export class TreasuryTransferAccountInactiveError extends TreasuryTransferError {
  constructor(message = 'Treasury account is not active') {
    super(422, message, 'TREASURY_TRANSFER_ACCOUNT_INACTIVE')
  }
}

export class TreasuryTransferDifferentLegalEntityError extends TreasuryTransferError {
  constructor(message = 'Source and destination treasury accounts must belong to the same legal entity') {
    super(422, message, 'TREASURY_TRANSFER_DIFFERENT_LEGAL_ENTITY')
  }
}

export class TreasuryTransferCurrencyMismatchError extends TreasuryTransferError {
  constructor(message = 'Source and destination treasury accounts must share the transfer currency') {
    super(422, message, 'TREASURY_TRANSFER_CURRENCY_MISMATCH')
  }
}

export class TreasuryTransferClearingAccountMissingError extends TreasuryTransferError {
  constructor(message = 'No in-transit clearing GL account is configured for this legal entity/currency') {
    super(422, message, 'TREASURY_TRANSFER_CLEARING_ACCOUNT_MISSING')
  }
}

export class TreasuryTransferInTransitRequiredError extends TreasuryTransferError {
  constructor(message = 'This transfer requires IN_TRANSIT posting mode') {
    super(422, message, 'TREASURY_TRANSFER_IN_TRANSIT_REQUIRED')
  }
}

export class TreasuryTransferBalanceBlockedError extends TreasuryTransferError {
  constructor(message = 'Transfer amount exceeds available source balance') {
    super(422, message, 'TREASURY_TRANSFER_BALANCE_BLOCKED')
  }
}

export class TreasuryTransferApprovalRequiredError extends TreasuryTransferError {
  constructor(message = 'An approved approval request is required') {
    super(422, message, 'TREASURY_TRANSFER_APPROVAL_REQUIRED')
  }
}

export class TreasuryTransferApprovalIncompleteError extends TreasuryTransferError {
  constructor(message = 'Treasury transfer approval is incomplete or not approved') {
    super(422, message, 'TREASURY_TRANSFER_APPROVAL_INCOMPLETE')
  }
}

export class TreasuryTransferSelfApproveNotAllowedError extends TreasuryTransferError {
  constructor(message = 'The submitter cannot approve their own treasury transfer') {
    super(422, message, 'TREASURY_TRANSFER_SELF_APPROVE_NOT_ALLOWED')
  }
}

export class TreasuryTransferDispatcherReceiveNotAllowedError extends TreasuryTransferError {
  constructor(message = 'The dispatching user cannot confirm receipt of this treasury transfer') {
    super(422, message, 'TREASURY_TRANSFER_DISPATCHER_RECEIVE_NOT_ALLOWED')
  }
}

export class TreasuryTransferNotReadyToPostError extends TreasuryTransferError {
  constructor(message = 'Only READY_TO_POST treasury transfers can be posted') {
    super(422, message, 'TREASURY_TRANSFER_NOT_READY_TO_POST')
  }
}

export class TreasuryTransferWrongPostingModeError extends TreasuryTransferError {
  constructor(message = 'This action does not match the treasury transfer posting mode') {
    super(422, message, 'TREASURY_TRANSFER_WRONG_POSTING_MODE')
  }
}

export class TreasuryTransferNotInTransitError extends TreasuryTransferError {
  constructor(message = 'Only IN_TRANSIT treasury transfers can be received') {
    super(422, message, 'TREASURY_TRANSFER_NOT_IN_TRANSIT')
  }
}

export class TreasuryTransferAlreadyPostedError extends TreasuryTransferError {
  constructor(message = 'Treasury transfer is already posted') {
    super(422, message, 'TREASURY_TRANSFER_ALREADY_POSTED')
  }
}

export class TreasuryTransferAccountingAlreadyLinkedError extends TreasuryTransferError {
  constructor(message = 'Treasury transfer is already linked to accounting records') {
    super(422, message, 'TREASURY_TRANSFER_ACCOUNTING_ALREADY_LINKED')
  }
}

export class TreasuryTransferNumberSeriesMissingError extends TreasuryTransferError {
  constructor(message = 'Treasury transfer number series is not configured') {
    super(422, message, 'TREASURY_TRANSFER_NUMBER_SERIES_MISSING')
  }
}

export class TreasuryTransferConcurrentPostError extends ConflictError {
  constructor(message = 'Another user modified this treasury transfer concurrently. Refresh and retry.') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_TRANSFER_CONCURRENT_POST' })
  }
}

export class TreasuryTransferPostingInProgressError extends ConflictError {
  constructor(message = 'Treasury transfer posting is already in progress') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_TRANSFER_POSTING_IN_PROGRESS' })
  }
}

export class TreasuryTransferPostingPeriodClosedError extends TreasuryTransferError {
  constructor(message = 'Accounting period is closed for posting') {
    super(422, message, 'TREASURY_TRANSFER_POSTING_PERIOD_CLOSED')
  }
}

export class TreasuryTransferPostingPeriodUnderReviewError extends TreasuryTransferError {
  constructor(message = 'Accounting period is under review and cannot accept postings') {
    super(422, message, 'TREASURY_TRANSFER_POSTING_PERIOD_UNDER_REVIEW')
  }
}

export class TreasuryTransferPostingFailedError extends TreasuryTransferError {
  constructor(message = 'Treasury transfer posting failed') {
    super(500, message, 'TREASURY_TRANSFER_POSTING_FAILED')
  }
}

export class TreasuryTransferReversalNotAllowedError extends TreasuryTransferError {
  constructor(message = 'Missing permission: finance.treasury.transfer.reverse') {
    super(403, message, 'TREASURY_TRANSFER_REVERSAL_NOT_ALLOWED')
  }
}

export class TreasuryTransferReversalNotEligibleError extends TreasuryTransferError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'TREASURY_TRANSFER_REVERSAL_NOT_ELIGIBLE', errors)
  }
}

export class TreasuryTransferReversalBankReconLockError extends TreasuryTransferError {
  constructor(message = 'An active bank reconciliation match exists on this transfer\u2019s ledger entries. Unmatch first.') {
    super(422, message, 'TREASURY_TRANSFER_RECONCILIATION_LOCK')
  }
}

export class TreasuryTransferAlreadyReversedError extends TreasuryTransferError {
  constructor(message = 'Treasury transfer is already reversed') {
    super(422, message, 'TREASURY_TRANSFER_ALREADY_REVERSED')
  }
}

export class TreasuryTransferReversalFailedError extends TreasuryTransferError {
  constructor(message = 'Treasury transfer reversal failed') {
    super(500, message, 'TREASURY_TRANSFER_REVERSAL_FAILED')
  }
}

export function mapPostingErrorToTreasuryTransferError(error: unknown): never {
  if (error instanceof TreasuryTransferError || error instanceof TreasuryTransferConcurrentPostError || error instanceof TreasuryTransferPostingInProgressError) {
    throw error
  }
  if (error instanceof PostingError) {
    if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
      throw new TreasuryTransferPostingPeriodClosedError(error.message)
    }
    if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
      throw new TreasuryTransferPostingPeriodUnderReviewError(error.message)
    }
    if (error.code === 'NUMBER_SERIES_NOT_CONFIGURED' || error.code === 'NUMBER_SERIES_INACTIVE') {
      throw new TreasuryTransferNumberSeriesMissingError(error.message)
    }
    if (error.code === 'POSTING_EVENT_IN_PROGRESS' || error.code === 'POSTING_CONCURRENT_ACTION') {
      throw new TreasuryTransferPostingInProgressError(error.message)
    }
    throw new TreasuryTransferPostingFailedError(error.message)
  }
  if (error instanceof AppError) throw error
  throw new TreasuryTransferPostingFailedError(error instanceof Error ? error.message : 'Treasury transfer posting failed')
}

export function mapPostingErrorToTreasuryTransferReversalError(error: unknown): never {
  if (error instanceof TreasuryTransferError || error instanceof TreasuryTransferConcurrentPostError || error instanceof TreasuryTransferPostingInProgressError) {
    throw error
  }
  if (error instanceof PostingError) {
    if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
      throw new TreasuryTransferPostingPeriodClosedError(error.message)
    }
    if (error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW') {
      throw new TreasuryTransferPostingPeriodUnderReviewError(error.message)
    }
    if (error.code === 'POSTING_EVENT_IN_PROGRESS' || error.code === 'POSTING_CONCURRENT_ACTION') {
      throw new TreasuryTransferPostingInProgressError(error.message)
    }
    throw new TreasuryTransferReversalFailedError(error.message)
  }
  if (error instanceof AppError) throw error
  throw new TreasuryTransferReversalFailedError(error instanceof Error ? error.message : 'Treasury transfer reversal failed')
}
