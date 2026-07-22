import { AppError } from '../../utils/errors.js'

export class ReportNotFoundError extends AppError {
  constructor(reportKey: string) {
    super(404, `Unknown report key: ${reportKey}`, 'REPORT_NOT_FOUND')
  }
}

export class ReportExportNotSupportedError extends AppError {
  constructor(reportKey: string) {
    super(400, `Report "${reportKey}" does not support export`, 'REPORT_EXPORT_NOT_SUPPORTED')
  }
}

export class ReportExportLimitExceededError extends AppError {
  constructor(limit: number) {
    super(400, `Export is limited to ${limit} rows; narrow your filters and try again`, 'REPORT_EXPORT_LIMIT_EXCEEDED')
  }
}
