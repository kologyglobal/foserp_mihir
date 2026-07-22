import { AppError } from '../../../utils/errors.js'

export class InventoryItemNotStockableError extends AppError {
  constructor(message = 'Item is not stockable') {
    super(422, message, 'INVENTORY_ITEM_NOT_STOCKABLE')
  }
}

export class InventoryItemBlockedError extends AppError {
  constructor(message = 'Item is blocked for stock transactions') {
    super(422, message, 'INVENTORY_ITEM_BLOCKED')
  }
}

export class InventoryWarehouseInactiveError extends AppError {
  constructor(message = 'Warehouse is not active') {
    super(422, message, 'INVENTORY_WAREHOUSE_INACTIVE')
  }
}

export class InventoryInsufficientStockError extends AppError {
  constructor(message = 'Insufficient free stock for this movement') {
    super(422, message, 'INVENTORY_INSUFFICIENT_STOCK')
  }
}

export class InventoryReservationNotFoundError extends AppError {
  constructor(message = 'Reservation not found') {
    super(404, message, 'INVENTORY_RESERVATION_NOT_FOUND')
  }
}

export class InventoryReservationInvalidStateError extends AppError {
  constructor(message = 'Reservation is not in a valid state for this action') {
    super(422, message, 'INVENTORY_RESERVATION_INVALID_STATE')
  }
}

export class InventoryQuantityInvalidError extends AppError {
  constructor(message = 'Invalid quantity for movement type') {
    super(400, message, 'INVENTORY_QUANTITY_INVALID')
  }
}
