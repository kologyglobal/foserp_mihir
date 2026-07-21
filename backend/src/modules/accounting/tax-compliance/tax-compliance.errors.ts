import { AppError } from '../../../utils/errors.js'

export class GstExtractDateRangeError extends AppError {
  constructor(message = 'Invalid GST extract date range') {
    super(400, message, 'GST_EXTRACT_DATE_RANGE')
  }
}
