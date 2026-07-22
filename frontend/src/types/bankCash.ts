/**
 * Bank & Cash Management — frontend models (demo / UI only).
 * Prepared for future Node.js / MySQL API mapping.
 * Does NOT post real GL, execute bank payments, or import live bank feeds.
 */

// ─── Enums / unions ───────────────────────────────────────────────────────────

export type BankAccountType =
  | 'Current Account'
  | 'Savings Account'
  | 'Cash Credit'
  | 'Overdraft'
  | 'Term Deposit'
  | 'Escrow Account'
  | 'Collection Account'
  | 'Payment Account'
  | 'Foreign Currency Account'
  | 'Other'

export type BankAccountStatus = 'Active' | 'Inactive' | 'Frozen'

export type CashAccountType =
  | 'Main Cash'
  | 'Petty Cash'
  | 'Plant Cash'
  | 'Branch Cash'
  | 'Site Cash'
  | 'Imprest Cash'
  | 'Foreign Currency Cash'

export type BankCashTransactionType =
  | 'Customer Receipt'
  | 'Vendor Payment'
  | 'Bank Transfer'
  | 'Cash Transfer'
  | 'Cash Deposit'
  | 'Cash Withdrawal'
  | 'Bank Charge'
  | 'Bank Interest'
  | 'Cheque Issue'
  | 'Cheque Deposit'
  | 'Cheque Clearance'
  | 'Direct Debit'
  | 'Direct Credit'
  | 'Adjustment'
  | 'Reversal'

export type FundTransferType =
  | 'Bank to Bank'
  | 'Bank to Cash'
  | 'Cash to Bank'
  | 'Cash to Cash'
  | 'Intercompany'
  | 'Foreign Currency Transfer'

export type FundTransferStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'In Process'
  | 'Completed'
  | 'Rejected'
  | 'Reversed'
  | 'Cancelled'

export type TransferMode =
  | 'Internal Transfer'
  | 'NEFT'
  | 'RTGS'
  | 'IMPS'
  | 'UPI'
  | 'Cheque'
  | 'Cash Deposit'
  | 'Cash Withdrawal'
  | 'Other'

export type BankStatementStatus =
  | 'Draft'
  | 'Imported'
  | 'Validated'
  | 'Partially Reconciled'
  | 'Fully Reconciled'
  | 'With Errors'
  | 'Cancelled'

export type ReconciliationStatus =
  | 'Not Started'
  | 'Draft'
  | 'In Progress'
  | 'Completed'
  | 'Reopened'

export type MatchStatus =
  | 'Unmatched'
  | 'Suggested'
  | 'Matched'
  | 'Partially Matched'
  | 'Difference'
  | 'Ignored'
  | 'Adjustment Required'
  | 'Excluded'
  | 'Duplicate'

export type MatchConfidence = 'High' | 'Medium' | 'Low' | 'Manual'

export type ChequeStatus =
  | 'Draft'
  | 'Issued'
  | 'Deposited'
  | 'Cleared'
  | 'Bounced'
  | 'Cancelled'
  | 'Stopped'
  | 'PDC'

export type ChequeDirection = 'Issued' | 'Received'

export type BankDepositStatus = 'Draft' | 'Pending' | 'Deposited' | 'Cleared' | 'Rejected'

export type DepositType = 'Cash Deposit' | 'Cheque Deposit' | 'Mixed'

export type CashCountStatus = 'Draft' | 'Submitted' | 'Approved' | 'Posted' | 'Cancelled'

export type CashVarianceStatus = 'Matched' | 'Excess' | 'Shortage'

export type BankCashWorkspaceTab =
  | 'overview'
  | 'liquidity'
  | 'bank_accounts'
  | 'cash_accounts'
  | 'transactions'
  | 'fund_transfers'
  | 'statements'
  | 'reconciliation'
  | 'cheques'
  | 'treasury_adjustments'
  | 'standing_instructions'
  | 'posting_rules'
  | 'bank_connectors'
  | 'deposits'
  | 'cash_book'
  | 'bank_book'
  | 'cashbook'
  | 'cash_counts'
  | 'reports'
  | 'setup'

export type ReconciliationLineSide = 'statement' | 'book'

export type StatementImportRowStatus = 'Valid' | 'Warning' | 'Error' | 'Duplicate'

