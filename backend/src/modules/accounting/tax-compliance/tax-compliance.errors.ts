import { AppError } from '../../../utils/errors.js'

export class GstExtractDateRangeError extends AppError {
  constructor(message = 'Invalid GST extract date range') {
    super(400, message, 'GST_EXTRACT_DATE_RANGE')
  }
}

export class GstEInvoiceNotReadyError extends AppError {
  constructor(message: string) {
    super(422, message, 'GST_EINVOICE_NOT_READY')
  }
}

export class GstEInvoiceGenerateError extends AppError {
  constructor(message: string, documentId?: string) {
    super(422, message, 'GST_EINVOICE_GENERATE', undefined, documentId ? { documentId } : undefined)
  }
}

export class GstEInvoiceCancelError extends AppError {
  constructor(message: string) {
    super(422, message, 'GST_EINVOICE_CANCEL')
  }
}

export class GstEWayBillNotReadyError extends AppError {
  constructor(message: string) {
    super(422, message, 'GST_EWAY_NOT_READY')
  }
}

export class GstEWayBillGenerateError extends AppError {
  constructor(message: string, documentId?: string) {
    super(422, message, 'GST_EWAY_GENERATE', undefined, documentId ? { documentId } : undefined)
  }
}

export class GstEWayBillCancelError extends AppError {
  constructor(message: string) {
    super(422, message, 'GST_EWAY_CANCEL')
  }
}

export class GstEWayBillVehicleUpdateError extends AppError {
  constructor(message: string) {
    super(422, message, 'GST_EWAY_VEHICLE_UPDATE')
  }
}
