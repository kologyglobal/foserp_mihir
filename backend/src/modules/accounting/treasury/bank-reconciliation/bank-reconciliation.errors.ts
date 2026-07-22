import { AppError, ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../../utils/errors.js'

export class BankReconciliationSessionNotFoundError extends NotFoundError {
  constructor(message = 'Bank reconciliation session not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_SESSION_NOT_FOUND' })
  }
}

export class BankReconciliationSessionInvalidStateError extends InvalidStateError {
  constructor(message = 'Bank reconciliation session is not in a valid state for this action') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_SESSION_INVALID_STATE' })
  }
}

export class BankStatementNotReadyForReconciliationError extends InvalidStateError {
  constructor(message = 'Bank statement must be VALIDATED before reconciliation can begin') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_STATEMENT_NOT_READY' })
  }
}

export class BankReconciliationMatchNotFoundError extends NotFoundError {
  constructor(message = 'Bank reconciliation match not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_MATCH_NOT_FOUND' })
  }
}

export class BankReconciliationMatchAlreadyReversedError extends InvalidStateError {
  constructor(message = 'Bank reconciliation match has already been unmatched') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_MATCH_ALREADY_REVERSED' })
  }
}

export class BankReconciliationLineNotFoundError extends NotFoundError {
  constructor(message = 'Bank statement line not found for this reconciliation session') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_LINE_NOT_FOUND' })
  }
}

export class BankReconciliationLedgerEntryNotFoundError extends NotFoundError {
  constructor(message = 'General ledger entry not found or not eligible for reconciliation') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_LEDGER_ENTRY_NOT_FOUND' })
  }
}

export class BankReconciliationAmountMismatchError extends ValidationError {
  constructor(message = 'Statement allocation total must equal ledger allocation total') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_AMOUNT_MISMATCH' })
  }
}

export class BankReconciliationCurrencyMismatchError extends ValidationError {
  constructor(message = 'Statement line and ledger entry currencies must match') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_CURRENCY_MISMATCH' })
  }
}

export class BankReconciliationDirectionMismatchError extends ValidationError {
  constructor(message = 'Statement CREDIT lines require a DEBIT ledger entry and vice-versa') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_DIRECTION_MISMATCH' })
  }
}

export class BankReconciliationMixedSourceError extends ValidationError {
  constructor(message = 'A single match cannot mix DIRECT bank-GL and CLEARING-GL ledger entries') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_MIXED_SOURCE' })
  }
}

export class BankReconciliationGroupSizeExceededError extends ValidationError {
  constructor(message = 'Match exceeds the configured maximum group size') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_GROUP_SIZE_EXCEEDED' })
  }
}

export class BankReconciliationAlreadyAllocatedError extends ConflictError {
  constructor(message = 'One or more lines/entries selected are already fully allocated') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_ALREADY_ALLOCATED' })
  }
}

export class BankReconciliationPartialNotAllowedError extends ValidationError {
  constructor(message = 'Partial matching is not enabled for this treasury account') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_PARTIAL_NOT_ALLOWED' })
  }
}

export class BankReconciliationGroupedNotAllowedError extends ValidationError {
  constructor(message = 'Grouped (1:N / N:1) matching is not enabled for this treasury account') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_GROUPED_NOT_ALLOWED' })
  }
}

export class BankReconciliationIdempotencyPayloadMismatchError extends ConflictError {
  constructor(message = 'idempotencyKey was already used with a different payload') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_IDEMPOTENCY_PAYLOAD_MISMATCH' })
  }
}

export class BankReconciliationConcurrentChangeError extends ConflictError {
  constructor(message = 'Reconciliation data changed concurrently; reload and retry') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_CONCURRENT_CHANGE' })
  }
}

export class BankReconciliationSuggestionNotFoundError extends NotFoundError {
  constructor(message = 'Reconciliation suggestion not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_SUGGESTION_NOT_FOUND' })
  }
}

export class BankReconciliationSuggestionNotPendingError extends InvalidStateError {
  constructor(message = 'Suggestion is no longer pending (accepted, rejected, expired or invalidated)') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_SUGGESTION_NOT_PENDING' })
  }
}

export class BankReconciliationExceptionNotFoundError extends NotFoundError {
  constructor(message = 'Reconciliation exception not found') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_EXCEPTION_NOT_FOUND' })
  }
}

export class BankReconciliationExceptionAlreadyResolvedError extends InvalidStateError {
  constructor(message = 'Exception has already been resolved') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_EXCEPTION_ALREADY_RESOLVED' })
  }
}

export class BankReconciliationFinalizeIncompleteError extends InvalidStateError {
  constructor(message = 'All statement lines must be matched or excluded before finalizing') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_FINALIZE_INCOMPLETE' })
  }
}

export class BankReconciliationFinalizeToleranceExceededError extends InvalidStateError {
  constructor(message = 'Reconciliation difference exceeds the configured finalization tolerance') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_FINALIZE_TOLERANCE_EXCEEDED' })
  }
}

export class BankReconciliationAlreadyFinalizedError extends InvalidStateError {
  constructor(message = 'Reconciliation session is already finalized') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_ALREADY_FINALIZED' })
  }
}

export class BankReconciliationNotFinalizedError extends InvalidStateError {
  constructor(message = 'Reconciliation session is not finalized') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_NOT_FINALIZED' })
  }
}

export class BankReconciliationClearingMappingNotFoundError extends NotFoundError {
  constructor(message = 'No CLEARING/SETTLEMENT payment account mapping configured for this treasury account') {
    super(message)
    Object.defineProperty(this, 'code', { value: 'BANK_RECON_CLEARING_MAPPING_NOT_FOUND' })
  }
}

export class BankReconciliationPostingFailedError extends AppError {
  constructor(message = 'Bank reconciliation clearing settlement posting failed') {
    super(422, message, 'BANK_RECON_POSTING_FAILED')
  }
}