// ─── Core entities ────────────────────────────────────────────────────────────

export interface BankAccount {
  id: string
  code: string
  name: string
  bankName: string
  branch: string
  ifsc: string
  swiftCode: string | null
  accountNumberMasked: string
  accountNumberLast4: string
  accountType: BankAccountType
  currency: string
  bookBalance: number
  statementBalance: number
  availableBalance: number
  unreconciledAmount: number
  paymentsInTransit: number
  depositsInTransit: number
  overdraftLimit: number | null
  minimumBalance: number | null
  lastReconciledDate: string | null
  lastStatementDate: string | null
  lastTransactionDate: string | null
  status: BankAccountStatus
  reconciliationStatus: ReconciliationStatus
  ledgerAccountId: string
  bankChargesAccountId: string | null
  interestIncomeAccountId: string | null
  interestExpenseAccountId: string | null
  suspenseAccountId: string | null
  exchangeGainAccountId: string | null
  exchangeLossAccountId: string | null
  purpose: string
  reconciliationFrequency: 'Daily' | 'Weekly' | 'Monthly'
  custodian: string
  isPaymentAccount: boolean
  isCollectionAccount: boolean
  location: string
  company: string
  createdBy: string
  createdAt: string
  modifiedAt: string
}

export interface CashAccount {
  id: string
  code: string
  name: string
  cashAccountType: CashAccountType
  currency: string
  bookBalance: number
  physicalBalance: number
  availableBalance: number
  variance: number
  cashLimit: number | null
  imprestLimit: number | null
  lastCountDate: string | null
  lastTransactionDate: string | null
  status: BankAccountStatus
  ledgerAccountId: string
  custodian: string
  location: string
  plant: string | null
  department: string | null
  company: string
  purpose: string
  countFrequency: 'Daily' | 'Weekly' | 'Monthly'
  varianceTolerance: number
  createdBy: string
  createdAt: string
  modifiedAt: string
}

export interface BankCashTransaction {
  id: string
  transactionNumber: string
  transactionDate: string
  valueDate: string
  transactionType: BankCashTransactionType
  accountKind: 'bank' | 'cash'
  bankAccountId: string | null
  cashAccountId: string | null
  accountName: string
  counterpartyName: string | null
  reference: string
  narration: string
  debitAmount: number
  creditAmount: number
  runningBalance: number
  currency: string
  transferMode: TransferMode | null
  chequeNumber: string | null
  utrNumber: string | null
  voucherId: string | null
  voucherNumber: string | null
  fundTransferId: string | null
  reconciliationId: string | null
  isReconciled: boolean
  createdBy: string
  createdAt: string
}

export interface FundTransfer {
  id: string
  transferNumber: string
  transferDate: string
  valueDate: string
  transferType: FundTransferType
  transferMode: TransferMode
  status: FundTransferStatus
  fromAccountKind: 'bank' | 'cash'
  fromBankAccountId: string | null
  fromCashAccountId: string | null
  fromAccountName: string
  toAccountKind: 'bank' | 'cash'
  toBankAccountId: string | null
  toCashAccountId: string | null
  toAccountName: string
  amount: number
  currency: string
  exchangeRate: number | null
  charges: number
  narration: string
  reference: string
  utrNumber: string | null
  submittedBy: string | null
  submittedAt: string | null
  approvedBy: string | null
  approvedAt: string | null
  rejectedBy: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  completedAt: string | null
  createdBy: string
  createdAt: string
  modifiedAt: string
}

export interface BankStatement {
  id: string
  statementNumber: string
  bankAccountId: string
  bankAccountName: string
  periodFrom: string
  periodTo: string
  openingBalance: number
  closingBalance: number
  totalDebits: number
  totalCredits: number
  lineCount: number
  importedAt: string | null
  importedBy: string | null
  fileName: string | null
  status: BankStatementStatus
  errorCount: number
  duplicateCount: number
  matchedCount: number
  unmatchedCount: number
  createdAt: string
}

export interface BankStatementLine {
  id: string
  statementId: string
  lineDate: string
  valueDate: string
  description: string
  reference: string
  debitAmount: number
  creditAmount: number
  balance: number
  matchStatus: MatchStatus
  reconciliationId: string | null
  matchedBookLineId: string | null
  isDuplicate: boolean
  validationMessage: string | null
}

