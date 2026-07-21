/** Phase 5A2 — Treasury bank statement API types (mirrors backend DTOs). */

export type BankStatementStatus =
  | 'DRAFT'
  | 'IMPORTED'
  | 'VALIDATION_FAILED'
  | 'VALIDATED'
  | 'READY_TO_RECONCILE'
  | 'PARTIALLY_RECONCILED'
  | 'RECONCILED'
  | 'CANCELLED'

export type BankStatementImportStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'IMPORTED'
  | 'PARTIALLY_IMPORTED'
  | 'FAILED'
  | 'CANCELLED'

export type BankStatementImportFormat =
  | 'CSV'
  | 'XLSX'
  | 'MT940'
  | 'CAMT_053'
  | 'AUTO_DETECT'
  | 'MANUAL'
export type BankStatementLineDirection = 'CREDIT' | 'DEBIT'
export type BankStatementAmountMode = 'DEBIT_CREDIT_COLUMNS' | 'SIGNED_AMOUNT' | 'AMOUNT_WITH_DIRECTION'

export type ImportIssueSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKER'
export type ImportIssueCategory =
  | 'FILE'
  | 'HEADER'
  | 'ROW'
  | 'MAPPING'
  | 'DUPLICATE_LINE'
  | 'DUPLICATE_FILE'
  | 'BALANCE'
  | 'OTHER'

export type PreviewRowStatus = 'VALID' | 'WARNING' | 'ERROR' | 'DUPLICATE'

export interface BankStatementColumnRef {
  column: string | number
}

export interface BankStatementMappingConfig {
  amountMode: BankStatementAmountMode
  columns: Record<string, BankStatementColumnRef | undefined>
  header?: Record<string, BankStatementColumnRef | undefined>
  dateFormat?: string
  directionValues?: { credit?: string[]; debit?: string[] }
}

export interface BankStatementParsingConfig {
  delimiter?: string
  encoding?: string
  sheetName?: string
  headerRowNumber?: number
  dataStartRowNumber?: number
}

export interface BankStatementInspectResult extends BankStatementParsingConfig {
  detectedDelimiter?: string
  detectedEncoding?: string
  sheetNames?: string[]
  headers?: string[]
  sampleRows?: string[][]
}

export interface StatementAllowedActions {
  canEdit: boolean
  canCancel: boolean
  canValidate: boolean
  canReopenDraft: boolean
  canAddLine: boolean
  canEditLine: boolean
  canDeleteLine: boolean
}

export interface ImportBatchAllowedActions {
  canCancel: boolean
  canInspect: boolean
  canPreview: boolean
  canImport: boolean
  canRetry: boolean
  canDownloadFile: boolean
}

export interface TreasuryAccountSummary {
  id: string
  code: string
  name: string
  currencyCode: string
  accountType?: 'BANK' | 'CASH' | 'CLEARING'
  status?: 'ACTIVE' | 'INACTIVE' | 'CLOSED'
  bankProfile?: { bankName?: string; branchName?: string; ifscCode?: string } | null
}

export interface BankStatementListItem {
  id: string
  legalEntityId: string
  treasuryAccountId: string
  statementReference: string
  statementDate: string
  periodStartDate: string
  periodEndDate: string
  currencyCode: string
  openingBalance: string
  closingBalance: string
  totalCreditAmount: string
  totalDebitAmount: string
  balanceDifference: string
  status: BankStatementStatus
  importFormat: BankStatementImportFormat
  sourceType: string
  lineCount: number
  importBatchId?: string | null
  createdAt: string
  updatedAt: string
  allowedActions: StatementAllowedActions
  treasuryAccount?: TreasuryAccountSummary
}

export interface BankStatementLineDto {
  id: string
  lineNumber: number
  sourceRowNumber?: number | null
  transactionDate: string
  valueDate?: string | null
  direction: BankStatementLineDirection
  amount: string
  description?: string | null
  referenceNumber?: string | null
  utrReference?: string | null
  chequeNumber?: string | null
  transactionCode?: string | null
  counterpartyName?: string | null
  counterpartyAccountMasked?: string | null
  runningBalance?: string | null
  matchStatus?: string
}

export interface BankStatementDetail {
  statement: BankStatementListItem
  lines: BankStatementLineDto[]
}

export interface ImportIssueDto {
  id?: string
  rowNumber?: number | null
  columnName?: string | null
  severity: ImportIssueSeverity
  category: ImportIssueCategory
  code: string
  message: string
  rawValue?: string | null
  normalizedValue?: string | null
}

