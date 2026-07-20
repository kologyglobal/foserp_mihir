import { AppError, ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'

export class PlanningRowNotFoundError extends NotFoundError {
  constructor(message = purchaseMessage(PURCHASE_ERROR_CODE.PPS_NOT_FOUND)) {
    super(message)
    Object.defineProperty(this, 'code', { value: PURCHASE_ERROR_CODE.PPS_NOT_FOUND })
    this.name = 'PlanningRowNotFoundError'
  }
}

export class PlanningRowReadOnlyError extends InvalidStateError {
  constructor(
    message = purchaseMessage(PURCHASE_ERROR_CODE.PPS_READ_ONLY),
    code: string = PURCHASE_ERROR_CODE.PPS_READ_ONLY,
  ) {
    super(message)
    Object.defineProperty(this, 'code', { value: code })
    this.name = 'PlanningRowReadOnlyError'
  }
}

export class PlanningInvalidTransitionError extends InvalidStateError {
  constructor(message = purchaseMessage(PURCHASE_ERROR_CODE.PPS_INVALID_TRANSITION)) {
    super(message)
    Object.defineProperty(this, 'code', { value: PURCHASE_ERROR_CODE.PPS_INVALID_TRANSITION })
    this.name = 'PlanningInvalidTransitionError'
  }
}

export class PlanningNoSelectionError extends ValidationError {
  constructor(message = purchaseMessage(PURCHASE_ERROR_CODE.PPS_NO_SELECTION)) {
    super(message, [{ field: 'rowIds', message }])
    Object.defineProperty(this, 'code', { value: PURCHASE_ERROR_CODE.PPS_NO_SELECTION })
    this.name = 'PlanningNoSelectionError'
  }
}

export class PlanningStatusReasonRequiredError extends ValidationError {
  constructor(message = purchaseMessage(PURCHASE_ERROR_CODE.PPS_STATUS_REASON_REQUIRED)) {
    super(message, [{ field: 'reason', message }])
    Object.defineProperty(this, 'code', { value: PURCHASE_ERROR_CODE.PPS_STATUS_REASON_REQUIRED })
    this.name = 'PlanningStatusReasonRequiredError'
  }
}

export class PlanningDuplicateLineError extends ConflictError {
  constructor(message = purchaseMessage(PURCHASE_ERROR_CODE.PPS_DUPLICATE_LINE)) {
    super(message)
    Object.defineProperty(this, 'code', { value: PURCHASE_ERROR_CODE.PPS_DUPLICATE_LINE })
    this.name = 'PlanningDuplicateLineError'
  }
}

export class PlanningPoNotReadyError extends ValidationError {
  constructor(
    message = purchaseMessage(PURCHASE_ERROR_CODE.PPS_PO_NOT_READY),
    code: string = PURCHASE_ERROR_CODE.PPS_PO_NOT_READY,
    field = 'rowIds',
  ) {
    super(message, [{ field, message }])
    Object.defineProperty(this, 'code', { value: code })
    this.name = 'PlanningPoNotReadyError'
  }
}

export class PlanningNotEligibleError extends InvalidStateError {
  constructor(
    message = purchaseMessage(PURCHASE_ERROR_CODE.PPS_NOT_ELIGIBLE),
    code: string = PURCHASE_ERROR_CODE.PPS_NOT_ELIGIBLE,
  ) {
    super(message)
    Object.defineProperty(this, 'code', { value: code })
    this.name = 'PlanningNotEligibleError'
  }
}

export class PlanningRfqRequiredError extends InvalidStateError {
  constructor(message = purchaseMessage(PURCHASE_ERROR_CODE.PPS_RFQ_REQUIRED)) {
    super(message)
    Object.defineProperty(this, 'code', { value: PURCHASE_ERROR_CODE.PPS_RFQ_REQUIRED })
    this.name = 'PlanningRfqRequiredError'
  }
}

export class PurchaseOrderCreationError extends ValidationError {
  constructor(
    message: string,
    code: string,
    errors?: Array<{ field: string; message: string }>,
  ) {
    super(message, errors ?? [{ field: 'rowIds', message }])
    Object.defineProperty(this, 'code', { value: code })
    this.name = 'PurchaseOrderCreationError'
  }
}

export class PlanningError extends AppError {
  constructor(statusCode: number, message: string, code: string) {
    super(statusCode, message, code)
    this.name = 'PlanningError'
  }
}