export interface ReconciliationLine {
  id: string
  reconciliationId: string
  side: ReconciliationLineSide
  lineDate: string
  description: string
  reference: string
  debitAmount: number
  creditAmount: number
  amount: number
  matchStatus: MatchStatus
  statementLineId: string | null
  bookTransactionId: string | null
  confidence: MatchConfidence | null
}

export interface ReconciliationMatch {
  id: string
  reconciliationId: string
  statementLineId: string
  bookLineId: string
  matchAmount: number
  confidence: MatchConfidence
  matchStatus: MatchStatus
  matchedAt: string | null
  matchedBy: string | null
}

export interface Reconciliation {
  id: string
  reconciliationNumber: string
  bankAccountId: string
  bankAccountName: string
  statementId: string | null
  periodFrom: string
  periodTo: string
  openingBookBalance: number
  openingStatementBalance: number
  closingBookBalance: number
  closingStatementBalance: number
  matchedAmount: number
  unmatchedBookAmount: number
  unmatchedStatementAmount: number
  finalDifference: number
  status: ReconciliationStatus
  completedAt: string | null
  completedBy: string | null
  adjustmentPosted: boolean
  adjustmentAmount: number
  adjustmentReason: string | null
  lines: ReconciliationLine[]
  matches: ReconciliationMatch[]
  createdBy: string
  createdAt: string
  modifiedAt: string
}

export interface Cheque {
  id: string
  chequeNumber: string
  chequeDate: string
  direction: ChequeDirection
  status: ChequeStatus
  bankAccountId: string
  bankAccountName: string
  payeeName: string
  amount: number
  currency: string
  depositDate: string | null
  clearanceDate: string | null
  bounceDate: string | null
  bounceReason: string | null
  pdcDate: string | null
  reference: string
  narration: string
  linkedTransactionId: string | null
  createdBy: string
  createdAt: string
}

export interface BankDeposit {
  id: string
  depositNumber: string
  depositDate: string
  depositType: DepositType
  status: BankDepositStatus
  bankAccountId: string
  bankAccountName: string
  cashAccountId: string | null
  cashAccountName: string | null
  totalAmount: number
  cashAmount: number
  chequeAmount: number
  chequeCount: number
  slipNumber: string | null
  narration: string
  createdBy: string
  createdAt: string
}

export interface CashBookEntry {
  id: string
  cashAccountId: string
  entryDate: string
  voucherNumber: string | null
  transactionType: BankCashTransactionType
  reference: string
  narration: string
  receivedFrom: string | null
  paidTo: string | null
  debitAmount: number
  creditAmount: number
  runningBalance: number
  createdBy: string
}

export interface CashCountDenomination {
  denomination: number
  count: number
  amount: number
}

export interface CashCount {
  id: string
  countNumber: string
  countDate: string
  cashAccountId: string
  cashAccountName: string
  status: CashCountStatus
  bookBalance: number
  physicalTotal: number
  varianceAmount: number
  varianceStatus: CashVarianceStatus
  denominations: CashCountDenomination[]
  countedBy: string
  verifiedBy: string | null
  approvedBy: string | null
  approvedAt: string | null
  adjustmentPosted: boolean
  notes: string | null
  createdAt: string
}

// ─── Dashboard / setup / audit ────────────────────────────────────────────────

export interface BankCashDashboardData {
  asOfDate: string
  companyName: string
  totalBankBalance: number
  totalCashBalance: number
  totalAvailableBalance: number
  unreconciledBankAmount: number
  unreconciledTransactionCount: number
  paymentsInTransit: number
  depositsInTransit: number
  chequesPendingClearance: number
  pendingFundTransfers: number
  pendingCheques: number
  openReconciliations: number
  cashVarianceAmount: number
  reconciliationSummary: {
    reconciled: number
    pending: number
    partiallyReconciled: number
    difference: number
    overdue: number
  }
  pendingActions: Array<{ id: string; label: string; count: number; href: string; severity: 'info' | 'warning' | 'critical' }>
  bankAccounts: Array<{
    id: string
    name: string
    bankName: string
    bookBalance: number
    statementBalance: number
    availableBalance: number
    unreconciledAmount: number
    lastReconciledDate: string | null
    reconciliationStatus: ReconciliationStatus
    status: BankAccountStatus
  }>
  cashAccounts: Array<{
    id: string
    name: string
    bookBalance: number
    physicalBalance: number
    variance: number
    lastCountDate: string | null
    custodian: string
    location: string
    status: BankAccountStatus
  }>
  recentTransactions: BankCashTransaction[]
  upcomingCheques: Cheque[]
  bankBalanceTrend: Array<{ month: string; balance: number }>
  cashMovementTrend: Array<{ month: string; receipts: number; payments: number }>
  alerts: Array<{ id: string; severity: 'info' | 'warning' | 'critical'; message: string; href?: string }>
}

