export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
    public readonly errors?: Array<{ field: string; message: string }>,
    /** Extra payload fields (e.g. `missingFields` for stage gates). */
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors?: Array<{ field: string; message: string }>) {
    super(400, message, 'VALIDATION_ERROR', errors)
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, message, 'AUTHENTICATION_ERROR')
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(403, message, 'PERMISSION_DENIED')
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, message, 'NOT_FOUND')
  }
}

export class ConflictError extends AppError {
  constructor(
    message = 'Resource conflict',
    errors?: Array<{ field: string; message: string }>,
    details?: Record<string, unknown>,
  ) {
    super(409, message, 'CONFLICT', errors, details)
  }
}

export class TenantMismatchError extends AppError {
  constructor(message = 'Tenant access denied') {
    super(403, message, 'TENANT_ACCESS_DENIED')
  }
}

export class InvalidStateError extends AppError {
  constructor(message = 'Invalid state transition') {
    super(422, message, 'INVALID_STATE')
  }
}

/** Business rule rejection (422) with a stable product `code` (e.g. sign-off blockers). */
export class UnprocessableEntityError extends AppError {
  constructor(
    message: string,
    code: string,
    errors?: Array<{ field: string; message: string }>,
    details?: Record<string, unknown>,
  ) {
    super(422, message, code, errors, details)
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(500, message, 'DATABASE_ERROR')
  }
}
