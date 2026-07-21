import type { BankStatementImportStatus, BankStatementStatus } from '@prisma/client'

const STATEMENT_EDITABLE: BankStatementStatus[] = ['DRAFT', 'IMPORTED', 'VALIDATION_FAILED']
const STATEMENT_CANCELLABLE: BankStatementStatus[] = ['DRAFT', 'IMPORTED', 'VALIDATION_FAILED', 'VALIDATED']
const STATEMENT_VALIDATABLE: BankStatementStatus[] = ['DRAFT', 'IMPORTED', 'VALIDATION_FAILED']
const STATEMENT_REOPENABLE: BankStatementStatus[] = ['VALIDATED', 'VALIDATION_FAILED', 'IMPORTED']

const BATCH_CANCELLABLE: BankStatementImportStatus[] = ['UPLOADED']
const BATCH_INSPECTABLE: BankStatementImportStatus[] = ['UPLOADED', 'FAILED', 'PARTIALLY_IMPORTED']
const BATCH_PREVIEWABLE: BankStatementImportStatus[] = ['UPLOADED', 'FAILED', 'PARTIALLY_IMPORTED']
const BATCH_IMPORTABLE: BankStatementImportStatus[] = ['UPLOADED', 'FAILED', 'PARTIALLY_IMPORTED']
const BATCH_RETRYABLE: BankStatementImportStatus[] = ['FAILED', 'PARTIALLY_IMPORTED']

export function getStatementAllowedActions(status: BankStatementStatus) {
  return {
    canEdit: STATEMENT_EDITABLE.includes(status),
    canCancel: STATEMENT_CANCELLABLE.includes(status),
    canValidate: STATEMENT_VALIDATABLE.includes(status),
    canReopenDraft: STATEMENT_REOPENABLE.includes(status),
    canAddLine: STATEMENT_EDITABLE.includes(status),
    canEditLine: STATEMENT_EDITABLE.includes(status),
    canDeleteLine: STATEMENT_EDITABLE.includes(status),
  }
}

export function getImportBatchAllowedActions(status: BankStatementImportStatus) {
  return {
    canCancel: BATCH_CANCELLABLE.includes(status),
    canInspect: BATCH_INSPECTABLE.includes(status),
    canPreview: BATCH_PREVIEWABLE.includes(status),
    canImport: BATCH_IMPORTABLE.includes(status),
    canRetry: BATCH_RETRYABLE.includes(status),
    canDownloadFile: status !== 'CANCELLED',
  }
}
