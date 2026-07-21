import type { ErpStatusChipTone } from '@/components/erp/ErpStatusChip'
import type {
  BankStatementImportStatus,
  BankStatementStatus,
  ImportIssueDto,
  ImportIssueSeverity,
  PreviewRowStatus,
} from '../api/bank-statement.types'

export const IMPORT_WIZARD_STEPS = [
  { id: 1, label: 'Select Bank Account' },
  { id: 2, label: 'Upload' },
  { id: 3, label: 'Sheet / Header' },
  { id: 4, label: 'Map Columns' },
  { id: 5, label: 'Preview' },
  { id: 6, label: 'Confirm' },
  { id: 7, label: 'Review' },
] as const

export const STATEMENT_STATUS_LABELS: Record<BankStatementStatus, string> = {
  DRAFT: 'Draft',
  IMPORTED: 'Imported',
  VALIDATION_FAILED: 'Validation Failed',
  VALIDATED: 'Validated',
  READY_TO_RECONCILE: 'Ready to Reconcile',
  PARTIALLY_RECONCILED: 'Partially Reconciled',
  RECONCILED: 'Reconciled',
  CANCELLED: 'Cancelled',
}

export const IMPORT_BATCH_STATUS_LABELS: Record<BankStatementImportStatus, string> = {
  UPLOADED: 'Uploaded',
  PROCESSING: 'Processing',
  IMPORTED: 'Imported',
  PARTIALLY_IMPORTED: 'Partially Imported',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
}

export const PREVIEW_ROW_STATUS_LABELS: Record<PreviewRowStatus, string> = {
  VALID: 'Valid',
  WARNING: 'Warning',
  ERROR: 'Error',
  DUPLICATE: 'Duplicate',
}

export const AMOUNT_MODE_LABELS = {
  DEBIT_CREDIT_COLUMNS: 'Separate debit / credit columns',
  SIGNED_AMOUNT: 'Signed amount column',
  AMOUNT_WITH_DIRECTION: 'Amount + direction column',
} as const

export const MAPPABLE_FIELDS = [
  { key: 'transactionDate', label: 'Transaction date', required: true },
  { key: 'valueDate', label: 'Value date' },
  { key: 'description', label: 'Description' },
  { key: 'referenceNumber', label: 'Reference number' },
  { key: 'debitAmount', label: 'Debit amount' },
  { key: 'creditAmount', label: 'Credit amount' },
  { key: 'signedAmount', label: 'Signed amount' },
  { key: 'amount', label: 'Amount' },
  { key: 'direction', label: 'Direction' },
  { key: 'runningBalance', label: 'Running balance' },
  { key: 'counterpartyName', label: 'Counterparty name' },
  { key: 'counterpartyAccount', label: 'Counterparty account' },
  { key: 'utrReference', label: 'UTR reference' },
  { key: 'chequeNumber', label: 'Cheque number' },
  { key: 'transactionCode', label: 'Transaction code' },
] as const

/** Live statement + reconciliation sub-routes under Bank & Cash (API mode) — Phase 5A2 + 5A3. */
export const BANK_STATEMENT_LIVE_LINKS = [
  { label: 'Statements', path: '/accounting/bank-cash/statements' },
  { label: 'Import Statement', path: '/accounting/bank-cash/statements/import' },
  { label: 'Manual Statement', path: '/accounting/bank-cash/statements/manual' },
  { label: 'Mapping Templates', path: '/accounting/bank-cash/mapping-templates' },
  { label: 'Reconciliation', path: '/accounting/bank-cash/reconciliation' },
  { label: 'Reconciliation History', path: '/accounting/bank-cash/reconciliation/history' },
  { label: 'Reconciliation Exceptions', path: '/accounting/bank-cash/reconciliation/exceptions' },
  { label: 'Transfers', path: '/accounting/bank-cash/transfers' },
  { label: 'Transfers In Transit', path: '/accounting/bank-cash/transfers/in-transit' },
  { label: 'Cheques', path: '/accounting/bank-cash/cheques' },
  { label: 'Bank Transactions', path: '/accounting/bank-cash/treasury-adjustments' },
  { label: 'Standing Instructions', path: '/accounting/bank-cash/standing-instructions' },
  { label: 'Posting Rules', path: '/accounting/bank-cash/posting-rules' },
  { label: 'Liquidity', path: '/accounting/bank-cash/liquidity' },
  { label: 'Bankbook', path: '/accounting/bank-cash/bankbook' },
  { label: 'Cashbook', path: '/accounting/bank-cash/cashbook' },
] as const

