import { AppError } from '../../../utils/errors.js'

export class YearEndCloseError extends AppError {
  constructor(statusCode: number, message: string, code: string, details?: Record<string, unknown>) {
    super(statusCode, message, code, undefined, details)
    this.name = 'YearEndCloseError'
  }
}

export const YEAR_END_CLOSE_ERROR_CODES = {
  YEAR_END_ALREADY_POSTED: 'YEAR_END_ALREADY_POSTED',
  YEAR_END_FY_NOT_ACTIVE: 'YEAR_END_FY_NOT_ACTIVE',
  YEAR_END_FY_CLOSED: 'YEAR_END_FY_CLOSED',
  YEAR_END_PERIODS_OPEN: 'YEAR_END_PERIODS_OPEN',
  YEAR_END_LAST_PERIOD_NOT_OPEN: 'YEAR_END_LAST_PERIOD_NOT_OPEN',
  YEAR_END_RETAINED_EARNINGS_MISSING: 'YEAR_END_RETAINED_EARNINGS_MISSING',
  YEAR_END_FINANCE_NOT_ACTIVATED: 'YEAR_END_FINANCE_NOT_ACTIVATED',
  YEAR_END_CLOSE_REQUIRED: 'YEAR_END_CLOSE_REQUIRED',
  YEAR_END_PERIODS_NOT_ALL_CLOSED: 'YEAR_END_PERIODS_NOT_ALL_CLOSED',
  YEAR_END_POSTING_FAILED: 'YEAR_END_POSTING_FAILED',
} as const