export interface BankCashSetup {
  companyName: string
  defaultCurrency: string
  financialYearStartMonth: number
  autoReconciliationEnabled: boolean
  requireDualApprovalAbove: number
  allowNegativeCash: boolean
  defaultTransferMode: TransferMode
  chequeSeriesPrefix: string
  depositSlipPrefix: string
  fundTransferPrefix: string
  reconciliationTolerance: number
  statementImportFormats: string[]
  notifyOnVariance: boolean
  notifyOnBouncedCheque: boolean
  approvalWorkflowEnabled: boolean
}

export interface BankCashAuditEntry {
  id: string
  entityType: string
  entityId: string
  action: string
  details: string
  performedBy: string
  performedAt: string
  isDemo: boolean
}

// ─── Filters / previews / exports ─────────────────────────────────────────────

export interface BankCashFilter {
  search: string
  bankAccountId: string
  cashAccountId: string
  accountKind: 'all' | 'bank' | 'cash'
  transactionType: BankCashTransactionType | ''
  transferStatus: FundTransferStatus | ''
  transferMode: TransferMode | ''
  reconciliationStatus: ReconciliationStatus | ''
  chequeStatus: ChequeStatus | ''
  chequeDirection: ChequeDirection | ''
  depositStatus: BankDepositStatus | ''
  cashCountStatus: CashCountStatus | ''
  dateFrom: string
  dateTo: string
  amountMin: number | null
  amountMax: number | null
  location: string
  currency: string
  isReconciled: 'all' | 'yes' | 'no'
  financialYear: string
  workspaceTab: BankCashWorkspaceTab
}

export interface AutoMatchPreview {
  reconciliationId: string
  bankAccountId: string
  totalStatementLines: number
  exactMatches: number
  suggestedMatchCount: number
  ambiguousMatches: number
  unmatchedLines: number
  amountMatched: number
  remainingDifference: number
  suggestedMatches: Array<{
    matchId: string
    statementLineId: string
    bookLineId: string
    statementDescription: string
    bookDescription: string
    amount: number
    confidence: MatchConfidence
    matchStatus: MatchStatus
    criteria: string[]
  }>
  highConfidenceCount: number
  mediumConfidenceCount: number
  lowConfidenceCount: number
  unmatchedStatementCount: number
  unmatchedBookCount: number
}

/** Manual match payload — supports 1:1, 1:N and N:1 */
export interface ManualMatchInput {
  statementLineIds: string[]
  bookLineIds: string[]
  allowPartial?: boolean
}

export interface StatementImportPreviewRow {
  rowNumber: number
  lineDate: string
  valueDate: string
  description: string
  reference: string
  debitAmount: number
  creditAmount: number
  balance: number | null
  status: StatementImportRowStatus
  message: string | null
}

export interface StatementImportPreview {
  fileName: string
  bankAccountId: string
  bankAccountName: string
  periodFrom: string | null
  periodTo: string | null
  openingBalance: number | null
  closingBalance: number | null
  totalDebits: number
  totalCredits: number
  validRowCount: number
  warningRowCount: number
  errorRowCount: number
  duplicateRowCount: number
  rows: StatementImportPreviewRow[]
  canImport: boolean
}

export interface BankCashExportRequest {
  reportName: string
  format: 'csv' | 'xlsx' | 'pdf'
  filter: Partial<BankCashFilter>
  includeAudit: boolean
}

export interface BankCashPrintPreview {
  reportName: string
  generatedAt: string
  companyName: string
  filterSummary: string
  rows: Array<Record<string, string | number | null>>
}

