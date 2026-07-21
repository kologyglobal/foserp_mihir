import type {
  BankStatementImportFormat as PrismaImportFormat,
  BankStatementImportIssueCategory as PrismaIssueCategory,
  BankStatementImportIssueSeverity as PrismaIssueSeverity,
  BankStatementImportStatus as PrismaImportStatus,
  BankStatementLineDirection as PrismaLineDirection,
  BankStatementStatus as PrismaStatementStatus,
} from '@prisma/client'

export type BankStatementImportFormat = PrismaImportFormat
export type BankStatementImportIssueCategory = PrismaIssueCategory
export type BankStatementImportIssueSeverity = PrismaIssueSeverity
export type BankStatementImportStatus = PrismaImportStatus
export type BankStatementLineDirection = PrismaLineDirection
export type BankStatementStatus = PrismaStatementStatus

export type BankStatementAmountMode = 'DEBIT_CREDIT_COLUMNS' | 'SIGNED_AMOUNT' | 'AMOUNT_WITH_DIRECTION'

export interface BankStatementColumnRef {
  /** 0-based column index or header label (case-insensitive). */
  column: string | number
}

export interface BankStatementMappingConfig {
  amountMode: BankStatementAmountMode
  columns: {
    transactionDate?: BankStatementColumnRef
    valueDate?: BankStatementColumnRef
    description?: BankStatementColumnRef
    referenceNumber?: BankStatementColumnRef
    debitAmount?: BankStatementColumnRef
    creditAmount?: BankStatementColumnRef
    signedAmount?: BankStatementColumnRef
    amount?: BankStatementColumnRef
    direction?: BankStatementColumnRef
    runningBalance?: BankStatementColumnRef
    counterpartyName?: BankStatementColumnRef
    counterpartyAccount?: BankStatementColumnRef
    utrReference?: BankStatementColumnRef
    chequeNumber?: BankStatementColumnRef
    transactionCode?: BankStatementColumnRef
    externalLineId?: BankStatementColumnRef
    externalTransactionId?: BankStatementColumnRef
  }
  header?: {
    openingBalance?: BankStatementColumnRef
    closingBalance?: BankStatementColumnRef
    statementReference?: BankStatementColumnRef
    periodStartDate?: BankStatementColumnRef
    periodEndDate?: BankStatementColumnRef
    statementDate?: BankStatementColumnRef
  }
  dateFormat?: string
  directionValues?: {
    credit?: string[]
    debit?: string[]
  }
}

export interface BankStatementParsingConfig {
  delimiter?: string
  encoding?: string
  sheetName?: string
  headerRowNumber?: number
  dataStartRowNumber?: number
}

export interface BankStatementInspectConfig extends BankStatementParsingConfig {
  detectedDelimiter?: string
  detectedEncoding?: string
  sheetNames?: string[]
  headers?: string[]
  sampleRows?: string[][]
}

export interface ParsedRawRow {
  rowNumber: number
  cells: string[]
}

export interface ParsedSheet {
  sheetName?: string
  headers: string[]
  rows: ParsedRawRow[]
  headerRowNumber: number
  dataStartRowNumber: number
}

export interface NormalisedStatementLine {
  sourceRowNumber: number
  transactionDate: Date
  valueDate?: Date | null
  direction: BankStatementLineDirection
  amount: string
  description?: string | null
  normalizedDescription?: string | null
  referenceNumber?: string | null
  utrReference?: string | null
  chequeNumber?: string | null
  transactionCode?: string | null
  counterpartyName?: string | null
  counterpartyAccountMasked?: string | null
  counterpartyBankCode?: string | null
  externalLineId?: string | null
  externalTransactionId?: string | null
  runningBalance?: string | null
  rawPayload?: Record<string, unknown>
}

export interface NormalisedStatementHeader {
  statementReference: string
  statementDate: Date
  periodStartDate: Date
  periodEndDate: Date
  openingBalance: string
  closingBalance: string
  totalCreditAmount: string
  totalDebitAmount: string
  balanceDifference: string
}

export interface ImportIssueInput {
  rowNumber?: number | null
  columnName?: string | null
  severity: BankStatementImportIssueSeverity
  category: BankStatementImportIssueCategory
  code: string
  message: string
  rawValue?: string | null
  normalizedValue?: string | null
  metadata?: Record<string, unknown> | null
  bankStatementId?: string | null
  bankStatementLineId?: string | null
}

export interface PreviewRowResult extends NormalisedStatementLine {
  status: 'VALID' | 'WARNING' | 'ERROR' | 'DUPLICATE'
  issues: ImportIssueInput[]
}

export interface ImportPreviewResult {
  header: NormalisedStatementHeader | null
  rows: PreviewRowResult[]
  totalRowCount: number
  validRowCount: number
  warningRowCount: number
  errorRowCount: number
  duplicateRowCount: number
  canImportStrict: boolean
  issues: ImportIssueInput[]
}

export interface BankStatementListFilters {
  legalEntityId?: string
  treasuryAccountId?: string
  status?: BankStatementStatus
  importBatchId?: string
  page?: number
  limit?: number
}

export interface BankStatementImportBatchSummary {
  id: string
  batchReference: string
  status: BankStatementImportStatus
  importFormat: BankStatementImportFormat
  treasuryAccountId: string
  legalEntityId: string
  fileName?: string | null
  totalLineCount: number
  importedLineCount: number
  failedLineCount: number
  duplicateLineCount: number
  warningCount: number
  errorCount: number
  uploadedAt: Date
  processedAt?: Date | null
  completedAt?: Date | null
  updatedAt: Date
}
