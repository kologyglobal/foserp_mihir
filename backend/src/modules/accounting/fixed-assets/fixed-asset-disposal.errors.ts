import { AppError, ConflictError, NotFoundError } from '../../../utils/errors.js'
import { PostingError } from '../posting/posting.errors.js'

export class FixedAssetDisposalError extends AppError {
  constructor(statusCode: number, message: string, code: string, errors?: Array<{ field: string; message: string }>) {
    super(statusCode, message, code, errors)
    this.name = 'FixedAssetDisposalError'
  }
}

export class FixedAssetDisposalNotFoundError extends NotFoundError {
  constructor(message = 'Fixed asset disposal not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'FIXED_ASSET_DISPOSAL_NOT_FOUND' })
  }
}

export class FixedAssetDisposalStaleVersionError extends ConflictError {
  constructor(message = 'Fixed asset disposal was changed by another user') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'FIXED_ASSET_DISPOSAL_STALE_VERSION' })
  }
}

export class FixedAssetDisposalInvalidStatusError extends FixedAssetDisposalError {
  constructor(message = 'Invalid fixed asset disposal status for this action') {
    super(422, message, 'FIXED_ASSET_DISPOSAL_INVALID_STATUS')
  }
}

export class FixedAssetDisposalValidationFailedError extends FixedAssetDisposalError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'FIXED_ASSET_DISPOSAL_VALIDATION_FAILED', errors)
  }
}

export class FixedAssetDisposalNotReadyError extends FixedAssetDisposalError {
  constructor(message = 'Fixed asset disposal failed validation and is not ready', errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'FIXED_ASSET_DISPOSAL_NOT_READY', errors)
  }
}

export class FixedAssetDisposalEditNotAllowedError extends FixedAssetDisposalError {
  constructor(message = 'Fixed asset disposal cannot be edited in its current status') {
    super(422, message, 'FIXED_ASSET_DISPOSAL_EDIT_NOT_ALLOWED')
  }
}

export class FixedAssetDisposalOpenExistsError extends FixedAssetDisposalError {
  constructor(message = 'An open disposal document already exists for this asset') {
    super(422, message, 'FIXED_ASSET_DISPOSAL_OPEN_EXISTS')
  }
}

export class FixedAssetDisposalApprovalRequiredError extends FixedAssetDisposalError {
  constructor(message = 'An approved approval request is required') {
    super(422, message, 'FIXED_ASSET_DISPOSAL_APPROVAL_REQUIRED')
  }
}

export class FixedAssetDisposalReversalNotAllowedError extends FixedAssetDisposalError {
  constructor(message = 'Missing permission for this reversal action') {
    super(403, message, 'FIXED_ASSET_DISPOSAL_REVERSAL_NOT_ALLOWED')
  }
}

export class FixedAssetDisposalReversalNotEligibleError extends FixedAssetDisposalError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'FIXED_ASSET_DISPOSAL_REVERSAL_NOT_ELIGIBLE', errors)
  }
}

export class FixedAssetDisposalActiveReconciliationMatchError extends FixedAssetDisposalError {
  constructor(message = 'Fixed asset disposal voucher has an active bank reconciliation match and cannot be reversed') {
    super(422, message, 'FIXED_ASSET_DISPOSAL_ACTIVE_RECONCILIATION_MATCH')
  }
}

export class FixedAssetDisposalConcurrentPostError extends ConflictError {
  constructor(message = 'Another user modified this fixed asset disposal concurrently. Refresh and retry.') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'FIXED_ASSET_DISPOSAL_CONCURRENT_POST' })
  }
}

export class FixedAssetDisposalPostingPeriodClosedError extends FixedAssetDisposalError {
  constructor(message = 'Accounting period is closed for posting') {
    super(422, message, 'FIXED_ASSET_DISPOSAL_POSTING_PERIOD_CLOSED')
  }
}

export class FixedAssetDisposalNumberSeriesMissingError extends FixedAssetDisposalError {
  constructor(message = 'Journal number series is not configured') {
    super(422, message, 'FIXED_ASSET_DISPOSAL_NUMBER_SERIES_MISSING')
  }
}

export class FixedAssetDisposalPostingInProgressError extends ConflictError {
  constructor(message = 'Fixed asset disposal posting is already in progress') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'FIXED_ASSET_DISPOSAL_POSTING_IN_PROGRESS' })
  }
}

export class FixedAssetDisposalPostingFailedError extends FixedAssetDisposalError {
  constructor(message = 'Fixed asset disposal posting failed') {
    super(500, message, 'FIXED_ASSET_DISPOSAL_POSTING_FAILED')
  }
}

export class FixedAssetDisposalReversalFailedError extends FixedAssetDisposalError {
  constructor(message = 'Fixed asset disposal reversal failed') {
    super(500, message, 'FIXED_ASSET_DISPOSAL_REVERSAL_FAILED')
  }
}

export function mapPostingErrorToFixedAssetDisposalError(error: unknown): never {
  if (
    error instanceof FixedAssetDisposalError ||
    error instanceof FixedAssetDisposalConcurrentPostError ||
    error instanceof FixedAssetDisposalPostingInProgressError
  ) {
    throw error
  }
  if (error instanceof PostingError) {
    if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
      throw new FixedAssetDisposalPostingPeriodClosedError(error.message)
    }
    if (error.code === 'NUMBER_SERIES_NOT_CONFIGURED' || error.code === 'NUMBER_SERIES_INACTIVE') {
      throw new FixedAssetDisposalNumberSeriesMissingError(error.message)
    }
    if (error.code === 'POSTING_EVENT_IN_PROGRESS' || error.code === 'POSTING_CONCURRENT_ACTION') {
      throw new FixedAssetDisposalPostingInProgressError(error.message)
    }
    throw new FixedAssetDisposalPostingFailedError(error.message)
  }
  if (error instanceof AppError) throw error
  throw new FixedAssetDisposalPostingFailedError(error instanceof Error ? error.message : 'Fixed asset disposal posting failed')
}

export function mapPostingErrorToFixedAssetDisposalReversalError(error: unknown): never {
  if (
    error instanceof FixedAssetDisposalError ||
    error instanceof FixedAssetDisposalConcurrentPostError ||
    error instanceof FixedAssetDisposalPostingInProgressError
  ) {
    throw error
  }
  if (error instanceof PostingError) {
    if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
      throw new FixedAssetDisposalPostingPeriodClosedError(error.message)
    }
    if (error.code === 'POSTING_EVENT_IN_PROGRESS' || error.code === 'POSTING_CONCURRENT_ACTION') {
      throw new FixedAssetDisposalPostingInProgressError(error.message)
    }
    throw new FixedAssetDisposalReversalFailedError(error.message)
  }
  if (error instanceof AppError) throw error
  throw new FixedAssetDisposalReversalFailedError(error instanceof Error ? error.message : 'Fixed asset disposal reversal failed')
}
