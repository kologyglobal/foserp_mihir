/** Finance Phase 5B1 — Treasury internal transfer API types (mirrors backend `TreasuryTransfer` model). */

export type TreasuryTransferType = 'BANK_TO_BANK' | 'BANK_TO_CASH' | 'CASH_TO_BANK' | 'CASH_TO_CASH'

export type TreasuryTransferPostingMode = 'DIRECT' | 'IN_TRANSIT'

export type TreasuryTransferStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'REJECTED'
  | 'READY_TO_POST'
  | 'IN_TRANSIT'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REVERSED'

export type TreasuryTransferPurpose =
  | 'FUND_MOVEMENT'
  | 'CASH_REPLENISHMENT'
  | 'CASH_DEPOSIT'
  | 'BANK_ACCOUNT_BALANCING'
  | 'INTER_BRANCH_FUNDING'
  | 'PETTY_CASH_REPLENISHMENT'
  | 'OTHER'

export type TreasuryTransferAccountType = 'BANK' | 'CASH'

export interface TransferAllowedActions {
  canEdit: boolean
  canDelete: boolean
  canValidate: boolean
  canSubmit: boolean
  canApprove: boolean
  canReject: boolean
  canRevise: boolean
  canMarkReady: boolean
  canCancel: boolean
  canPost: boolean
  canDispatch: boolean
  canReceive: boolean
  canReverse: boolean
  canViewReversalPreview: boolean
}

export interface TransferAccountSnapshot {
  id: string
  code: string
  name: string
  accountType: TreasuryTransferAccountType
  currencyCode: string
  maskedNumber?: string | null
  bankName?: string | null
  /** Current book (GL) balance for the account, when available from the backend. */
  bookBalance?: string | null
}

export interface TransferModeRecommendation {
  recommendedPostingMode: TreasuryTransferPostingMode
  reasonCodes: string[]
  message?: string | null
}

export interface TransferValidationSnapshot {
  isValid: boolean
  errors: string[]
  warnings: string[]
  modeRecommendation?: TransferModeRecommendation | null
  validatedAt?: string
}

export type TransferAccountingLineSide = 'DEBIT' | 'CREDIT'
export type TransferAccountingLineRole = 'SOURCE' | 'DESTINATION' | 'IN_TRANSIT'

export interface TransferAccountingPreviewLine {
  side: TransferAccountingLineSide
  accountId: string
  accountCode?: string | null
  accountName?: string | null
  accountRole: TransferAccountingLineRole
  amount: string
  narration?: string | null
}

export interface TransferAccountingPreview {
  postingMode: TreasuryTransferPostingMode
  sourceLines: TransferAccountingPreviewLine[]
  destinationLines: TransferAccountingPreviewLine[]
  warnings: string[]
}

export interface TransferReversalPreviewDto {
  transferId: string
  postingMode: TreasuryTransferPostingMode
  sourceLines: TransferAccountingPreviewLine[]
  destinationLines: TransferAccountingPreviewLine[]
  warnings: string[]
}

export interface TreasuryTransferDto {
  id: string
  tenantId: string
  legalEntityId: string
  sourceBranchId?: string | null
  destinationBranchId?: string | null
  sourceTreasuryAccountId: string
  destinationTreasuryAccountId: string
  sourceAccount?: TransferAccountSnapshot
  destinationAccount?: TransferAccountSnapshot
  draftReference: string
  transferNumber?: string | null
  transferType: TreasuryTransferType
  postingMode: TreasuryTransferPostingMode
  status: TreasuryTransferStatus
  transferPurpose: TreasuryTransferPurpose
  transferDate: string
  sourcePostingDate: string
  expectedReceiptDate?: string | null
  destinationPostingDate?: string | null
  currencyCode: string
  exchangeRate: string
  transferAmount: string
  baseTransferAmount: string
  externalReference?: string | null
  narration?: string | null
  internalNote?: string | null
  approvalRequired: boolean
  approvalRequestId?: string | null
  validationSnapshot?: TransferValidationSnapshot | null
  accountingPreviewSnapshot?: TransferAccountingPreview | null
  sourceVoucherId?: string | null
  destinationVoucherId?: string | null
  reversalSourceVoucherId?: string | null
  reversalDestinationVoucherId?: string | null
  submittedAt?: string | null
  submittedById?: string | null
  approvedAt?: string | null
  approvedById?: string | null
  rejectedAt?: string | null
  rejectedById?: string | null
  rejectionReason?: string | null
  readyToPostAt?: string | null
  readyToPostById?: string | null
  dispatchedAt?: string | null
  dispatchedById?: string | null
  receivedAt?: string | null
  receivedById?: string | null
  completedAt?: string | null
  completedById?: string | null
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
  allowedActions: TransferAllowedActions
}

export interface Paginated<T> {
  items: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ListTransfersQuery {
  legalEntityId?: string
  status?: TreasuryTransferStatus
  postingMode?: TreasuryTransferPostingMode
  transferType?: TreasuryTransferType
  sourceTreasuryAccountId?: string
  destinationTreasuryAccountId?: string
  search?: string
  page?: number
  limit?: number
}

export interface CreateTransferInput {
  legalEntityId: string
  sourceBranchId?: string | null
  destinationBranchId?: string | null
  sourceTreasuryAccountId: string
  destinationTreasuryAccountId: string
  transferPurpose: TreasuryTransferPurpose
  transferDate: string
  sourcePostingDate: string
  expectedReceiptDate?: string | null
  postingMode?: TreasuryTransferPostingMode
  currencyCode?: string
  transferAmount: string
  externalReference?: string | null
  narration?: string | null
  internalNote?: string | null
}

export interface UpdateTransferInput {
  sourceBranchId?: string | null
  destinationBranchId?: string | null
  sourceTreasuryAccountId?: string
  destinationTreasuryAccountId?: string
  transferPurpose?: TreasuryTransferPurpose
  transferDate?: string
  sourcePostingDate?: string
  expectedReceiptDate?: string | null
  postingMode?: TreasuryTransferPostingMode
  transferAmount?: string
  externalReference?: string | null
  narration?: string | null
  internalNote?: string | null
  expectedUpdatedAt: string
}

export interface LifecycleInput {
  expectedUpdatedAt: string
  idempotencyKey?: string
}

export interface ReasonedLifecycleInput extends LifecycleInput {
  reason: string
}

export interface ReverseTransferInput extends LifecycleInput {
  reversalDate: string
  reason: string
  idempotencyKey: string
}

export interface DeleteTransferInput {
  expectedUpdatedAt: string
}
