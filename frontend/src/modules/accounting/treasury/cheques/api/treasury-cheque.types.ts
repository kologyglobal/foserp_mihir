/** Finance Phase 5B2 — Treasury cheque API types (mirrors backend `TreasuryCheque` model + serializer). */

export type TreasuryChequeDirection = 'ISSUED' | 'RECEIVED'

export type TreasuryChequeAccountingMode = 'TRACK_ONLY' | 'POST_ON_LIFECYCLE'

export type TreasuryChequeStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'REJECTED'
  | 'READY'
  | 'ISSUED'
  | 'DEPOSITED'
  | 'CLEARED'
  | 'BOUNCED'
  | 'STOPPED'
  | 'CANCELLED'
  | 'REVERSED'

export interface ChequeAllowedActions {
  view: boolean
  edit: boolean
  validate: boolean
  submit: boolean
  markReady: boolean
  approve: boolean
  reject: boolean
  revise: boolean
  cancel: boolean
  issue: boolean
  deposit: boolean
  clear: boolean
  bounce: boolean
  stop: boolean
  reverse: boolean
  viewApproval: boolean
  viewAccountingPreview: boolean
  viewAccounting: boolean
}

export type ChequeAccountingLineRole = 'BANK' | 'COUNTERPART'
export type ChequeAccountingLineDirection = 'DEBIT' | 'CREDIT'

export interface ChequeAccountingLine {
  lineNumber: number
  role: ChequeAccountingLineRole
  accountId: string
  accountCode?: string | null
  accountName?: string | null
  direction: ChequeAccountingLineDirection
  amount: string
  lineNarration: string
}

export interface ChequeAccountingPreview {
  step: 'ISSUE' | 'DEPOSIT'
  isBalanced: boolean
  totalDebit: string
  totalCredit: string
  lines: ChequeAccountingLine[]
}

export interface ChequeValidationIssue {
  field?: string
  code: string
  message: string
}

export interface ChequeValidationSnapshot {
  isValid: boolean
  errors: ChequeValidationIssue[]
  warnings: ChequeValidationIssue[]
}

export interface ChequeApprovalSummary {
  id: string
  status: string
  currentLevel: number
  totalLevels: number
  requestedBy: string
  requestedAt: string
  completedAt?: string | null
  completedBy?: string | null
  documentStatusSnapshot?: string | null
}

export interface ChequeAccountSnapshot {
  id: string
  code: string
  name: string
  accountType: 'BANK' | 'CASH'
  currencyCode: string
  maskedNumber?: string | null
  bankName?: string | null
  bookBalance?: string | null
}

export interface TreasuryChequeDto {
  id: string
  tenantId: string
  legalEntityId: string
  branchId?: string | null
  treasuryAccountId: string
  glAccountId: string
  counterpartGlAccountId?: string | null
  direction: TreasuryChequeDirection
  status: TreasuryChequeStatus
  accountingMode: TreasuryChequeAccountingMode
  draftReference: string
  chequeRegisterNumber?: string | null
  chequeNumber: string
  chequeDate: string
  bankName?: string | null
  branchName?: string | null
  ifsc?: string | null
  payeeOrDrawerName: string
  currencyCode: string
  exchangeRate: string
  amount: string
  baseAmount: string
  isPdc: boolean
  pdcMaturityDate?: string | null
  depositDate?: string | null
  clearanceDate?: string | null
  bounceDate?: string | null
  bounceReason?: string | null
  stopReason?: string | null
  customerReceiptId?: string | null
  vendorPaymentId?: string | null
  narration?: string | null
  internalNote?: string | null
  approvalRequired: boolean
  approvalRequestId?: string | null
  approvalRequest?: ChequeApprovalSummary | null
  calculationVersion: number
  validation?: ChequeValidationSnapshot | null
  accountingPreview?: ChequeAccountingPreview | null
  isTrackOnly?: boolean
  voucherId?: string | null
  voucherNumber?: string | null
  ledgerEntryCount?: number
  postingEventId?: string | null
  reversalPostingEventId?: string | null
  reversalVoucherId?: string | null
  uniquenessKey?: string | null
  submittedAt?: string | null
  submittedById?: string | null
  approvedAt?: string | null
  approvedById?: string | null
  rejectedAt?: string | null
  rejectedById?: string | null
  rejectionReason?: string | null
  readyAt?: string | null
  readyById?: string | null
  issuedAt?: string | null
  issuedById?: string | null
  depositedAt?: string | null
  depositedById?: string | null
  clearedAt?: string | null
  clearedById?: string | null
  bouncedAt?: string | null
  bouncedById?: string | null
  stoppedAt?: string | null
  stoppedById?: string | null
  cancelledAt?: string | null
  cancelledById?: string | null
  cancellationReason?: string | null
  reversedAt?: string | null
  reversedById?: string | null
  reversalDate?: string | null
  reversalReason?: string | null
  createdById: string
  updatedById?: string | null
  createdAt: string
  updatedAt: string
  allowedActions: ChequeAllowedActions
}

