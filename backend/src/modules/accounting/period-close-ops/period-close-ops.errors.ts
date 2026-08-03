import { AppError } from '../../../utils/errors.js'

export const PERIOD_CLOSE_OPS_ERROR_CODES = {
  NOT_EDITABLE: 'PERIOD_CLOSE_OPS_NOT_EDITABLE',
  PERIOD_NOT_FOUND: 'PERIOD_CLOSE_OPS_PERIOD_NOT_FOUND',
  PERIOD_NOT_LOCKED: 'PERIOD_CLOSE_OPS_PERIOD_NOT_LOCKED',
  INVALID_STATUS: 'PERIOD_CLOSE_OPS_INVALID_STATUS',
  TEMPLATE_CODE_EXISTS: 'PERIOD_CLOSE_OPS_TEMPLATE_CODE_EXISTS',
  ALREADY_INSTANTIATED: 'PERIOD_CLOSE_OPS_ALREADY_INSTANTIATED',
  REQUEST_EXPIRED: 'PERIOD_CLOSE_OPS_REQUEST_EXPIRED',
} as const

export type PeriodCloseOpsErrorCode =
  (typeof PERIOD_CLOSE_OPS_ERROR_CODES)[keyof typeof PERIOD_CLOSE_OPS_ERROR_CODES]

export class PeriodCloseOpsError extends AppError {
  constructor(
    statusCode: number,
    message: string,
    code: PeriodCloseOpsErrorCode,
    details?: Record<string, unknown>,
  ) {
    super(statusCode, message, code, undefined, details)
  }
}

export function unprocessable(
  message: string,
  code: PeriodCloseOpsErrorCode,
  details?: Record<string, unknown>,
): PeriodCloseOpsError {
  return new PeriodCloseOpsError(422, message, code, details)
}
