/** Phase 5A1 compatibility re-export — implementation lives in bank-statements/. */
export {
  validateStatementHeader,
  computeLineTotals,
  validateLineTotalsMatchHeader,
  validateStatementOperational,
  type BankStatementHeaderInput,
  type BankStatementValidationResult,
  type BankStatementLineTotalsInput,
} from '../bank-statements/bank-statement-validation.service.js'
