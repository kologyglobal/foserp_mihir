/** Phase 5A3 — Treasury bank reconciliation API types (mirrors backend DTOs). */

export type BankReconciliationSessionStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'READY_TO_FINALIZE'
  | 'FINALIZED'
  | 'REOPENED'
  | 'CANCELLED'

export type BankReconciliationMatchMethod = 'AUTO_EXACT' | 'AUTO_ACCEPTED' | 'MANUAL' | 'GROUPED_MANUAL' | 'PARTIAL_MANUAL'

export type BankReconciliationMatchSource = 'DIRECT_BANK_GL' | 'CLEARING_GL' | 'JOURNAL_CREATED_FROM_STATEMENT'

export type BankReconciliationMatchStatus = 'ACTIVE' | 'REVERSED'

export type BankReconciliationPostingMode = 'NONE' | 'CLEARING_SETTLEMENT'

export type BankReconciliationSuggestionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'INVALIDATED'

export type BankReconciliationSuggestionType = 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY'

export type BankReconciliationExceptionReason =
  | 'UNKNOWN_TRANSACTION'
  | 'REFERENCE_MISSING'
  | 'AMOUNT_MISMATCH'
  | 'DATE_MISMATCH'
  | 'POSSIBLE_DUPLICATE'
  | 'BANK_CHARGE_REQUIRES_JOURNAL'
  | 'INTEREST_REQUIRES_JOURNAL'
  | 'CURRENCY_MISMATCH'
  | 'SOURCE_DOCUMENT_NOT_POSTED'
  | 'OTHER'

export type BankReconciliationExceptionStatus = 'OPEN' | 'RESOLVED'

export type BankStatementLineDirection = 'CREDIT' | 'DEBIT'

export type BankStatementLineMatchStatus = 'UNMATCHED' | 'PARTIALLY_MATCHED' | 'MATCHED' | 'EXCEPTION' | 'EXCLUDED' | 'RECONCILED' | 'REVERSED'

export type LedgerCandidatePool = 'DIRECT_BANK_GL' | 'CLEARING_GL'

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW'

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
  allowedActions: SessionAllowedActions
}

export interface StatementLineDto {
  id: string
  lineNumber: number
  transactionDate: string
  direction: BankStatementLineDirection
  amount: string
  matchedAmount: string
  remainingAmount: string
  matchStatus: BankStatementLineMatchStatus
  description: string | null
  referenceNumber: string | null
  utrReference: string | null
  chequeNumber: string | null
  linkedJournalId: string | null
}

export interface ReconciliationWorkspaceDto {
  session: SessionDto
  statement: {
    id: string
    status: string
    currencyCode: string
    periodStartDate: string
    periodEndDate: string
  }
  lines: StatementLineDto[]
  activeMatchCount: number
  pendingSuggestionCount: number
  allowedActions: SessionAllowedActions
}

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
  confidenceLevel: ConfidenceLevel
  reasonCodes: string[]
  dateDiffDays: number
  amountDiff: string
}

export interface CandidatesForLineDto {
  direct: ScoredLedgerCandidateDto[]
  clearing: ScoredLedgerCandidateDto[]
}

export interface SuggestionDto {
  id: string
  reconciliationSessionId: string
  suggestionReference: string
  suggestionType: BankReconciliationSuggestionType
  confidenceScore: string
  confidenceLevel: string
  reasonCodes: string[] | null
  statementLineIds: string[]
  ledgerEntryIds: string[]
  suggestedAmount: string
  postingMode: BankReconciliationPostingMode
  status: BankReconciliationSuggestionStatus
  createdAt: string
  updatedAt: string
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
  allowedActions?: MatchAllowedActions
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

export interface Paginated<T> {
  items: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ListSessionsQuery {
  legalEntityId?: string
  treasuryAccountId?: string
  status?: BankReconciliationSessionStatus
  page?: number
  limit?: number
}

export interface ListHistoryQuery {
  legalEntityId?: string
  treasuryAccountId?: string
  page?: number
  limit?: number
}

export interface ListExceptionsQuery {
  legalEntityId?: string
  treasuryAccountId?: string
  status?: 'OPEN' | 'RESOLVED'
  page?: number
  limit?: number
}

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

export interface UnmatchInput {
  reason: string
  idempotencyKey: string
}

export interface RunAutoMatchInput {
  idempotencyKey?: string
}

export interface AcceptSuggestionInput {
  idempotencyKey: string
}

export interface RejectSuggestionInput {
  reason?: string
}

export interface FinalizeSessionInput {
  idempotencyKey: string
  force?: boolean
}

export interface ReopenSessionInput {
  reason: string
}

export interface CreateExceptionInput {
  statementId: string
  bankStatementLineId: string
  reason: BankReconciliationExceptionReason
  comment?: string | null
  assignedToId?: string | null
}

export interface ResolveExceptionInput {
  resolutionReference?: string | null
  comment?: string | null
}

export interface AdjustmentDraftJournalLineInput {
  lineNumber?: number
  accountId: string
  partyType?: 'CUSTOMER' | 'VENDOR' | 'EMPLOYEE' | 'OTHER' | null
  partyId?: string | null
  partyNameSnapshot?: string | null
  debitAmount?: string
  creditAmount?: string
  currencyCode?: string
  exchangeRate?: string
  lineNarration?: string | null
}

export interface CreateAdjustmentDraftInput {
  legalEntityId: string
  branchId?: string | null
  documentDate: string
  postingDate: string
  narration?: string | null
  currencyCode?: string
  lines: AdjustmentDraftJournalLineInput[]
}