/** Bank & Cash sub-modules still deferred (demo frontend only) in API mode. */
export const BANK_STATEMENT_PREVIEW_LINKS: Array<{ label: string; path: string }> = []

export function statementStatusTone(status: BankStatementStatus): ErpStatusChipTone {
  switch (status) {
    case 'VALIDATED':
    case 'RECONCILED':
      return 'success'
    case 'READY_TO_RECONCILE':
    case 'PARTIALLY_RECONCILED':
    case 'IMPORTED':
    case 'DRAFT':
      return 'warning'
    case 'VALIDATION_FAILED':
      return 'critical'
    case 'CANCELLED':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function importBatchStatusTone(status: BankStatementImportStatus): ErpStatusChipTone {
  switch (status) {
    case 'IMPORTED':
      return 'success'
    case 'PARTIALLY_IMPORTED':
      return 'warning'
    case 'FAILED':
      return 'critical'
    case 'PROCESSING':
      return 'warning'
    case 'UPLOADED':
      return 'neutral'
    case 'CANCELLED':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function previewRowStatusTone(status: PreviewRowStatus): ErpStatusChipTone {
  switch (status) {
    case 'VALID':
      return 'success'
    case 'WARNING':
    case 'DUPLICATE':
      return 'warning'
    case 'ERROR':
      return 'critical'
    default:
      return 'neutral'
  }
}

export function issueSeverityTone(severity: ImportIssueSeverity): ErpStatusChipTone {
  switch (severity) {
    case 'INFO':
      return 'neutral'
    case 'WARNING':
      return 'warning'
    case 'ERROR':
    case 'BLOCKER':
      return 'critical'
    default:
      return 'neutral'
  }
}

export function groupIssuesBySeverity(issues: ImportIssueDto[]) {
  return {
    blockers: issues.filter((i) => i.severity === 'BLOCKER'),
    errors: issues.filter((i) => i.severity === 'ERROR'),
    warnings: issues.filter((i) => i.severity === 'WARNING'),
    info: issues.filter((i) => i.severity === 'INFO'),
  }
}

export function parseDecimal(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export const IMPORT_FORMAT_LABELS: Record<
  'CSV' | 'XLSX' | 'MT940' | 'CAMT_053' | 'AUTO_DETECT',
  string
> = {
  CSV: 'CSV',
  XLSX: 'Excel (XLSX)',
  MT940: 'SWIFT MT940',
  CAMT_053: 'ISO 20022 CAMT.053',
  AUTO_DETECT: 'Auto-detect',
}

export const IMPORT_FILE_ACCEPT =
  '.csv,.xlsx,.xls,.sta,.mt940,.txt,.xml'

export function isStructuredImportFormat(
  format: string,
): format is 'MT940' | 'CAMT_053' {
  return format === 'MT940' || format === 'CAMT_053'
}

export function formatNeedsColumnMapping(format: string): boolean {
  return format === 'CSV' || format === 'XLSX'
}

export function inferImportFormat(
  fileName: string,
): 'CSV' | 'XLSX' | 'MT940' | 'CAMT_053' | 'AUTO_DETECT' | null {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.csv')) return 'CSV'
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'XLSX'
  if (lower.endsWith('.sta') || lower.endsWith('.mt940')) return 'MT940'
  if (lower.endsWith('.xml')) return 'CAMT_053'
  if (lower.endsWith('.txt')) return 'AUTO_DETECT'
  return null
}

export function defaultMappingForHeaders(headers: string[]) {
  const find = (...candidates: string[]) => {
    const idx = headers.findIndex((h) => candidates.some((c) => h.toLowerCase().includes(c.toLowerCase())))
    return idx >= 0 ? headers[idx] : undefined
  }
  const dateCol = find('date', 'txn', 'transaction')
  const descCol = find('description', 'narration', 'particular')
  const debitCol = find('debit', 'withdraw')
  const creditCol = find('credit', 'deposit')
  const balanceCol = find('balance')
  const refCol = find('reference', 'ref', 'cheque')
  const columns: Record<string, { column: string }> = {}
  if (dateCol) columns.transactionDate = { column: dateCol }
  if (descCol) columns.description = { column: descCol }
  if (debitCol) columns.debitAmount = { column: debitCol }
  if (creditCol) columns.creditAmount = { column: creditCol }
  if (balanceCol) columns.runningBalance = { column: balanceCol }
  if (refCol) columns.referenceNumber = { column: refCol }
  return {
    amountMode: 'DEBIT_CREDIT_COLUMNS' as const,
    columns,
    dateFormat: 'DD/MM/YYYY',
  }
}
