export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
    public readonly errors?: Array<{ field: string; message: string }>,
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
    super(403, message, 'AUTHORIZATION_ERROR')
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, message, 'NOT_FOUND')
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(409, message, 'CONFLICT')
  }
}

export class TenantMismatchError extends AppError {
  constructor(message = 'Tenant access denied') {
    super(403, message, 'TENANT_MISMATCH')
  }
}

export class InvalidStateError extends AppError {
  constructor(message = 'Invalid state transition') {
    super(422, message, 'INVALID_STATE')
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(500, message, 'DATABASE_ERROR')
  }
}
