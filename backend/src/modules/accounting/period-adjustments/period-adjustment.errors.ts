import { AppError } from '../../../utils/errors.js'

export const PERIOD_ADJUSTMENT_ERROR_CODES = {
  NOT_EDITABLE: 'PERIOD_ADJUSTMENT_NOT_EDITABLE',
  NOT_READY: 'PERIOD_ADJUSTMENT_NOT_READY',
  ALREADY_POSTED: 'PERIOD_ADJUSTMENT_ALREADY_POSTED',
  NOT_POSTED: 'PERIOD_ADJUSTMENT_NOT_POSTED',
  ALREADY_REVERSED: 'PERIOD_ADJUSTMENT_ALREADY_REVERSED',
  KIND_MISMATCH: 'PERIOD_ADJUSTMENT_KIND_MISMATCH',
  PERIOD_NOT_OPEN: 'PERIOD_ADJUSTMENT_PERIOD_NOT_OPEN',
  NEXT_PERIOD_MISSING: 'PERIOD_ADJUSTMENT_NEXT_PERIOD_MISSING',
  ACCOUNT_INVALID: 'PERIOD_ADJUSTMENT_ACCOUNT_INVALID',
  MAPPING_MISSING: 'PERIOD_ADJUSTMENT_MAPPING_MISSING',
  FINANCE_NOT_ACTIVATED: 'PERIOD_ADJUSTMENT_FINANCE_NOT_ACTIVATED',
  SCHEDULE_ALREADY_POSTED: 'PERIOD_ADJUSTMENT_SCHEDULE_ALREADY_POSTED',
  SCHEDULE_OUT_OF_ORDER: 'PERIOD_ADJUSTMENT_SCHEDULE_OUT_OF_ORDER',
  POSTING_FAILED: 'PERIOD_ADJUSTMENT_POSTING_FAILED',
} as const

export type PeriodAdjustmentErrorCode =
  (typeof PERIOD_ADJUSTMENT_ERROR_CODES)[keyof typeof PERIOD_ADJUSTMENT_ERROR_CODES]

export class PeriodAdjustmentError extends AppError {
  constructor(
    statusCode: number,
    message: string,
    code: PeriodAdjustmentErrorCode,
    details?: Record<string, unknown>,
  ) {
    super(statusCode, message, code, undefined, details)
  }
}

export function unprocessable(
  message: string,
  code: PeriodAdjustmentErrorCode,
  details?: Record<string, unknown>,
): PeriodAdjustmentError {
  return new PeriodAdjustmentError(422, message, code, details)
}
