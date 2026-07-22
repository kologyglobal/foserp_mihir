import { AppError, ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'

export class TreasuryAccountNotFoundError extends NotFoundError {
  constructor(message = 'Treasury account not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_ACCOUNT_NOT_FOUND' })
  }
}

export class TreasuryAccountCodeConflictError extends ConflictError {
  constructor(message = 'Treasury account code already exists for this legal entity') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_ACCOUNT_CODE_CONFLICT' })
  }
}

/** Generic optimistic-concurrency error for any treasury-module record (accounts, mappings, recon profiles). */
export class TreasuryStaleVersionError extends AppError {
  constructor(message = 'Record was modified by another request; reload and retry') {
    super(409, message, 'TREASURY_STALE_VERSION')
  }
}

export class TreasuryAccountStaleVersionError extends TreasuryStaleVersionError {
  constructor(message = 'Treasury account was modified by another request; reload and retry') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_ACCOUNT_STALE_VERSION' })
  }
}

export class TreasuryAccountGlMappingConflictError extends ConflictError {
  constructor(message = 'Another active treasury account already maps to this GL account') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_ACCOUNT_GL_MAPPING_CONFLICT' })
  }
}

export class TreasuryAccountGlAccountInvalidError extends ValidationError {
  constructor(message = 'GL account is not valid for this treasury account type') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_ACCOUNT_GL_ACCOUNT_INVALID' })
  }
}

export class TreasuryAccountInvalidStateError extends InvalidStateError {
  constructor(message = 'Treasury account is not in a valid state for this action') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_ACCOUNT_INVALID_STATE' })
  }
}

/** Bank account numbers require a hashing secret before they can be persisted (never plaintext-only). */
export class TreasuryBankAccountSecurityUnavailableError extends AppError {
  constructor(
    message = 'TREASURY_ACCOUNT_HMAC_SECRET (or FIELD_ENCRYPTION_KEY) is not configured; bank accounts cannot be created with an account number until one is set. You may still create the account without an account number.',
  ) {
    super(422, message, 'TREASURY_BANK_ACCOUNT_SECURITY_UNAVAILABLE')
  }
}

export class TreasuryBankAccountDuplicateNumberError extends ConflictError {
  constructor(message = 'An active bank account with this account number already exists for this legal entity')  {
    super(message)
    Object.defineProperty(this, 'code', { value: 'TREASURY_BANK_ACCOUNT_DUPLICATE_NUMBER' })
  }
}

export class PaymentAccountMappingNotFoundError extends NotFoundError {
  constructor(message = 'Payment account mapping not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'PAYMENT_ACCOUNT_MAPPING_NOT_FOUND' })
  }
}

export class PaymentAccountMappingAmbiguousError extends ConflictError {
  constructor(message = 'Multiple equally specific payment account mappings match this request') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'PAYMENT_ACCOUNT_MAPPING_AMBIGUOUS' })
  }
}

export class PaymentAccountMappingNoMatchError extends NotFoundError {
  constructor(message = 'No payment account mapping matches this payment method / use case') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'PAYMENT_ACCOUNT_MAPPING_NO_MATCH' })
  }
}

export class PaymentAccountMappingDefaultConflictError extends ConflictError {
  constructor(message = 'A default mapping already exists for this payment method / use case / direction') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'PAYMENT_ACCOUNT_MAPPING_DEFAULT_CONFLICT' })
  }
}

export class PaymentAccountMappingClearingAccountRequiredError extends ValidationError {
  constructor(message = 'A clearing account is required when role is CLEARING or SETTLEMENT') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'PAYMENT_ACCOUNT_MAPPING_CLEARING_ACCOUNT_REQUIRED' })
  }
}

export class BankReconciliationProfileNotFoundError extends NotFoundError {
  constructor(message = 'Bank reconciliation profile not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECONCILIATION_PROFILE_NOT_FOUND' })
  }
}

export class BankReconciliationProfileBankOnlyError extends ValidationError {
  constructor(message = 'Reconciliation settings are only available for BANK treasury accounts') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECONCILIATION_PROFILE_BANK_ONLY' })
  }
}

export class BankReconciliationProfileReadOnlyFieldError extends ValidationError {
  constructor(message = 'lastReconciled* fields are read-only from this endpoint') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECONCILIATION_PROFILE_READ_ONLY_FIELD' })
  }
}

