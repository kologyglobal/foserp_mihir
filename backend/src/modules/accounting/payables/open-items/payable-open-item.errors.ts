import { ConflictError, NotFoundError } from '../../../../utils/errors.js'

export class PayableOpenItemNotFoundError extends NotFoundError {
  constructor(message = 'Payable open item not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'PAYABLE_OPEN_ITEM_NOT_FOUND' })
  }
}

export class PayableOpenItemDuplicateSourceError extends ConflictError {
  constructor(message = 'Payable open item already exists for this source document') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'PAYABLE_OPEN_ITEM_DUPLICATE_SOURCE' })
  }
}
