import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
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
