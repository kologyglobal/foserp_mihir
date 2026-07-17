import { AppError, InvalidStateError, ValidationError } from '../../../utils/errors.js'
import { PostingError } from '../posting/posting.errors.js'

export class JournalError extends AppError {
  constructor(statusCode: number, message: string, code: string, errors?: Array<{ field: string; message: string }>) {
    super(statusCode, message, code, errors)
    this.name = 'JournalError'
  }
}

export class JournalValidationBlockedError extends JournalError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'JOURNAL_VALIDATION_FAILED', errors)
    this.name = 'JournalValidationBlockedError'
  }
}

export class JournalApprovalBlockedError extends JournalError {
  constructor(message: string) {
    super(422, message, 'JOURNAL_APPROVAL_BLOCKED')
    this.name = 'JournalApprovalBlockedError'
  }
}

export { InvalidStateError, ValidationError, PostingError }
