import { AppError, ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../../utils/errors.js'

export class CustomerReceiptError extends AppError {
  constructor(statusCode: number, message: string, code: string, errors?: Array<{ field: string; message: string }>) {
    super(statusCode, message, code, errors)
    this.name = 'CustomerReceiptError'
  }
}

export class CustomerReceiptNotFoundError extends NotFoundError {
  constructor() {
    super('Customer receipt not found')
    Object.defineProperty(this, 'code', { value: 'CUSTOMER_RECEIPT_NOT_FOUND' })
  }
}

export class CustomerReceiptAllocationNotFoundError extends NotFoundError {
  constructor() {
    super('Customer receipt allocation not found')
    Object.defineProperty(this, 'code', { value: 'CUSTOMER_RECEIPT_ALLOCATION_NOT_FOUND' })
  }
}

export class CustomerReceiptAccountOwnershipError extends ValidationError {
  constructor(field: string, message = 'Account does not belong to this legal entity') {
    super(message, [{ field, message }])
    Object.defineProperty(this, 'code', { value: 'CUSTOMER_RECEIPT_ACCOUNT_OWNERSHIP' })
    this.name = 'CustomerReceiptAccountOwnershipError'
  }
}

export class CustomerReceiptInvalidBankCashAccountError extends ValidationError {
  constructor(message = 'Bank/cash account must be an active BANK or CASH account in this legal entity') {
    super(message, [{ field: 'bankCashAccountId', message }])
    Object.defineProperty(this, 'code', { value: 'CUSTOMER_RECEIPT_INVALID_BANK_CASH_ACCOUNT' })
    this.name = 'CustomerReceiptInvalidBankCashAccountError'
  }
}

export class CustomerReceiptAllocationCustomerMismatchError extends ValidationError {
  constructor(message = 'Receipt and invoice must belong to the same customer') {
    super(message, [{ field: 'customerId', message }])
    Object.defineProperty(this, 'code', { value: 'CUSTOMER_RECEIPT_ALLOCATION_CUSTOMER_MISMATCH' })
    this.name = 'CustomerReceiptAllocationCustomerMismatchError'
  }
}

export class CustomerReceiptAllocationSideMismatchError extends ValidationError {
  constructor(message: string) {
    super(message, [{ field: 'openItemId', message }])
    Object.defineProperty(this, 'code', { value: 'CUSTOMER_RECEIPT_ALLOCATION_SIDE_MISMATCH' })
    this.name = 'CustomerReceiptAllocationSideMismatchError'
  }
}

export class ReceivableOpenItemNegativeOriginalError extends ValidationError {
  constructor() {
    super('originalAmount must be zero or positive', [{ field: 'originalAmount', message: 'Must be >= 0' }])
    Object.defineProperty(this, 'code', { value: 'RECEIVABLE_OPEN_ITEM_NEGATIVE_ORIGINAL' })
    this.name = 'ReceivableOpenItemNegativeOriginalError'
  }
}

export class ReceivableOpenItemAmountInvariantError extends ValidationError {
  constructor(message: string) {
    super(message, [{ field: 'openAmount', message }])
    Object.defineProperty(this, 'code', { value: 'RECEIVABLE_OPEN_ITEM_AMOUNT_INVARIANT' })
    this.name = 'ReceivableOpenItemAmountInvariantError'
  }
}

/* ─── Phase 3B3 — draft workflow errors (mirrors SalesInvoice*Error patterns) ─── */

export class CustomerReceiptNotEditableError extends CustomerReceiptError {
  constructor(message = 'Customer receipt is not editable in its current status') {
    super(422, message, 'CUSTOMER_RECEIPT_NOT_EDITABLE')
    this.name = 'CustomerReceiptNotEditableError'
  }
}

export class CustomerReceiptAlreadyCancelledError extends CustomerReceiptError {
  constructor() {
    super(422, 'Customer receipt is already cancelled', 'CUSTOMER_RECEIPT_ALREADY_CANCELLED')
    this.name = 'CustomerReceiptAlreadyCancelledError'
  }
}

export class CustomerReceiptInvalidStatusError extends InvalidStateError {
  constructor(message = 'Invalid customer receipt status for this operation') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'CUSTOMER_RECEIPT_INVALID_STATUS' })
    this.name = 'CustomerReceiptInvalidStatusError'
  }
}