export interface BankCashLookups {
  bankAccounts: Array<{ id: string; label: string; currency: string }>
  cashAccounts: Array<{ id: string; label: string; currency: string }>
  locations: string[]
  custodians: string[]
  currencies: string[]
  transferModes: TransferMode[]
  transactionTypes: BankCashTransactionType[]
}

export interface BankCashReportCard {
  id: string
  name: string
  description: string
  category: 'Bank' | 'Cash' | 'Reconciliation' | 'Compliance'
  lastGeneratedAt: string | null
}

// ─── Input types (demo mutations) ─────────────────────────────────────────────

export type FundTransferInput = Pick<
  FundTransfer,
  | 'transferDate'
  | 'valueDate'
  | 'transferType'
  | 'transferMode'
  | 'fromAccountKind'
  | 'fromBankAccountId'
  | 'fromCashAccountId'
  | 'toAccountKind'
  | 'toBankAccountId'
  | 'toCashAccountId'
  | 'amount'
  | 'currency'
  | 'charges'
  | 'narration'
  | 'reference'
>

export type BankDepositInput = Pick<
  BankDeposit,
  'depositDate' | 'depositType' | 'bankAccountId' | 'cashAccountId' | 'totalAmount' | 'cashAmount' | 'chequeAmount' | 'chequeCount' | 'narration'
>

export type CashCountInput = Pick<CashCount, 'countDate' | 'cashAccountId' | 'denominations' | 'notes' | 'countedBy'>

export type ReconciliationDraftPayload = Partial<
  Pick<Reconciliation, 'adjustmentAmount' | 'adjustmentReason' | 'adjustmentPosted'>
