import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'

export class VendorQuotationNotFoundError extends NotFoundError {
  constructor(message = 'Vendor quotation not found') {
    super(message)
    this.name = 'VendorQuotationNotFoundError'
    Object.defineProperty(this, 'code', { value: 'VENDOR_QUOTATION_NOT_FOUND' })
  }
}

export class VendorQuotationNotEditableError extends InvalidStateError {
  constructor(message = 'Vendor quotation is not editable') {
    super(message)
    this.name = 'VendorQuotationNotEditableError'
    Object.defineProperty(this, 'code', { value: 'VENDOR_QUOTATION_NOT_EDITABLE' })
  }
}

export class VendorQuotationVendorNotInvitedError extends ValidationError {
  constructor(message = 'Vendor must be included in the RFQ vendor list') {
    super(message, [{ field: 'vendorId', message }])
    this.name = 'VendorQuotationVendorNotInvitedError'
    Object.defineProperty(this, 'code', { value: 'VENDOR_QUOTATION_VENDOR_NOT_INVITED' })
  }
}

export class VendorQuotationRfqNotOpenError extends ConflictError {
  constructor(message = 'Vendor quotations can only be recorded for an active RFQ') {
    super(message)
    this.name = 'VendorQuotationRfqNotOpenError'
    Object.defineProperty(this, 'code', { value: 'VENDOR_QUOTATION_RFQ_NOT_OPEN' })
  }
}
