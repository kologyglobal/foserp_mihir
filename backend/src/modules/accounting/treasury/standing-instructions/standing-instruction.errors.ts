import { AppError, NotFoundError } from '../../../../utils/errors.js'

export class StandingInstructionNotFoundError extends NotFoundError {
  constructor(message = 'Standing instruction not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'STANDING_INSTRUCTION_NOT_FOUND' })
  }
}

export class StandingInstructionStaleVersionError extends AppError {
  constructor(message = 'Standing instruction was changed by another user') {
    super(409, message, 'STANDING_INSTRUCTION_STALE_VERSION')
  }
}

export class StandingInstructionInvalidStatusError extends AppError {
  constructor(message = 'Invalid standing instruction status for this action') {
    super(422, message, 'STANDING_INSTRUCTION_INVALID_STATUS')
  }
}

export class StandingInstructionValidationFailedError extends AppError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'STANDING_INSTRUCTION_VALIDATION_FAILED', errors)
  }
}