> & {
  lines?: ReconciliationLine[]
  matches?: ReconciliationMatch[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const BANK_ACCOUNT_TYPES: BankAccountType[] = [
  'Current Account',
  'Savings Account',
  'Cash Credit',
  'Overdraft',
  'Term Deposit',
  'Escrow Account',
  'Collection Account',
  'Payment Account',
  'Foreign Currency Account',
  'Other',
]

export const BANK_ACCOUNT_STATUSES: BankAccountStatus[] = ['Active', 'Inactive', 'Frozen']

export const CASH_ACCOUNT_TYPES: CashAccountType[] = [
  'Main Cash',
  'Petty Cash',
  'Plant Cash',
  'Branch Cash',
  'Site Cash',
  'Imprest Cash',
  'Foreign Currency Cash',
]

export const BANK_CASH_TRANSACTION_TYPES: BankCashTransactionType[] = [
  'Customer Receipt',
  'Vendor Payment',
  'Bank Transfer',
  'Cash Transfer',
  'Cash Deposit',
  'Cash Withdrawal',
  'Bank Charge',
  'Bank Interest',
  'Cheque Issue',
  'Cheque Deposit',
  'Cheque Clearance',
  'Direct Debit',
  'Direct Credit',
  'Adjustment',
  'Reversal',
]

export const FUND_TRANSFER_TYPES: FundTransferType[] = [
  'Bank to Bank',
  'Bank to Cash',
  'Cash to Bank',
  'Cash to Cash',
  'Intercompany',
  'Foreign Currency Transfer',
]

export const FUND_TRANSFER_STATUSES: FundTransferStatus[] = [
  'Draft',
  'Pending Approval',
  'Approved',
  'In Process',
  'Completed',
  'Rejected',
  'Reversed',
  'Cancelled',
]

export const TRANSFER_MODES: TransferMode[] = [
  'Internal Transfer',
  'NEFT',
  'RTGS',
  'IMPS',
  'UPI',
  'Cheque',
  'Cash Deposit',
  'Cash Withdrawal',
  'Other',
]

export const BANK_STATEMENT_STATUSES: BankStatementStatus[] = [
  'Draft',
  'Imported',
  'Validated',
  'Partially Reconciled',
  'Fully Reconciled',
  'With Errors',
  'Cancelled',
]

export const RECONCILIATION_STATUSES: ReconciliationStatus[] = [
  'Not Started',
  'Draft',
  'In Progress',
  'Completed',
  'Reopened',
]

export const MATCH_STATUSES: MatchStatus[] = [
  'Unmatched',
  'Suggested',
  'Matched',
  'Partially Matched',
  'Difference',
  'Ignored',
  'Adjustment Required',
  'Excluded',
  'Duplicate',
]

export const MATCH_CONFIDENCE_LEVELS: MatchConfidence[] = ['High', 'Medium', 'Low', 'Manual']

export const CHEQUE_STATUSES: ChequeStatus[] = [
  'Draft',
  'Issued',
  'Deposited',
  'Cleared',
  'Bounced',
  'Cancelled',
  'Stopped',
  'PDC',
]

export const CHEQUE_DIRECTIONS: ChequeDirection[] = ['Issued', 'Received']

export const BANK_DEPOSIT_STATUSES: BankDepositStatus[] = ['Draft', 'Pending', 'Deposited', 'Cleared', 'Rejected']

export const DEPOSIT_TYPES: DepositType[] = ['Cash Deposit', 'Cheque Deposit', 'Mixed']

export const CASH_COUNT_STATUSES: CashCountStatus[] = ['Draft', 'Submitted', 'Approved', 'Posted', 'Cancelled']

export const CASH_VARIANCE_STATUSES: CashVarianceStatus[] = ['Matched', 'Excess', 'Shortage']

export const BANK_CASH_WORKSPACE_TABS: Array<{ id: BankCashWorkspaceTab; label: string; path: string }> = [
  { id: 'overview', label: 'Overview', path: '/accounting/bank-cash' },
  { id: 'liquidity', label: 'Liquidity', path: '/accounting/bank-cash/liquidity' },
  { id: 'bank_accounts', label: 'Bank Accounts', path: '/accounting/bank-cash/bank-accounts' },
  { id: 'cash_accounts', label: 'Cash Accounts', path: '/accounting/bank-cash/cash-accounts' },
  { id: 'transactions', label: 'Transactions', path: '/accounting/bank-cash/transactions' },
  { id: 'fund_transfers', label: 'Fund Transfers', path: '/accounting/bank-cash/transfers' },
  { id: 'statements', label: 'Bank Statements', path: '/accounting/bank-cash/statements' },
  { id: 'reconciliation', label: 'Bank Reconciliation', path: '/accounting/bank-cash/reconciliation' },
  { id: 'cheques', label: 'Cheque Management', path: '/accounting/bank-cash/cheques' },
  { id: 'treasury_adjustments', label: 'Bank Transactions', path: '/accounting/bank-cash/treasury-adjustments' },
  { id: 'standing_instructions', label: 'Standing Instructions', path: '/accounting/bank-cash/standing-instructions' },
  { id: 'posting_rules', label: 'Posting Rules', path: '/accounting/bank-cash/posting-rules' },
  { id: 'bank_connectors', label: 'Bank connectors', path: '/accounting/bank-cash/connectors' },
  { id: 'deposits', label: 'Bank Deposits', path: '/accounting/bank-cash/deposits' },
  { id: 'cash_book', label: 'Cash Book', path: '/accounting/bank-cash/cash-book' },
  { id: 'bank_book', label: 'Bankbook', path: '/accounting/bank-cash/bankbook' },
  { id: 'cashbook', label: 'Cashbook', path: '/accounting/bank-cash/cashbook' },
  { id: 'cash_counts', label: 'Cash Counts', path: '/accounting/bank-cash/cash-counts' },
  { id: 'reports', label: 'Reports', path: '/accounting/bank-cash/reports' },
  { id: 'setup', label: 'Bank & Cash Setup', path: '/accounting/bank-cash/setup' },
]

export const DEFAULT_BANK_CASH_FILTER: BankCashFilter = {
  search: '',
  bankAccountId: '',
  cashAccountId: '',
  accountKind: 'all',
  transactionType: '',
  transferStatus: '',
  transferMode: '',
  reconciliationStatus: '',
  chequeStatus: '',
  chequeDirection: '',
  depositStatus: '',
  cashCountStatus: '',
  dateFrom: '',
  dateTo: '',
  amountMin: null,
  amountMax: null,
  location: '',
  currency: '',
  isReconciled: 'all',
  financialYear: 'FY 2025-26',
  workspaceTab: 'overview',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function maskAccountNumber(last4: string): string {
  return `XXXX XXXX ${last4}`
}