// ── Bank statement import (Phase 5A2) ─────────────────────────────────────────

export class BankStatementNotFoundError extends NotFoundError {
  constructor(message = 'Bank statement not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_STATEMENT_NOT_FOUND' })
  }
}

export class BankStatementLineNotFoundError extends NotFoundError {
  constructor(message = 'Bank statement line not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_STATEMENT_LINE_NOT_FOUND' })
  }
}

export class BankStatementImportBatchNotFoundError extends NotFoundError {
  constructor(message = 'Bank statement import batch not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_STATEMENT_IMPORT_BATCH_NOT_FOUND' })
  }
}

export class BankStatementMappingTemplateNotFoundError extends NotFoundError {
  constructor(message = 'Bank statement mapping template not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_STATEMENT_MAPPING_TEMPLATE_NOT_FOUND' })
  }
}

export class BankStatementStaleVersionError extends AppError {
  constructor(message = 'Bank statement was modified by another request; reload and retry') {
    super(409, message, 'BANK_STATEMENT_STALE_VERSION')
  }
}

export class BankStatementImportBatchStaleVersionError extends AppError {
  constructor(message = 'Import batch was modified by another request; reload and retry') {
    super(409, message, 'BANK_STATEMENT_IMPORT_BATCH_STALE_VERSION')
  }
}

export class BankStatementMappingTemplateStaleVersionError extends AppError {
  constructor(message = 'Mapping template was modified by another request; reload and retry') {
    super(409, message, 'BANK_STATEMENT_MAPPING_TEMPLATE_STALE_VERSION')
  }
}

export class BankStatementInvalidStateError extends InvalidStateError {
  constructor(message = 'Bank statement is not in a valid state for this action') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_STATEMENT_INVALID_STATE' })
  }
}

export class BankStatementImportBatchInvalidStateError extends InvalidStateError {
  constructor(message = 'Import batch is not in a valid state for this action') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_STATEMENT_IMPORT_BATCH_INVALID_STATE' })
  }
}

export class BankStatementDuplicateFileError extends ConflictError {
  constructor(message = 'An import batch with this file checksum already exists for this treasury account') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_STATEMENT_DUPLICATE_FILE' })
  }
}

export class BankStatementDuplicateStatementError extends ConflictError {
  constructor(message = 'A bank statement with the same uniqueness key already exists') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_STATEMENT_DUPLICATE_STATEMENT' })
  }
}

export class BankStatementFileTooLargeError extends ValidationError {
  constructor(message = 'Bank statement file exceeds the maximum allowed size') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_STATEMENT_FILE_TOO_LARGE' })
  }
}

export class BankStatementFileTypeRejectedError extends ValidationError {
  constructor(message = 'Bank statement file type is not supported') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_STATEMENT_FILE_TYPE_REJECTED' })
  }
}

export class BankStatementFileSecurityRejectedError extends ValidationError {
  constructor(message = 'Bank statement file failed security validation') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_STATEMENT_FILE_SECURITY_REJECTED' })
  }
}

export class BankStatementRowLimitExceededError extends ValidationError {
  constructor(message = 'Bank statement file exceeds the maximum row count') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_STATEMENT_ROW_LIMIT_EXCEEDED' })
  }
}

export class BankStatementColumnLimitExceededError extends ValidationError {
  constructor(message = 'Bank statement file exceeds the maximum column count') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_STATEMENT_COLUMN_LIMIT_EXCEEDED' })
  }
}

export class BankStatementImportStrictErrorsError extends ValidationError {
  constructor(message = 'Import has validation errors; use allowPartial with confirmation to import valid rows only') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_STATEMENT_IMPORT_STRICT_ERRORS' })
  }
}

export class BankStatementMappingTemplateNameConflictError extends ConflictError {
  constructor(message = 'A mapping template with this name already exists for this legal entity') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_STATEMENT_MAPPING_TEMPLATE_NAME_CONFLICT' })
  }
}

export class BankStatementTreasuryAccountInvalidError extends ValidationError {
  constructor(message = 'Treasury account is not valid for bank statement operations') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_STATEMENT_TREASURY_ACCOUNT_INVALID' })
  }
}
