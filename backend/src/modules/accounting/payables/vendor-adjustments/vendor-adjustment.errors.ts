import { AppError, ConflictError, NotFoundError } from '../../../../utils/errors.js'

export class VendorAdjustmentNotFoundError extends NotFoundError {
  constructor(message = 'Vendor invoice not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_ADJUSTMENT_NOT_FOUND' })
  }
}

export class VendorAdjustmentDuplicateUniquenessKeyError extends ConflictError {
  constructor(message = 'Supplier invoice uniqueness key already claimed') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_ADJUSTMENT_DUPLICATE_UNIQUENESS_KEY' })
  }
}

export class VendorAdjustmentLineConflictError extends ConflictError {
  constructor(message = 'Vendor invoice line number conflict') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_ADJUSTMENT_LINE_CONFLICT' })
  }
}

export class VendorAdjustmentSourceLinkConflictError extends ConflictError {
  constructor(message = 'Vendor invoice source link already exists') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_ADJUSTMENT_SOURCE_LINK_CONFLICT' })
  }
}

export class VendorAdjustmentError extends AppError {
  constructor(statusCode: number, message: string, code: string) {
    super(statusCode, message, code)
    this.name = 'VendorAdjustmentError'
  }
}

/** Phase 4A3 — draft workflow errors. */

export class VendorAdjustmentInvalidStatusError extends AppError {
  constructor(message = 'Invalid vendor invoice status for this action') {
    super(422, message, 'VENDOR_ADJUSTMENT_INVALID_STATUS')
  }
}

export class VendorAdjustmentStaleVersionError extends ConflictError {
  constructor(message = 'Vendor invoice was changed by another user') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_ADJUSTMENT_STALE_VERSION' })
  }
}

export class VendorAdjustmentValidationFailedError extends AppError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'VENDOR_ADJUSTMENT_VALIDATION_FAILED', errors)
  }
}

export class VendorAdjustmentEditNotAllowedError extends AppError {
  constructor(message = 'Vendor invoice cannot be edited in its current status') {
    super(422, message, 'VENDOR_ADJUSTMENT_EDIT_NOT_ALLOWED')
  }
}

export class VendorAdjustmentExactDuplicateError extends AppError {
  constructor(message = 'An exact duplicate vendor invoice already exists for this vendor') {
    super(422, message, 'VENDOR_ADJUSTMENT_EXACT_DUPLICATE')
  }
}

export class VendorAdjustmentUniquenessKeyConflictError extends ConflictError {
  constructor(message = 'Supplier invoice uniqueness key is already claimed by another invoice') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_ADJUSTMENT_UNIQUENESS_KEY_CONFLICT' })
  }
}

export class VendorAdjustmentApprovalRequiredError extends AppError {
  constructor(message = 'An approved approval request is required') {
    super(422, message, 'VENDOR_ADJUSTMENT_APPROVAL_REQUIRED')
  }
}

export class VendorAdjustmentNotReadyError extends AppError {
  constructor(message = 'Vendor invoice failed validation and is not ready', errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'VENDOR_ADJUSTMENT_NOT_READY', errors)
  }
}

export class VendorAdjustmentVendorNotFoundError extends NotFoundError {
  constructor(message = 'Vendor not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_ADJUSTMENT_VENDOR_NOT_FOUND' })
  }
}

export class VendorAdjustmentInactiveVendorError extends AppError {
  constructor(message = 'Vendor is inactive or blocked') {
    super(422, message, 'VENDOR_ADJUSTMENT_INACTIVE_VENDOR')
  }
}

export class VendorAdjustmentReasonRequiredError extends AppError {
  constructor(message = 'A reason is required for this action') {
    super(422, message, 'VENDOR_ADJUSTMENT_REASON_REQUIRED')
  }
}
