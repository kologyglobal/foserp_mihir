import { AppError, NotFoundError, ValidationError } from '../../../../utils/errors.js'

export const PAYABLE_RECONCILIATION_ERROR_CODES = {
  PAYABLE_RECONCILIATION_DATE_IN_FUTURE: 'PAYABLE_RECONCILIATION_DATE_IN_FUTURE',
  PAYABLE_RECONCILIATION_RUN_NOT_FOUND: 'PAYABLE_RECONCILIATION_RUN_NOT_FOUND',
  PAYABLE_RECONCILIATION_EXCEPTION_NOT_FOUND: 'PAYABLE_RECONCILIATION_EXCEPTION_NOT_FOUND',
  PAYABLE_RECONCILIATION_EXCEPTION_NOT_ACKNOWLEDGEABLE: 'PAYABLE_RECONCILIATION_EXCEPTION_NOT_ACKNOWLEDGEABLE',
  PAYABLE_RECONCILIATION_ALREADY_ACKNOWLEDGED: 'PAYABLE_RECONCILIATION_ALREADY_ACKNOWLEDGED',
  PAYABLE_RECONCILIATION_NO_CONTROL_ACCOUNTS: 'PAYABLE_RECONCILIATION_NO_CONTROL_ACCOUNTS',
  PAYABLE_RECONCILIATION_FAILED: 'PAYABLE_RECONCILIATION_FAILED',
  PAYABLE_CLOSE_GATE_PERIOD_NOT_FOUND: 'PAYABLE_CLOSE_GATE_PERIOD_NOT_FOUND',
  PAYABLE_CLOSE_GATE_RUN_NOT_FOUND: 'PAYABLE_CLOSE_GATE_RUN_NOT_FOUND',
  PAYABLE_CLOSE_GATE_RECONCILIATION_RUN_NOT_FOUND: 'PAYABLE_CLOSE_GATE_RECONCILIATION_RUN_NOT_FOUND',
  PAYABLE_CLOSE_GATE_FAILED: 'PAYABLE_CLOSE_GATE_FAILED',
} as const

export type PayableReconciliationErrorCode =
  (typeof PAYABLE_RECONCILIATION_ERROR_CODES)[keyof typeof PAYABLE_RECONCILIATION_ERROR_CODES]

export class PayableReconciliationError extends AppError {
  constructor(
    statusCode: number,
    message: string,
    code: PayableReconciliationErrorCode,
    errors?: Array<{ field: string; message: string }>,
  ) {
    super(statusCode, message, code, errors)
    this.name = 'PayableReconciliationError'
  }
}

export class PayableReconciliationDateInFutureError extends PayableReconciliationError {
  constructor(asOfDate: string, today: string) {
    super(
      422,
      `Reconciliation asOfDate ${asOfDate} cannot be in the future (today is ${today})`,
      PAYABLE_RECONCILIATION_ERROR_CODES.PAYABLE_RECONCILIATION_DATE_IN_FUTURE,
      [{ field: 'asOfDate', message: 'asOfDate cannot be in the future' }],
    )
    this.name = 'PayableReconciliationDateInFutureError'
  }
}

export class PayableReconciliationRunNotFoundError extends NotFoundError {
  constructor(message = 'Reconciliation run not found') {
    super(message)
    Object.defineProperty(this, 'code', {
      value: PAYABLE_RECONCILIATION_ERROR_CODES.PAYABLE_RECONCILIATION_RUN_NOT_FOUND,
    })
    this.name = 'PayableReconciliationRunNotFoundError'
  }
}

export class PayableReconciliationExceptionNotFoundError extends NotFoundError {
  constructor(message = 'Reconciliation exception not found') {
    super(message)
    Object.defineProperty(this, 'code', {
      value: PAYABLE_RECONCILIATION_ERROR_CODES.PAYABLE_RECONCILIATION_EXCEPTION_NOT_FOUND,
    })
    this.name = 'PayableReconciliationExceptionNotFoundError'
  }
}

export class PayableReconciliationExceptionNotAcknowledgeableError extends ValidationError {
  constructor(message = 'Only INFO or WARNING exceptions can be acknowledged') {
    super(message, [{ field: 'severity', message }])
    Object.defineProperty(this, 'code', {
      value: PAYABLE_RECONCILIATION_ERROR_CODES.PAYABLE_RECONCILIATION_EXCEPTION_NOT_ACKNOWLEDGEABLE,
    })
    this.name = 'PayableReconciliationExceptionNotAcknowledgeableError'
  }
}

export class PayableCloseGatePeriodNotFoundError extends NotFoundError {
  constructor(message = 'Accounting period not found') {
    super(message)
    Object.defineProperty(this, 'code', {
      value: PAYABLE_RECONCILIATION_ERROR_CODES.PAYABLE_CLOSE_GATE_PERIOD_NOT_FOUND,
    })
    this.name = 'PayableCloseGatePeriodNotFoundError'
  }
}

export class PayableCloseGateRunNotFoundError extends NotFoundError {
  constructor(message = 'Close gate run not found') {
    super(message)
    Object.defineProperty(this, 'code', {
      value: PAYABLE_RECONCILIATION_ERROR_CODES.PAYABLE_CLOSE_GATE_RUN_NOT_FOUND,
    })
    this.name = 'PayableCloseGateRunNotFoundError'
  }
}

export class PayableCloseGateReconciliationRunNotFoundError extends ValidationError {
  constructor(message = 'reconciliationRunId does not refer to a reconciliation run for this legal entity') {
    super(message, [{ field: 'reconciliationRunId', message }])
    Object.defineProperty(this, 'code', {
      value: PAYABLE_RECONCILIATION_ERROR_CODES.PAYABLE_CLOSE_GATE_RECONCILIATION_RUN_NOT_FOUND,
    })
    this.name = 'PayableCloseGateReconciliationRunNotFoundError'
  }
}
