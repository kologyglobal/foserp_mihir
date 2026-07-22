import {
  ConflictError,
  ValidationError as BaseValidationError,
} from '../../../utils/errors.js'

export class VersionConflictError extends ConflictError {
  constructor(message = 'Manufacturing settings were changed by another user. Refresh and retry.') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'MANUFACTURING_SETTINGS_VERSION_CONFLICT' })
    this.name = 'VersionConflictError'
  }
}

export class ValidationError extends BaseValidationError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(message, errors)
    Object.defineProperty(this, 'code', { value: 'MANUFACTURING_SETTINGS_VALIDATION_FAILED' })
    this.name = 'ManufacturingSettingsValidationError'
  }
}