export interface Paginated<T> {
  items: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ListChequesQuery {
  legalEntityId?: string
  status?: TreasuryChequeStatus
  direction?: TreasuryChequeDirection
  treasuryAccountId?: string
  chequeNumber?: string
  isPdc?: boolean
  dateFrom?: string
  dateTo?: string
  search?: string
  page?: number
  limit?: number
}

export interface CreateChequeInput {
  legalEntityId: string
  branchId?: string | null
  treasuryAccountId: string
  direction: TreasuryChequeDirection
  accountingMode?: TreasuryChequeAccountingMode
  chequeNumber: string
  chequeDate: string
  bankName?: string | null
  branchName?: string | null
  ifsc?: string | null
  payeeOrDrawerName: string
  currencyCode?: string
  exchangeRate?: string
  amount: string
  isPdc?: boolean
  pdcMaturityDate?: string | null
  counterpartGlAccountId?: string | null
  customerReceiptId?: string | null
  vendorPaymentId?: string | null
  narration?: string | null
  internalNote?: string | null
  approvalRequiredOverride?: boolean
}

export interface UpdateChequeInput extends CreateChequeInput {
  expectedUpdatedAt: string
}

export interface ChequeLifecycleInput {
  expectedUpdatedAt: string
  idempotencyKey?: string
}

export interface ChequeCommentInput extends ChequeLifecycleInput {
  comments?: string
}

export interface ChequeReasonedInput extends ChequeLifecycleInput {
  reason: string
}

export interface SubmitChequeInput extends ChequeCommentInput {}
export interface ApproveChequeInput extends ChequeCommentInput {}
export interface RejectChequeInput extends ChequeReasonedInput {}
export interface ReviseChequeInput extends ChequeLifecycleInput {
  reason?: string
}
export interface MarkChequeReadyInput extends ChequeLifecycleInput {}
export interface CancelChequeInput extends ChequeReasonedInput {}

export interface IssueChequeInput extends ChequeLifecycleInput {
  issueDate?: string
}

export interface DepositChequeInput extends ChequeLifecycleInput {
  depositDate: string
}

export interface ClearChequeInput extends ChequeLifecycleInput {
  clearanceDate: string
}

export interface BounceChequeInput extends ChequeLifecycleInput {
  bounceDate: string
  bounceReason: string
}

export interface StopChequeInput extends ChequeLifecycleInput {
  stopReason: string
}

export interface ReverseChequeInput extends ChequeLifecycleInput {
  reversalDate: string
  reason: string
  idempotencyKey: string
}

export interface ValidateChequeResult {
  valid: boolean
  errors: ChequeValidationIssue[]
  warnings: ChequeValidationIssue[]
  accountingPreview: ChequeAccountingPreview
}

/** `issue` / `deposit` / `reverse` posting endpoints wrap the cheque with a posting result envelope. */
export interface ChequePostingResultDto {
  cheque: TreasuryChequeDto
  posting: unknown
  idempotentReplay: boolean
}
