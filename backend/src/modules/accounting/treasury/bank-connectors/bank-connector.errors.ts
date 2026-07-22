import { AppError, ConflictError, NotFoundError } from '../../../../utils/errors.js'

export class BankConnectorNotFoundError extends NotFoundError {
  constructor(message = 'Bank connector not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_CONNECTOR_NOT_FOUND' })
  }
}

export class BankConnectorCodeConflictError extends ConflictError {
  constructor(message = 'A bank connector with this code already exists') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_CONNECTOR_CODE_CONFLICT' })
  }
}

export class BankConnectorValidationError extends AppError {
  constructor(message: string, fieldErrors?: Array<{ field: string; message: string }>) {
    super(400, message, 'BANK_CONNECTOR_VALIDATION_FAILED', fieldErrors)
  }
}

export class BankConnectorStaleVersionError extends ConflictError {
  constructor(message = 'Bank connector was updated by another user. Refresh and retry.') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_CONNECTOR_STALE_VERSION' })
  }
}

/** Phase 5D1 — adapters are stubs; never invent success or statement data. */
export class BankConnectorNotImplementedError extends AppError {
  constructor(message = 'Bank connector provider is not implemented yet (Phase 5D1 scaffold)') {
    super(422, message, 'BANK_CONNECTOR_NOT_IMPLEMENTED')
  }
}

export class BankConnectorProviderDisabledError extends AppError {
  constructor(message = 'Bank connector is disabled') {
    super(422, message, 'BANK_CONNECTOR_PROVIDER_DISABLED')
  }
}

export class BankConnectorNotConfiguredError extends AppError {
  constructor(message = 'Bank connector is not configured for live pull') {
    super(422, message, 'BANK_CONNECTOR_NOT_CONFIGURED')
  }
}

export class BankConnectorProbeFailedError extends AppError {
  constructor(message = 'Bank connector probe failed') {
    super(422, message, 'BANK_CONNECTOR_PROBE_FAILED')
  }
}
