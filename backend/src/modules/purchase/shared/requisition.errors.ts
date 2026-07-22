import { AppError } from '../../../utils/errors.js'

export class PurchaseRequisitionNotFoundError extends AppError {
  constructor(message = 'Purchase requisition not found') {
    super(404, message, 'PURCHASE_REQUISITION_NOT_FOUND')
  }
}

export class PurchaseRequisitionLineNotFoundError extends AppError {
  constructor(message = 'Purchase requisition line not found') {
    super(404, message, 'PURCHASE_REQUISITION_LINE_NOT_FOUND')
  }
}

export class PurchaseRequisitionInvalidStateError extends AppError {
  constructor(message = 'Purchase requisition is not in a valid state for this action') {
    super(422, message, 'PURCHASE_REQUISITION_INVALID_STATE')
  }
}

export class PurchaseRequisitionNoLinesError extends AppError {
  constructor(message = 'At least one line is required before submit') {
    super(422, message, 'PURCHASE_REQUISITION_NO_LINES')
  }
}

export class PurchaseItemNotPurchasableError extends AppError {
  constructor(message = 'Item is not purchasable') {
    super(422, message, 'PURCHASE_ITEM_NOT_PURCHASABLE')
  }
}

export class PurchaseItemBlockedError extends AppError {
  constructor(message = 'Item is blocked or not active') {
    super(422, message, 'PURCHASE_ITEM_BLOCKED')
  }
}

export class PurchaseWarehouseInactiveError extends AppError {
  constructor(message = 'Warehouse is not active') {
    super(422, message, 'PURCHASE_WAREHOUSE_INACTIVE')
  }
}
