import { AppError } from '../../../../utils/errors.js'

export class ReceivableReportingError extends AppError {
  constructor(statusCode: number, message: string, code: string, errors?: Array<{ field: string; message: string }>) {
    super(statusCode, message, code, errors)
    this.name = 'ReceivableReportingError'
  }
}

export class ReceivableReportDateInFutureError extends ReceivableReportingError {
  constructor(reportDate: string, today: string) {
    super(
      422,
      `Report date ${reportDate} cannot be in the future (today is ${today})`,
      'RECEIVABLE_REPORT_DATE_IN_FUTURE',
      [{ field: 'reportDate', message: 'Report date cannot be in the future' }],
    )
    this.name = 'ReceivableReportDateInFutureError'
  }
}

export class ArHistoricalAsOfNotSupportedError extends ReceivableReportingError {
  constructor(asOfDate: string, today: string) {
    super(
      422,
      `Historical as-of reconciliation is not supported for ${asOfDate}. Use today (${today}).`,
      'AR_HISTORICAL_AS_OF_NOT_SUPPORTED',
      [{ field: 'asOfDate', message: 'Only today is supported for AR reconciliation' }],
    )
    this.name = 'ArHistoricalAsOfNotSupportedError'
  }
}

export class ReceivableInvalidAmountRangeError extends ReceivableReportingError {
  constructor() {
    super(400, 'amountFrom must be less than or equal to amountTo', 'RECEIVABLE_INVALID_AMOUNT_RANGE', [
      { field: 'amountFrom', message: 'Must be <= amountTo' },
    ])
    this.name = 'ReceivableInvalidAmountRangeError'
  }
}

export class ReceivableInvalidSortFieldError extends ReceivableReportingError {
  constructor(sortBy: string) {
    super(400, `Invalid sort field: ${sortBy}`, 'RECEIVABLE_INVALID_SORT_FIELD', [
      { field: 'sortBy', message: 'Sort field is not allowed' },
    ])
    this.name = 'ReceivableInvalidSortFieldError'
  }
}

export class ReceivableCustomerNotFoundError extends ReceivableReportingError {
  constructor(customerId: string) {
    super(404, 'Customer not found for receivable summary', 'RECEIVABLE_CUSTOMER_NOT_FOUND', [
      { field: 'customerId', message: customerId },
    ])
    this.name = 'ReceivableCustomerNotFoundError'
  }
}

export class ReceivableLegalEntityRequiredError extends ReceivableReportingError {
  constructor() {
    super(400, 'legalEntityId is required', 'RECEIVABLE_LEGAL_ENTITY_REQUIRED', [
      { field: 'legalEntityId', message: 'Required' },
    ])
    this.name = 'ReceivableLegalEntityRequiredError'
  }
}

export class ReceivableInvalidReportDateError extends ReceivableReportingError {
  constructor() {
    super(400, 'Invalid reportDate format — use YYYY-MM-DD', 'RECEIVABLE_INVALID_REPORT_DATE', [
      { field: 'reportDate', message: 'Must be YYYY-MM-DD' },
    ])
    this.name = 'ReceivableInvalidReportDateError'
  }
}

export class ReceivableInvalidAgeingBucketError extends ReceivableReportingError {
  constructor(bucket: string, basis: string) {
    super(400, `Ageing bucket ${bucket} is invalid for basis ${basis}`, 'RECEIVABLE_INVALID_AGEING_BUCKET', [
      { field: 'ageingBucket', message: 'Bucket does not match ageingBasis' },
    ])
    this.name = 'ReceivableInvalidAgeingBucketError'
  }
}
