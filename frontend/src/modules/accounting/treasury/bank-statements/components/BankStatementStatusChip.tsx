import { ErpStatusChip } from '@/components/erp/ErpStatusChip'
import type { BankStatementImportStatus, BankStatementStatus, PreviewRowStatus } from '../api/bank-statement.types'
import {
  IMPORT_BATCH_STATUS_LABELS,
  PREVIEW_ROW_STATUS_LABELS,
  STATEMENT_STATUS_LABELS,
  importBatchStatusTone,
  previewRowStatusTone,
  statementStatusTone,
} from '../utils/bankStatementUi'

export function BankStatementStatusChip({ status }: { status: BankStatementStatus }) {
  return (
    <ErpStatusChip tone={statementStatusTone(status)} label={STATEMENT_STATUS_LABELS[status] ?? status} />
  )
}

export function ImportBatchStatusChip({ status }: { status: BankStatementImportStatus }) {
  return (
    <ErpStatusChip tone={importBatchStatusTone(status)} label={IMPORT_BATCH_STATUS_LABELS[status] ?? status} />
  )
}

export function PreviewRowStatusChip({ status }: { status: PreviewRowStatus }) {
  return (
    <ErpStatusChip tone={previewRowStatusTone(status)} label={PREVIEW_ROW_STATUS_LABELS[status] ?? status} />
  )
}
