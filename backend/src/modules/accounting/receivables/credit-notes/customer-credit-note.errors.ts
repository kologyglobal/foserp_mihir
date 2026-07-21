import { AppError } from '../../../../utils/errors.js'

export class CustomerCreditNoteError extends AppError {}
export class CustomerCreditNoteNotFoundError extends CustomerCreditNoteError {
  constructor() { super(404, 'Customer credit note not found', 'CUSTOMER_CREDIT_NOTE_NOT_FOUND') }
}
export class CustomerCreditNoteInvalidStatusError extends CustomerCreditNoteError {
  constructor(message = 'Invalid customer credit note status') { super(422, message, 'CUSTOMER_CREDIT_NOTE_INVALID_STATUS') }
}
export class CustomerCreditNoteValidationError extends CustomerCreditNoteError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'CUSTOMER_CREDIT_NOTE_VALIDATION_FAILED', errors)
  }
}
export class CustomerCreditNoteStaleUpdateError extends CustomerCreditNoteError {
  constructor() { super(409, 'Customer credit note was changed by another user', 'CUSTOMER_CREDIT_NOTE_STALE_UPDATE') }
}
export class CustomerCreditNoteApprovalRequiredError extends CustomerCreditNoteError {
  constructor(message = 'An approved approval request is required') {
    super(422, message, 'CUSTOMER_CREDIT_NOTE_APPROVAL_REQUIRED')
  }
}
