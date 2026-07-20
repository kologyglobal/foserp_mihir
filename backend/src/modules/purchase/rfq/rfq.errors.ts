export class RfqNotFoundError extends Error {
  constructor(message = 'Request for quotation not found') {
    super(message)
    this.name = 'RfqNotFoundError'
    Object.defineProperty(this, 'code', { value: 'RFQ_NOT_FOUND' })
    Object.defineProperty(this, 'statusCode', { value: 404 })
  }
}

export class RfqNotEditableError extends Error {
  constructor(message = 'RFQ is not editable in the current status') {
    super(message)
    this.name = 'RfqNotEditableError'
    Object.defineProperty(this, 'code', { value: 'RFQ_NOT_EDITABLE' })
    Object.defineProperty(this, 'statusCode', { value: 409 })
  }
}

export class RfqNotSendableError extends Error {
  constructor(message = 'RFQ cannot be sent in the current status') {
    super(message)
    this.name = 'RfqNotSendableError'
    Object.defineProperty(this, 'code', { value: 'RFQ_NOT_SENDABLE' })
    Object.defineProperty(this, 'statusCode', { value: 409 })
  }
}

export class RfqPrNotEligibleError extends Error {
  constructor(message = 'Only approved RFQ-required purchase requisitions can create an RFQ') {
    super(message)
    this.name = 'RfqPrNotEligibleError'
    Object.defineProperty(this, 'code', { value: 'RFQ_PR_NOT_ELIGIBLE' })
    Object.defineProperty(this, 'statusCode', { value: 409 })
  }
}

export class RfqVendorsRequiredError extends Error {
  constructor(message = 'At least one vendor is required') {
    super(message)
    this.name = 'RfqVendorsRequiredError'
    Object.defineProperty(this, 'code', { value: 'RFQ_VENDORS_REQUIRED' })
    Object.defineProperty(this, 'statusCode', { value: 400 })
  }
}
