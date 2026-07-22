import { InvalidStateError, ValidationError } from '../../../utils/errors.js'

export class WipMovementValidationError extends ValidationError {
  constructor(message: string) {
    super(message)
  }
}

export class WipMovementInvalidStateError extends InvalidStateError {
  constructor(message: string) {
    super(message)
  }
}
