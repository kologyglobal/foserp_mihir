import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
export class QualityInspectionNotFoundError extends NotFoundError {
  constructor() { super('Quality inspection not found.'); Object.defineProperty(this, 'code', { value: 'QUALITY_INSPECTION_NOT_FOUND' }) }
}
export class QualityInspectionWorkflowError extends InvalidStateError {
  constructor(message: string) { super(message); Object.defineProperty(this, 'code', { value: 'QUALITY_INSPECTION_INVALID_STATE' }) }
}
export class QualityInspectionValidationError extends ValidationError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(message, errors ?? [{ field: 'body', message }])
    Object.defineProperty(this, 'code', { value: 'QUALITY_INSPECTION_VALIDATION_FAILED' })
  }
}

/** Open QI already linked to this goods receipt — block duplicate create. */
export class QualityInspectionDuplicateForGrnError extends ConflictError {
  constructor(inspectionNumber: string, existingQualityInspectionId: string) {
    super(
      `Quality inspection ${inspectionNumber} already exists for this goods receipt.`,
      [{ field: 'goodsReceiptId', message: `Open inspection ${inspectionNumber} is already linked to this GRN.` }],
      { existingQualityInspectionId, inspectionNumber },
    )
    Object.defineProperty(this, 'code', { value: 'QI_DUPLICATE_FOR_GRN' })
  }
}
