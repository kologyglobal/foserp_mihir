import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'

export class RuntimeChangeNotFoundError extends NotFoundError {
  constructor(message = 'Runtime change not found') {
    super(message)
  }
}

export class RuntimeChangeInvalidStateError extends InvalidStateError {
  constructor(message: string) {
    super(message)
  }
}

export class RuntimeChangeValidationError extends ValidationError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(message, errors)
  }
}

/** Work order changed since the change was previewed/drafted — caller must re-preview before applying. */
export class RuntimeChangeStaleOrderError extends ConflictError {
  constructor(message = 'Work order has changed since this runtime change was requested; re-validate before applying') {
    super(message)
  }
}

/** A change that has already reached a terminal applied/cancelled state cannot be re-applied. */
export class RuntimeChangeAlreadyAppliedError extends ConflictError {
  constructor(message = 'Runtime change has already been applied') {
    super(message)
  }
}
