import { AppError } from '../../../../../utils/errors.js'
import { PostingError } from '../../../posting/posting.errors.js'

export class CustomerCreditNotePostingError extends AppError {}
export class CustomerCreditNoteAlreadyPostedError extends CustomerCreditNotePostingError {
  constructor() { super(422, 'Customer credit note is already posted', 'CUSTOMER_CREDIT_NOTE_ALREADY_POSTED') }
}
export class CustomerCreditNoteNotReadyError extends CustomerCreditNotePostingError {
  constructor() { super(422, 'Customer credit note is not ready to post', 'CUSTOMER_CREDIT_NOTE_NOT_READY') }
}
export class CustomerCreditNoteChangedAfterReadyError extends CustomerCreditNotePostingError {
  constructor() { super(422, 'Customer credit note changed after it was marked ready', 'CUSTOMER_CREDIT_NOTE_CHANGED_AFTER_READY') }
}
export class CustomerCreditNotePostingValidationError extends CustomerCreditNotePostingError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'CUSTOMER_CREDIT_NOTE_POSTING_VALIDATION_FAILED', errors)
  }
}
export class CustomerCreditNoteApprovalNotSatisfiedError extends CustomerCreditNotePostingError {
  constructor() { super(422, 'Required credit note approval is not satisfied', 'CUSTOMER_CREDIT_NOTE_APPROVAL_NOT_SATISFIED') }
}
export class CustomerCreditNoteAccountNotReadyError extends CustomerCreditNotePostingError {
  constructor(message: string) { super(422, message, 'CUSTOMER_CREDIT_NOTE_ACCOUNT_NOT_READY') }
}
export class CustomerCreditNotePeriodClosedError extends CustomerCreditNotePostingError {
  constructor(message: string) { super(422, message, 'CUSTOMER_CREDIT_NOTE_POSTING_PERIOD_CLOSED') }
}
export class CustomerCreditNoteConcurrentPostError extends CustomerCreditNotePostingError {
  constructor() { super(409, 'Customer credit note was posted concurrently', 'CUSTOMER_CREDIT_NOTE_CONCURRENT_POST') }
}
export class CustomerCreditNotePostingNotAllowedError extends CustomerCreditNotePostingError {
  constructor() { super(403, 'Missing permission: finance.ar.credit_note.post', 'CUSTOMER_CREDIT_NOTE_POSTING_NOT_ALLOWED') }
}
export class CustomerCreditNoteNumberSeriesError extends CustomerCreditNotePostingError {
  constructor() { super(422, 'Customer credit note number series is not configured', 'CUSTOMER_CREDIT_NOTE_NUMBER_SERIES_NOT_CONFIGURED') }
}
export class CustomerCreditNoteReversalNotAllowedError extends CustomerCreditNotePostingError {
  constructor() { super(403, 'Missing permission: finance.ar.credit_note.reverse', 'CUSTOMER_CREDIT_NOTE_REVERSAL_NOT_ALLOWED') }
}
export class CustomerCreditNoteNotPostedForReversalError extends CustomerCreditNotePostingError {
  constructor(message = 'Only POSTED credit notes can be reversed') { super(422, message, 'CUSTOMER_CREDIT_NOTE_NOT_POSTED_FOR_REVERSAL') }
}
export class CustomerCreditNoteAllocationsMustBeReversedError extends CustomerCreditNotePostingError {
  constructor() { super(422, 'All posted allocations must be reversed before reversing the credit note', 'CUSTOMER_CREDIT_NOTE_ALLOCATIONS_MUST_BE_REVERSED') }
}
export class CustomerCreditNoteReversalCreditNotClearError extends CustomerCreditNotePostingError {
  constructor(message = 'Credit note credit open item must be fully unallocated before reversal') { super(422, message, 'CUSTOMER_CREDIT_NOTE_REVERSAL_CREDIT_NOT_CLEAR') }
}
export class CustomerCreditNoteReversalEligibilityError extends CustomerCreditNotePostingError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) { super(422, message, 'CUSTOMER_CREDIT_NOTE_REVERSAL_NOT_ELIGIBLE', errors) }
}

export function mapPostingError(error: unknown): never {
  if (error instanceof CustomerCreditNotePostingError) throw error
  if (error instanceof PostingError) {
    if (error.code?.includes('PERIOD') || error.code === 'BACKDATED_POSTING_NOT_ALLOWED') throw new CustomerCreditNotePeriodClosedError(error.message)
    if (error.code?.startsWith('NUMBER_SERIES')) throw new CustomerCreditNoteNumberSeriesError()
    if (error.code === 'POSTING_EVENT_IN_PROGRESS' || error.code === 'POSTING_CONCURRENT_ACTION') throw new CustomerCreditNoteConcurrentPostError()
    throw new CustomerCreditNotePostingError(500, error.message, 'CUSTOMER_CREDIT_NOTE_POSTING_FAILED')
  }
  if (error instanceof AppError) throw error
  throw new CustomerCreditNotePostingError(500, error instanceof Error ? error.message : 'Posting failed', 'CUSTOMER_CREDIT_NOTE_POSTING_FAILED')
}
