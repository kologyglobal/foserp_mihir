import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'

export class ComparisonNotFoundError extends NotFoundError {
  constructor(message = 'Vendor comparison not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_COMPARISON_NOT_FOUND' })
  }
}

export class ComparisonNotAwardableError extends InvalidStateError {
  constructor(message = 'Vendor comparison is not ready for award') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_COMPARISON_NOT_AWARDABLE' })
  }
}

export class ComparisonNoSubmittedQuotationsError extends ValidationError {
  constructor(message = 'At least one submitted vendor quotation is required') {
    super(message, [{ field: 'requestForQuotationId', message }])
    Object.defineProperty(this, 'code', { value: 'VENDOR_COMPARISON_NO_SUBMITTED_QUOTATIONS' })
  }
}

export class ComparisonInvalidAwardError extends ValidationError {
  constructor(message = 'The awarded quotation must belong to this RFQ comparison') {
    super(message, [{ field: 'awardedVendorQuotationId', message }])
    Object.defineProperty(this, 'code', { value: 'VENDOR_COMPARISON_INVALID_AWARD' })
  }
}

export class ComparisonPurchaseOrderExistsError extends ConflictError {
  constructor(message = 'A purchase order has already been created from this comparison') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'VENDOR_COMPARISON_PO_EXISTS' })
  }
}
