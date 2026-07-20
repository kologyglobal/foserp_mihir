export class PurchaseOrderNotFoundError extends Error {
  constructor(message = 'Purchase order not found') {
    super(message)
    this.name = 'PurchaseOrderNotFoundError'
    Object.defineProperty(this, 'code', { value: 'PO_NOT_FOUND' })
    Object.defineProperty(this, 'statusCode', { value: 404 })
  }
}