export interface ImportPreviewRow {
  sourceRowNumber: number
  transactionDate: string
  valueDate?: string | null
  direction: BankStatementLineDirection
  amount: string
  description?: string | null
  referenceNumber?: string | null
  status: PreviewRowStatus
  issues: ImportIssueDto[]
}

export interface ImportPreviewHeader {
  statementReference: string
  statementDate: string
  periodStartDate: string
  periodEndDate: string
  openingBalance: string
  closingBalance: string
  totalCreditAmount: string
  totalDebitAmount: string
  balanceDifference: string
}

export interface ImportPreviewResult {
  header: ImportPreviewHeader | null
  rows: ImportPreviewRow[]
  totalRowCount: number
  validRowCount: number
  warningRowCount: number
  errorRowCount: number
  duplicateRowCount: number
  canImportStrict: boolean
  issues: ImportIssueDto[]
}

export interface ImportBatchDto {
  id: string
  batchReference: string
  status: BankStatementImportStatus
  importFormat: BankStatementImportFormat
  treasuryAccountId: string
  legalEntityId: string
  originalFileName?: string | null
  sanitisedFileName?: string | null
  fileSizeBytes?: number | null
  totalLineCount: number
  importedLineCount: number
  failedLineCount: number
  duplicateLineCount: number
  warningCount: number
  errorCount: number
  mappingConfig?: BankStatementMappingConfig | null
  parsingConfig?: BankStatementParsingConfig | null
  inspectConfig?: BankStatementInspectResult | null
  uploadedAt: string
  processedAt?: string | null
  completedAt?: string | null
  updatedAt: string
  allowedActions: ImportBatchAllowedActions
  treasuryAccount?: TreasuryAccountSummary
  mappingTemplate?: { id: string; name: string } | null
  issues?: ImportIssueDto[]
  statements?: Array<{ id: string; statementReference: string; status: BankStatementStatus; lineCount: number }>
}

export interface MappingTemplateDto {
  id: string
  legalEntityId: string
  treasuryAccountId?: string | null
  bankNameKey?: string | null
  name: string
  importFormat: BankStatementImportFormat
  isDefault: boolean
  isActive: boolean
  sheetNamePattern?: string | null
  headerRowNumber?: number | null
  dataStartRowNumber?: number | null
  delimiter?: string | null
  encoding?: string | null
  mappingConfig: BankStatementMappingConfig
  parsingConfig?: BankStatementParsingConfig | null
  createdAt: string
  updatedAt: string
}

export interface Paginated<T> {
  items: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ListBankStatementsQuery {
  legalEntityId: string
  page?: number
  limit?: number
  treasuryAccountId?: string
  status?: BankStatementStatus
  importBatchId?: string
}

export interface CreateManualStatementInput {
  legalEntityId: string
  treasuryAccountId: string
  statementReference: string
  statementDate: string
  periodStartDate: string
  periodEndDate: string
  currencyCode?: string
  openingBalance: number
  closingBalance: number
  totalCreditAmount?: number
  totalDebitAmount?: number
  lines?: Array<Omit<CreateStatementLineInput, 'expectedUpdatedAt'>>
}

export interface CreateStatementLineInput {
  transactionDate: string
  valueDate?: string | null
  direction: BankStatementLineDirection
  amount: number
  description?: string
  referenceNumber?: string
  utrReference?: string
  chequeNumber?: string
  transactionCode?: string
  counterpartyName?: string
  counterpartyAccount?: string
  expectedUpdatedAt: string
}

export interface UpdateBankStatementInput {
  statementReference?: string
  statementDate?: string
  periodStartDate?: string
  periodEndDate?: string
  openingBalance?: number
  closingBalance?: number
  totalCreditAmount?: number
  totalDebitAmount?: number
  expectedUpdatedAt: string
}

export interface InspectImportBatchInput {
  expectedUpdatedAt?: string
  parsingConfig?: BankStatementParsingConfig
  mappingConfig?: BankStatementMappingConfig
}

export interface PreviewImportBatchInput extends InspectImportBatchInput {
  statementReference?: string
  headerOverrides?: {
    openingBalance?: number
    closingBalance?: number
    statementReference?: string
  }
}

export interface ExecuteImportBatchInput extends PreviewImportBatchInput {
  allowPartial?: boolean
  confirmPartialImport?: boolean
  duplicatePolicy?: 'BLOCK' | 'WARN' | 'ALLOW_WITH_REVIEW'
}

export interface LifecycleInput {
  expectedUpdatedAt: string
  reason?: string
}
