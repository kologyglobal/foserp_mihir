import { AppError, ConflictError, NotFoundError } from '../../../utils/errors.js'

export class BudgetVersionNotFoundError extends NotFoundError {
  constructor(message = 'Budget version not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BUDGET_VERSION_NOT_FOUND' })
  }
}

export class BudgetLineNotFoundError extends NotFoundError {
  constructor(message = 'Budget line not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BUDGET_LINE_NOT_FOUND' })
  }
}

export class BudgetCodeConflictError extends ConflictError {
  constructor(message = 'A budget version with this code already exists') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BUDGET_CODE_CONFLICT' })
  }
}

export class BudgetLineConflictError extends ConflictError {
  constructor(message = 'A budget line for this account already exists on the version') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BUDGET_LINE_CONFLICT' })
  }
}

export class BudgetValidationError extends AppError {
  constructor(message: string, fieldErrors?: Array<{ field: string; message: string }>) {
    super(400, message, 'BUDGET_VALIDATION_FAILED', fieldErrors)
  }
}

export class BudgetStaleVersionError extends ConflictError {
  constructor(message = 'Budget version was updated by another user. Refresh and retry.') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BUDGET_STALE_VERSION' })
  }
}

export class BudgetLifecycleError extends AppError {
  constructor(message: string) {
    super(422, message, 'BUDGET_LIFECYCLE_INVALID')
  }
}
