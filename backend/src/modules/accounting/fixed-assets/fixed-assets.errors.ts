import { AppError, ConflictError, NotFoundError } from '../../../utils/errors.js'
import { PostingError } from '../posting/posting.errors.js'

export class FixedAssetError extends AppError {
  constructor(statusCode: number, message: string, code: string, errors?: Array<{ field: string; message: string }>) {
    super(statusCode, message, code, errors)
    this.name = 'FixedAssetError'
  }
}

export class FixedAssetNotFoundError extends NotFoundError {
  constructor(message = 'Fixed asset not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'FIXED_ASSET_NOT_FOUND' })
  }
}

export class FixedAssetCategoryNotFoundError extends NotFoundError {
  constructor(message = 'Fixed asset category not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'FIXED_ASSET_CATEGORY_NOT_FOUND' })
  }
}

export class FixedAssetDepreciationRunNotFoundError extends NotFoundError {
  constructor(message = 'Depreciation run not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'FIXED_ASSET_DEPRECIATION_RUN_NOT_FOUND' })
  }
}

export class FixedAssetStaleVersionError extends ConflictError {
  constructor(message = 'Fixed asset was changed by another user') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'FIXED_ASSET_STALE_VERSION' })
  }
}

export class FixedAssetInvalidStatusError extends FixedAssetError {
  constructor(message = 'Invalid fixed asset status for this action') {
    super(422, message, 'FIXED_ASSET_INVALID_STATUS')
  }
}

export class FixedAssetValidationFailedError extends FixedAssetError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'FIXED_ASSET_VALIDATION_FAILED', errors)
  }
}

export class FixedAssetEditNotAllowedError extends FixedAssetError {
  constructor(message = 'Fixed asset cannot be edited in its current status') {
    super(422, message, 'FIXED_ASSET_EDIT_NOT_ALLOWED')
  }
}

export class FixedAssetCategoryInUseError extends FixedAssetError {
  constructor(message = 'Category cannot be deactivated while assets are assigned') {
    super(422, message, 'FIXED_ASSET_CATEGORY_IN_USE')
  }
}

export class FixedAssetDepreciationRunAlreadyPostedError extends ConflictError {
  constructor(message = 'Depreciation run already posted for this period') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'FIXED_ASSET_DEPRECIATION_RUN_ALREADY_POSTED' })
  }
}

export class FixedAssetDepreciationRunConflictError extends ConflictError {
  constructor(message = 'A depreciation run already exists for this period') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'FIXED_ASSET_DEPRECIATION_RUN_CONFLICT' })
  }
}

export class FixedAssetConcurrentPostError extends ConflictError {
  constructor(message = 'Fixed asset posting conflict — please retry') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'FIXED_ASSET_CONCURRENT_POST' })
  }
}

export class FixedAssetPostingFailedError extends FixedAssetError {
  constructor(message = 'Fixed asset posting failed') {
    super(422, message, 'FIXED_ASSET_POSTING_FAILED')
  }
}

export class FixedAssetPostingPeriodClosedError extends FixedAssetError {
  constructor(message = 'Accounting period is closed for posting') {
    super(422, message, 'FIXED_ASSET_POSTING_PERIOD_CLOSED')
  }
}

export class FixedAssetNumberSeriesMissingError extends FixedAssetError {
  constructor(message = 'Journal number series is not configured') {
    super(422, message, 'FIXED_ASSET_NUMBER_SERIES_MISSING')
  }
}

export function mapPostingErrorToFixedAssetError(error: unknown): never {
  if (error instanceof FixedAssetError || error instanceof FixedAssetConcurrentPostError) {
    throw error
  }
  if (error instanceof PostingError) {
    if (error.code === 'ACCOUNTING_PERIOD_CLOSED' || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') {
      throw new FixedAssetPostingPeriodClosedError(error.message)
    }
    if (error.code === 'NUMBER_SERIES_NOT_CONFIGURED' || error.code === 'NUMBER_SERIES_INACTIVE') {
      throw new FixedAssetNumberSeriesMissingError(error.message)
    }
    if (error.code === 'POSTING_EVENT_IN_PROGRESS' || error.code === 'POSTING_CONCURRENT_ACTION') {
      throw new FixedAssetConcurrentPostError(error.message)
    }
    throw new FixedAssetPostingFailedError(error.message)
  }
  if (error instanceof AppError) throw error
  throw new FixedAssetPostingFailedError(error instanceof Error ? error.message : 'Fixed asset posting failed')
}
