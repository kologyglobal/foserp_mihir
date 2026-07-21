import { AppError, ConflictError, NotFoundError } from '../../../../utils/errors.js'

export class TreasuryLiquidityValidationError extends AppError {
  constructor(message: string, fieldErrors?: Array<{ field: string; message: string }>) {
    super(400, message, 'TREASURY_LIQUIDITY_VALIDATION_FAILED', fieldErrors)
  }
}

export class TreasuryDayCloseNotFoundError extends NotFoundError {
  constructor(message = 'Treasury day close not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_DAY_CLOSE_NOT_FOUND' })
  }
}

export class TreasuryDayCloseInvalidStatusError extends AppError {
  constructor(message: string) {
    super(409, message, 'TREASURY_DAY_CLOSE_INVALID_STATUS')
  }
}

export class TreasuryDayCloseAlreadyExistsError extends ConflictError {
  constructor(message = 'A day-close record already exists for this date') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_DAY_CLOSE_ALREADY_EXISTS' })
  }
}

export class TreasuryDayCloseStaleVersionError extends ConflictError {
  constructor(message = 'Day close was updated by another user. Refresh and retry.') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_DAY_CLOSE_STALE_VERSION' })
  }
}
