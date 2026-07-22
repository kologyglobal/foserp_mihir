import { AppError, ConflictError, NotFoundError } from '../../../../utils/errors.js'

export class VendorInvoiceNotFoundError extends NotFoundError {
  constructor(message = 'Vendor invoice not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_INVOICE_NOT_FOUND' })
  }
}

export class VendorInvoiceDuplicateUniquenessKeyError extends ConflictError {
  constructor(message = 'Supplier invoice uniqueness key already claimed') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_INVOICE_DUPLICATE_UNIQUENESS_KEY' })
  }
}

export class VendorInvoiceLineConflictError extends ConflictError {
  constructor(message = 'Vendor invoice line number conflict') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_INVOICE_LINE_CONFLICT' })
  }
}

export class VendorInvoiceSourceLinkConflictError extends ConflictError {
  constructor(message = 'Vendor invoice source link already exists') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_INVOICE_SOURCE_LINK_CONFLICT' })
  }
}

export class VendorInvoiceError extends AppError {
  constructor(statusCode: number, message: string, code: string) {
    super(statusCode, message, code)
    this.name = 'VendorInvoiceError'
  }
}

/** Phase 4A3 — draft workflow errors. */

export class VendorInvoiceInvalidStatusError extends AppError {
  constructor(message = 'Invalid vendor invoice status for this action') {
    super(422, message, 'VENDOR_INVOICE_INVALID_STATUS')
  }
}

export class VendorInvoiceStaleVersionError extends ConflictError {
  constructor(message = 'Vendor invoice was changed by another user') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_INVOICE_STALE_VERSION' })
  }
}

export class VendorInvoiceValidationFailedError extends AppError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'VENDOR_INVOICE_VALIDATION_FAILED', errors)
  }
}

export class VendorInvoiceEditNotAllowedError extends AppError {
  constructor(message = 'Vendor invoice cannot be edited in its current status') {
    super(422, message, 'VENDOR_INVOICE_EDIT_NOT_ALLOWED')
  }
}

export class VendorInvoiceExactDuplicateError extends AppError {
  constructor(message = 'An exact duplicate vendor invoice already exists for this vendor') {
    super(422, message, 'VENDOR_INVOICE_EXACT_DUPLICATE')
  }
}

export class VendorInvoiceUniquenessKeyConflictError extends ConflictError {
  constructor(message = 'Supplier invoice uniqueness key is already claimed by another invoice') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_INVOICE_UNIQUENESS_KEY_CONFLICT' })
  }
}

export class VendorInvoiceApprovalRequiredError extends AppError {
  constructor(message = 'An approved approval request is required') {
    super(422, message, 'VENDOR_INVOICE_APPROVAL_REQUIRED')
  }
}

export class VendorInvoiceNotReadyError extends AppError {
  constructor(message = 'Vendor invoice failed validation and is not ready', errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'VENDOR_INVOICE_NOT_READY', errors)
  }
}

export class VendorInvoiceVendorNotFoundError extends NotFoundError {
  constructor(message = 'Vendor not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_INVOICE_VENDOR_NOT_FOUND' })
  }
}

export class VendorInvoiceInactiveVendorError extends AppError {
  constructor(message = 'Vendor is inactive or blocked') {
    super(422, message, 'VENDOR_INVOICE_INACTIVE_VENDOR')
  }
}

export class VendorInvoiceReasonRequiredError extends AppError {
  constructor(message = 'A reason is required for this action') {
    super(422, message, 'VENDOR_INVOICE_REASON_REQUIRED')
  }
}
