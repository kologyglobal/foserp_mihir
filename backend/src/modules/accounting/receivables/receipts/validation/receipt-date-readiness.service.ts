import { resolvePeriodByDate } from '../../../posting/posting-period.service.js'
import type { ReceiptValidationIssue } from '../calculation/customer-receipt-calculation.types.js'
import {
  RECEIPT_ERROR_CODES,
  RECEIPT_WARNING_CODES,
  receiptError,
  receiptWarning,
} from '../calculation/customer-receipt-calculation.errors.js'

export interface ReceiptPeriodReadiness {
  financialYearResolved: boolean
  accountingPeriodResolved: boolean
  periodStatus?: string
  financialYearId?: string | null
  periodId?: string | null
  issues: ReceiptValidationIssue[]
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value)
}

/**
 * Date and posting-period readiness — does not post.
 * Closed / under-review periods are blocking errors for receipt posting readiness
 * (stricter than invoice draft preview, matching Phase 3B2 spec).
 */
export async function resolveReceiptDateReadiness(
  tenantId: string,
  legalEntityId: string,
  dates: {
    receiptDate: string
    postingDate: string
    valueDate?: string | null
    instrumentDate?: string | null
  },
): Promise<ReceiptPeriodReadiness> {
  const issues: ReceiptValidationIssue[] = []

  for (const [field, value] of [
    ['receiptDate', dates.receiptDate],
    ['postingDate', dates.postingDate],
  ] as const) {
    if (!isValidIsoDate(value)) {
      issues.push(
        receiptError(RECEIPT_ERROR_CODES.RECEIPT_POSTING_DATE_INVALID, `Invalid ${field}`, field),
      )
    }
  }

  if (dates.valueDate && !isValidIsoDate(dates.valueDate)) {
    issues.push(
      receiptError(RECEIPT_ERROR_CODES.RECEIPT_POSTING_DATE_INVALID, 'Invalid value date', 'valueDate'),
    )
  }
  if (dates.instrumentDate && !isValidIsoDate(dates.instrumentDate)) {
    issues.push(
      receiptError(RECEIPT_ERROR_CODES.RECEIPT_INSTRUMENT_DATE_REQUIRED, 'Invalid instrument date', 'instrumentDate'),
    )
  }

  if (dates.valueDate && dates.valueDate !== dates.postingDate && isValidIsoDate(dates.valueDate)) {
    issues.push(
      receiptWarning(
        RECEIPT_WARNING_CODES.RECEIPT_VALUE_DATE_DIFFERS,
        'Value date differs from posting date',
        'valueDate',
      ),
    )
  }

  if (
    dates.instrumentDate &&
    dates.receiptDate &&
    isValidIsoDate(dates.instrumentDate) &&
    isValidIsoDate(dates.receiptDate) &&
    dates.instrumentDate > dates.receiptDate
  ) {
    issues.push(
      receiptWarning(
        RECEIPT_WARNING_CODES.RECEIPT_VALUE_DATE_DIFFERS,
        'Instrument date is after receipt date',
        'instrumentDate',
      ),
    )
  }

  // Backdated: posting date before receipt date
  if (
    isValidIsoDate(dates.postingDate) &&
    isValidIsoDate(dates.receiptDate) &&
    dates.postingDate < dates.receiptDate
  ) {
    issues.push(
      receiptWarning(
        RECEIPT_WARNING_CODES.BACKDATED_RECEIPT,
        'Posting date is before receipt date',
        'postingDate',
      ),
    )
  }

  if (issues.some((i) => i.severity === 'ERROR' && i.field === 'postingDate')) {
    return {
      financialYearResolved: false,
      accountingPeriodResolved: false,
      issues,
    }
  }

  try {
    const resolved = await resolvePeriodByDate(tenantId, legalEntityId, dates.postingDate)
    const financialYearActive = resolved.financialYear.status === 'ACTIVE'
    const periodStatus = resolved.period.status

    if (!financialYearActive) {
      issues.push(
        receiptError(
          RECEIPT_ERROR_CODES.RECEIPT_POSTING_DATE_INVALID,
          'Financial year is not active',
          'postingDate',
        ),
      )
    }

    if (periodStatus === 'CLOSED') {
      issues.push(
        receiptError(
          RECEIPT_ERROR_CODES.RECEIPT_POSTING_PERIOD_CLOSED,
          'Accounting period is closed — posting readiness blocked',
          'postingDate',
        ),
      )
    } else if (periodStatus === 'UNDER_REVIEW') {
      issues.push(
        receiptError(
          RECEIPT_ERROR_CODES.RECEIPT_POSTING_PERIOD_UNDER_REVIEW,
          'Accounting period is under review — posting readiness blocked',
          'postingDate',
        ),
      )
    } else if (periodStatus !== 'OPEN' && periodStatus !== 'REOPENED') {
      issues.push(
        receiptError(
          RECEIPT_ERROR_CODES.RECEIPT_POSTING_PERIOD_CLOSED,
          `Accounting period status ${periodStatus} does not allow posting`,
          'postingDate',
        ),
      )
    }

    return {
      financialYearResolved: true,
      accountingPeriodResolved: true,
      periodStatus,
      financialYearId: resolved.financialYear.id,
      periodId: resolved.period.id,
      issues,
    }
  } catch {
    issues.push(
      receiptError(
        RECEIPT_ERROR_CODES.RECEIPT_POSTING_DATE_INVALID,
        'Could not resolve financial year or accounting period for posting date',
        'postingDate',
      ),
    )
    return {
      financialYearResolved: false,
      accountingPeriodResolved: false,
      issues,
    }
  }
}
