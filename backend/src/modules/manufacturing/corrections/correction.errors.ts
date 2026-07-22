import { ConflictError, InvalidStateError, ValidationError } from '../../../utils/errors.js'

export class CorrectionValidationError extends ValidationError {
  constructor(message: string) {
    super(message)
  }
}

export class CorrectionInvalidStateError extends InvalidStateError {
  constructor(message: string) {
    super(message)
  }
}

export class CorrectionStalePreviewError extends ConflictError {
  constructor(message = 'Source transaction changed after preview; re-preview before applying') {
    super(message)
  }
}

export class CorrectionAlreadyAppliedError extends ConflictError {
  constructor(message = 'This correction has already been applied') {
    super(message)
  }
}

export class CorrectionBlockedError extends ValidationError {
  constructor(message: string) {
    super(message)
  }
}
