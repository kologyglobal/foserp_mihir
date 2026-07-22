import { AppError } from '../../../../utils/errors.js'

export class PayableReportingError extends AppError {
  constructor(statusCode: number, message: string, code: string, errors?: Array<{ field: string; message: string }>) {
    super(statusCode, message, code, errors)
    this.name = 'PayableReportingError'
  }
}

export class PayableReportDateInFutureError extends PayableReportingError {
  constructor(reportDate: string, today: string) {
    super(
      422,
      `Report date ${reportDate} cannot be in the future (today is ${today})`,
      'PAYABLE_REPORT_DATE_IN_FUTURE',
      [{ field: 'reportDate', message: 'Report date cannot be in the future' }],
    )
    this.name = 'PayableReportDateInFutureError'
  }
}

export class PayableInvalidAmountRangeError extends PayableReportingError {
  constructor() {
    super(400, 'amountFrom must be less than or equal to amountTo', 'PAYABLE_INVALID_AMOUNT_RANGE', [
      { field: 'amountFrom', message: 'Must be <= amountTo' },
    ])
    this.name = 'PayableInvalidAmountRangeError'
  }
}

export class PayableInvalidSortFieldError extends PayableReportingError {
  constructor(sortBy: string) {
    super(400, `Invalid sort field: ${sortBy}`, 'PAYABLE_INVALID_SORT_FIELD', [
      { field: 'sortBy', message: 'Sort field is not allowed' },
    ])
    this.name = 'PayableInvalidSortFieldError'
  }
}

export class PayableVendorNotFoundError extends PayableReportingError {
  constructor(vendorId: string) {
    super(404, 'Vendor not found for payable summary', 'PAYABLE_VENDOR_NOT_FOUND', [
      { field: 'vendorId', message: vendorId },
    ])
    this.name = 'PayableVendorNotFoundError'
  }
}

export class PayableInvalidAgeingBucketError extends PayableReportingError {
  constructor(bucket: string, basis: string) {
    super(400, `Ageing bucket ${bucket} is invalid for basis ${basis}`, 'PAYABLE_INVALID_AGEING_BUCKET', [
      { field: 'ageingBucket', message: 'Bucket does not match ageingBasis' },
    ])
    this.name = 'PayableInvalidAgeingBucketError'
  }
}
