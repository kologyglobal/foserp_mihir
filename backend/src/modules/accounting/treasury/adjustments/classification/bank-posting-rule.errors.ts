import { AppError, NotFoundError } from '../../../../../utils/errors.js'

export class BankPostingRuleNotFoundError extends NotFoundError {
  constructor(message = 'Bank posting rule not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_POSTING_RULE_NOT_FOUND' })
  }
}

export class BankPostingRuleValidationFailedError extends AppError {
  constructor(message: string, errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'BANK_POSTING_RULE_VALIDATION_FAILED', errors)
  }
}

export class BankPostingRuleNoMatchError extends AppError {
  constructor(message = 'No posting rule matched this statement line') {
    super(404, message, 'BANK_POSTING_RULE_NO_MATCH')
  }
}

export class BankPostingRuleAmbiguousError extends AppError {
  constructor(message = 'Multiple posting rules matched this statement line with the same top score', errors?: Array<{ field: string; message: string }>) {
    super(422, message, 'BANK_POSTING_RULE_AMBIGUOUS', errors)
  }
}
