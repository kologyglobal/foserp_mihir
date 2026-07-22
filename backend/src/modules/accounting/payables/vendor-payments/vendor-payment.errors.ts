import { AppError, ConflictError, NotFoundError, ValidationError } from '../../../../utils/errors.js'

export class VendorPaymentNotFoundError extends NotFoundError {
  constructor(message = 'Vendor payment not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_PAYMENT_NOT_FOUND' })
  }
}

export class VendorPaymentDuplicateDraftReferenceError extends ConflictError {
  constructor(message = 'Vendor payment draft reference already exists') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_PAYMENT_DUPLICATE_DRAFT_REFERENCE' })
  }
}

export class VendorPaymentAdjustmentLineConflictError extends ConflictError {
  constructor(message = 'Vendor payment adjustment line number conflict') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_PAYMENT_ADJUSTMENT_LINE_CONFLICT' })
  }
}

export class VendorPaymentAdjustmentAmountInvalidError extends ValidationError {
  constructor(message = 'Vendor payment adjustment amounts must be positive') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_PAYMENT_ADJUSTMENT_AMOUNT_INVALID' })
  }
}

export class VendorPaymentError extends AppError {
  constructor(statusCode: number, message: string, code: string) {
    super(statusCode, message, code)
    this.name = 'VendorPaymentError'
  }
}

/** Phase 4B3 — draft workflow errors. */

export class VendorPaymentInvalidStatusError extends AppError {
  constructor(message = 'Invalid vendor payment status for this action') {
    super(422, message, 'VENDOR_PAYMENT_INVALID_STATUS')
  }
}

export class VendorPaymentStaleVersionError extends ConflictError {
  constructor(message = 'Vendor payment was changed by another user') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_PAYMENT_STALE_VERSION' })
  }
}

export class VendorPaymentValidationFailedError extends AppError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'VENDOR_PAYMENT_VALIDATION_FAILED', errors)
  }
}

export class VendorPaymentEditNotAllowedError extends AppError {
  constructor(message = 'Vendor payment cannot be edited in its current status') {
    super(422, message, 'VENDOR_PAYMENT_EDIT_NOT_ALLOWED')
  }
}

export class VendorPaymentUniquenessKeyConflictError extends ConflictError {
  constructor(message = 'Payment uniqueness key is already claimed by another vendor payment') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_PAYMENT_UNIQUENESS_KEY_CONFLICT' })
  }
}

export class VendorPaymentDuplicateUniquenessKeyError extends ConflictError {
  constructor(message = 'A vendor payment with the same payment reference already exists') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_PAYMENT_DUPLICATE_UNIQUENESS_KEY' })
  }
}

export class VendorPaymentApprovalRequiredError extends AppError {
  constructor(message = 'An approved approval request is required') {
    super(422, message, 'VENDOR_PAYMENT_APPROVAL_REQUIRED')
  }
}

export class VendorPaymentNotReadyError extends AppError {
  constructor(message = 'Vendor payment failed validation and is not ready', errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'VENDOR_PAYMENT_NOT_READY', errors)
  }
}

export class VendorPaymentVendorNotFoundError extends NotFoundError {
  constructor(message = 'Vendor not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_PAYMENT_VENDOR_NOT_FOUND' })
  }
}

export class VendorPaymentInactiveVendorError extends AppError {
  constructor(message = 'Vendor is inactive or blocked') {
    super(422, message, 'VENDOR_PAYMENT_INACTIVE_VENDOR')
  }
}

export class VendorPaymentReasonRequiredError extends AppError {
  constructor(message = 'A reason is required for this action') {
    super(422, message, 'VENDOR_PAYMENT_REASON_REQUIRED')
  }
}
