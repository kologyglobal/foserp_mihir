import type {
  BankReconciliationExceptionReason,
  BankReconciliationExceptionStatus,
  BankReconciliationMatchMethod,
  BankReconciliationMatchSource,
  BankReconciliationMatchStatus,
  BankReconciliationPostingMode,
  BankReconciliationSessionStatus,
  BankReconciliationSuggestionStatus,
  BankReconciliationSuggestionType,
  BankStatementLineDirection,
} from '@prisma/client'

export interface ReconciliationContext {
  tenantId: string
  userId: string
  ipAddress?: string | null
  userAgent?: string | null
}

// ─── Candidates / scoring ─────────────────────────────────────────────────────

export type LedgerCandidatePool = 'DIRECT_BANK_GL' | 'CLEARING_GL'

export interface LedgerCandidateDto {
  generalLedgerEntryId: string
  accountingVoucherId: string
  accountId: string
  pool: LedgerCandidatePool
  matchSource: BankReconciliationMatchSource
  sourceDocumentType: string | null
  sourceDocumentId: string | null
  sourceDocumentNumber: string | null
  voucherNumber: string
  voucherType: string
  postingDate: string
  documentDate: string
  currencyCode: string
  side: 'DEBIT' | 'CREDIT'
  originalAmount: string
  unreconciledAmount: string
  referenceNumber: string | null
  narration: string | null
  partyType: string | null
  partyId: string | null
  partyNameSnapshot: string | null
}

export interface ScoredLedgerCandidateDto extends LedgerCandidateDto {
  score: number
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW'
  reasonCodes: string[]
  dateDiffDays: number
  amountDiff: string
}

// ─── Preview / match ───────────────────────────────────────────────────────────

export interface StatementAllocationInput {
  bankStatementLineId: string
  amount: string
}

export interface LedgerAllocationInput {
  generalLedgerEntryId: string
  amount: string
}

export interface PreviewMatchInput {
  statementId: string
  statementAllocations: StatementAllocationInput[]
  ledgerAllocations: LedgerAllocationInput[]
  note?: string | null
}

export interface CreateMatchInput extends PreviewMatchInput {
  idempotencyKey: string
}

export interface SettlementLinePreviewDto {
  side: 'DEBIT' | 'CREDIT'
  accountId: string
  accountRole: 'BANK' | 'CLEARING'
  amount: string
}

export interface MatchPreviewResultDto {
  matchSource: BankReconciliationMatchSource
  matchMethod: BankReconciliationMatchMethod
  postingMode: BankReconciliationPostingMode
  matchedAmount: string
  currencyCode: string
  statementAllocations: Array<{ bankStatementLineId: string; amount: string; lineDirection: BankStatementLineDirection }>
  ledgerAllocations: Array<{ generalLedgerEntryId: string; amount: string; accountId: string }>
  settlementPreview: SettlementLinePreviewDto[] | null
  warnings: string[]
}

export interface BankReconciliationMatchDto {
  id: string
  tenantId: string
  legalEntityId: string
  reconciliationSessionId: string
  treasuryAccountId: string
  matchReference: string
  matchMethod: BankReconciliationMatchMethod
  matchSource: BankReconciliationMatchSource
  matchStatus: BankReconciliationMatchStatus
  confidenceScore: string | null
  confidenceLevel: string | null
  reasonCodes: unknown
  accountCurrencyCode: string
  matchedAmount: string
  baseMatchedAmount: string
  postingMode: BankReconciliationPostingMode
  accountingVoucherId: string | null
  postingEventId: string | null
  reversalVoucherId: string | null
  reversalPostingEventId: string | null
  note: string | null
  matchedAt: string
  matchedById: string
  reversedAt: string | null
  reversedById: string | null
  reversalReason: string | null
  createdAt: string
  updatedAt: string
  statementAllocations: Array<{ id: string; bankStatementLineId: string; matchedAmount: string }>
  ledgerAllocations: Array<{
    id: string
    generalLedgerEntryId: string
    accountingVoucherId: string | null
    accountId: string
    sourceDocumentType: string | null
    sourceDocumentId: string | null
    sourceDocumentNumber: string | null
    matchedAmount: string
  }>
  idempotentReplay?: boolean
}

// ─── Suggestions ───────────────────────────────────────────────────────────────

export interface SuggestionDto {
  id: string
  reconciliationSessionId: string
  suggestionReference: string
  suggestionType: BankReconciliationSuggestionType
  confidenceScore: string
  confidenceLevel: string
  reasonCodes: unknown
  statementLineIds: string[]
  ledgerEntryIds: string[]
  suggestedAmount: string
  postingMode: BankReconciliationPostingMode
  status: BankReconciliationSuggestionStatus
  createdAt: string
  updatedAt: string
}

// ─── Sessions / summary ────────────────────────────────────────────────────────

export interface SessionDto {
  id: string
  tenantId: string
  legalEntityId: string
  branchId: string | null
  treasuryAccountId: string
  bankStatementId: string
  status: BankReconciliationSessionStatus
  statementStartDate: string
  statementEndDate: string
  statementOpeningBalance: string | null
  statementClosingBalance: string | null
  totalStatementDebit: string
  totalStatementCredit: string
  matchedStatementAmount: string
  unmatchedStatementAmount: string
  matchedBookAmount: string
  unmatchedBookAmount: string
  adjustedStatementBalance: string | null
  adjustedBookBalance: string | null
  reconciliationDifference: string | null
  finalizedAt: string | null
  finalizedById: string | null
  reopenedAt: string | null
  reopenedById: string | null
  reopenReason: string | null
  createdAt: string
  updatedAt: string
}

export interface SessionSummaryDto extends SessionDto {
  lineCount: number
  matchedLineCount: number
  unmatchedLineCount: number
  partiallyMatchedLineCount: number
  exceptionLineCount: number
  excludedLineCount: number
  openExceptionCount: number
  pendingSuggestionCount: number
  activeMatchCount: number
}

export interface ExceptionDto {
  id: string
  reconciliationSessionId: string
  bankStatementLineId: string
  reason: BankReconciliationExceptionReason
  comment: string | null
  status: BankReconciliationExceptionStatus
  assignedToId: string | null
  createdById: string
  resolvedAt: string | null
  resolvedById: string | null
  resolutionReference: string | null
  createdAt: string
  updatedAt: string
}

export interface AutoMatchRunResultDto {
  matchRunId: string
  status: 'COMPLETED' | 'FAILED'
  linesScanned: number
  matchesCreated: number
  suggestionsCreated: number
  ambiguousLines: number
  noCandidateLines: number
  durationMs: number
  matches: BankReconciliationMatchDto[]
}

export interface SessionAllowedActions {
  runAutoMatch: boolean
  match: boolean
  groupMatch: boolean
  partialMatch: boolean
  unmatch: boolean
  finalize: boolean
  finalizeWithExceptions: boolean
  reopen: boolean
  manageExceptions: boolean
  createAdjustmentDraft: boolean
}

export interface MatchAllowedActions {
  unmatch: boolean
  view: boolean
}
