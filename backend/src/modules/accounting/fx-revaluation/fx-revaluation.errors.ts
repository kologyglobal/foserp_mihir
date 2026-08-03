import { AppError } from '../../../utils/errors.js'

export const FX_REVAL_ERROR_CODES = {
  MULTI_CURRENCY_OFF: 'FX_REVAL_MULTI_CURRENCY_OFF',
  RATE_MISSING: 'FX_REVAL_RATE_MISSING',
  MAPPING_MISSING: 'FX_REVAL_MAPPING_MISSING',
  NOT_EDITABLE: 'FX_REVAL_NOT_EDITABLE',
  NOT_PREVIEWED: 'FX_REVAL_NOT_PREVIEWED',
  ALREADY_POSTED: 'FX_REVAL_ALREADY_POSTED',
  PERIOD_NOT_OPEN: 'FX_REVAL_PERIOD_NOT_OPEN',
  NEXT_PERIOD_MISSING: 'FX_REVAL_NEXT_PERIOD_MISSING',
  POSTING_FAILED: 'FX_REVAL_POSTING_FAILED',
  NO_LINES: 'FX_REVAL_NO_LINES',
} as const

export type FxRevalErrorCode = (typeof FX_REVAL_ERROR_CODES)[keyof typeof FX_REVAL_ERROR_CODES]

export class FxRevalError extends AppError {
  constructor(statusCode: number, message: string, code: FxRevalErrorCode, details?: Record<string, unknown>) {
    super(statusCode, message, code, undefined, details)
  }
}

export function unprocessable(message: string, code: FxRevalErrorCode, details?: Record<string, unknown>) {
  return new FxRevalError(422, message, code, details)
}
