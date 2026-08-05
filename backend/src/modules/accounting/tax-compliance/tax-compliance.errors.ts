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

export class GstEWayBillExtendError extends AppError {
  constructor(message: string) {
    super(422, message, 'GST_EWAY_EXTEND')
  }
}

export class Gstr2bBatchNotFoundError extends AppError {
  constructor(message = 'GSTR-2B import batch not found') {
    super(404, message, 'GSTR2B_BATCH_NOT_FOUND')
  }
}

export class Gstr2bBatchImmutableError extends AppError {
  constructor(message: string) {
    super(422, message, 'GSTR2B_BATCH_IMMUTABLE')
  }
}

export class Gstr2bBatchStateError extends AppError {
  constructor(message: string) {
    super(422, message, 'GSTR2B_BATCH_STATE')
  }
}

export class Gstr2bFollowUpNotFoundError extends AppError {
  constructor(message = 'GSTR-2B vendor follow-up not found') {
    super(404, message, 'GSTR2B_FOLLOW_UP_NOT_FOUND')
  }
}
