/**
 * Phase 5A1 compatibility re-export.
 * Prefer importing from `../bank-statements/bank-statement.repository.js` for new code.
 */
export {
  createImportBatch,
  createStatement,
  createStatementLine,
  markStatementValidated,
  findStatementByUniquenessKey,
  type CreateImportBatchInput,
  type CreateStatementInput,
  type CreateStatementLineInput,
} from '../bank-statements/bank-statement.repository.js'