export class CustomerReceiptStaleUpdateError extends ConflictError {
  constructor() {
    super('This receipt was changed by another user. Refresh it before saving your changes.')
    Object.defineProperty(this, 'code', { value: 'CUSTOMER_RECEIPT_STALE_UPDATE' })
    this.name = 'CustomerReceiptStaleUpdateError'
  }
}

export class CustomerReceiptSourceNotSupportedError extends CustomerReceiptError {
  constructor(message = 'Source type BANK_IMPORT is not supported in this phase') {
    super(422, message, 'CUSTOMER_RECEIPT_SOURCE_NOT_SUPPORTED')
    this.name = 'CustomerReceiptSourceNotSupportedError'
  }
}

export class CustomerReceiptDraftCalculationFailedError extends CustomerReceiptError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'CUSTOMER_RECEIPT_DRAFT_CALCULATION_FAILED', errors)
    this.name = 'CustomerReceiptDraftCalculationFailedError'
  }
}

export class CustomerReceiptValidationFailedError extends CustomerReceiptError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'CUSTOMER_RECEIPT_VALIDATION_FAILED', errors)
    this.name = 'CustomerReceiptValidationFailedError'
  }
}

export class CustomerReceiptNotReadyError extends CustomerReceiptError {
  constructor(message = 'Customer receipt is not ready to post') {
    super(422, message, 'CUSTOMER_RECEIPT_NOT_READY')
    this.name = 'CustomerReceiptNotReadyError'
  }
}

export class CustomerReceiptChangedAfterValidationError extends CustomerReceiptError {
  constructor(message = 'Customer receipt changed after validation — re-validate before proceeding') {
    super(422, message, 'CUSTOMER_RECEIPT_CHANGED_AFTER_VALIDATION')
    this.name = 'CustomerReceiptChangedAfterValidationError'
  }
}

export class CustomerReceiptCancellationReasonRequiredError extends ValidationError {
  constructor() {
    super('Cancellation reason is required', [{ field: 'cancellationReason', message: 'Required' }])
    Object.defineProperty(this, 'code', { value: 'CUSTOMER_RECEIPT_CANCELLATION_REASON_REQUIRED' })
    this.name = 'CustomerReceiptCancellationReasonRequiredError'
  }
}

export class CustomerReceiptNumberAlreadyAssignedError extends CustomerReceiptError {
  constructor(message = 'Customer receipt already has a receipt number assigned') {
    super(422, message, 'CUSTOMER_RECEIPT_NUMBER_ALREADY_ASSIGNED')
    this.name = 'CustomerReceiptNumberAlreadyAssignedError'
  }
}

export class CustomerReceiptAccountingAlreadyLinkedError extends CustomerReceiptError {
  constructor(message = 'Customer receipt already has an accounting voucher linked') {
    super(422, message, 'CUSTOMER_RECEIPT_ACCOUNTING_ALREADY_LINKED')
    this.name = 'CustomerReceiptAccountingAlreadyLinkedError'
  }
}

export class CustomerReceiptPostingEventAlreadyLinkedError extends CustomerReceiptError {
  constructor(message = 'Customer receipt already has a posting event linked') {
    super(422, message, 'CUSTOMER_RECEIPT_POSTING_EVENT_ALREADY_LINKED')
    this.name = 'CustomerReceiptPostingEventAlreadyLinkedError'
  }
}

export class CustomerReceiptCreditOpenItemAlreadyLinkedError extends CustomerReceiptError {
  constructor(message = 'Customer receipt already has a credit open item linked') {
    super(422, message, 'CUSTOMER_RECEIPT_CREDIT_OPEN_ITEM_ALREADY_LINKED')
    this.name = 'CustomerReceiptCreditOpenItemAlreadyLinkedError'
  }
}

export class CustomerReceiptDeductionInvalidError extends ValidationError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(message, errors)
    Object.defineProperty(this, 'code', { value: 'CUSTOMER_RECEIPT_DEDUCTION_INVALID' })
    this.name = 'CustomerReceiptDeductionInvalidError'
  }
}

export class CustomerReceiptDeductionPersistenceFailedError extends CustomerReceiptError {
  constructor(message = 'Failed to persist customer receipt deduction lines') {
    super(500, message, 'CUSTOMER_RECEIPT_DEDUCTION_PERSISTENCE_FAILED')
    this.name = 'CustomerReceiptDeductionPersistenceFailedError'
  }
}
