/** Finance Phase 5B3 — Treasury adjustment + bank posting rule API types (mirrors backend serializers). */

export type TreasuryAdjustmentType =
  | 'BANK_CHARGES'
  | 'BANK_INTEREST_INCOME'
  | 'BANK_INTEREST_EXPENSE'
  | 'COLLECTION_FEE'
  | 'MERCHANT_FEE'
  | 'DIRECT_DEBIT'
  | 'DIRECT_CREDIT'
  | 'STANDING_INSTRUCTION_DEBIT'
  | 'STANDING_INSTRUCTION_CREDIT'
  | 'GST_ADJUSTMENT'
  | 'OTHER_BANK_DEBIT'
  | 'OTHER_BANK_CREDIT'

export type TreasuryAdjustmentDirection = 'BANK_DEBIT' | 'BANK_CREDIT'

export type TreasuryAdjustmentStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'REJECTED'
  | 'READY_TO_POST'
  | 'POSTED'
  | 'CANCELLED'
  | 'REVERSED'

export type TreasuryAdjustmentSourceMode = 'MANUAL' | 'BANK_STATEMENT' | 'STANDING_INSTRUCTION'

export type TreasuryAdjustmentLineType =
  | 'EXPENSE'
  | 'INCOME'
  | 'ASSET'
  | 'LIABILITY'
  | 'RECOVERABLE_TAX'
  | 'NON_RECOVERABLE_TAX'
  | 'TDS_RECEIVABLE'
  | 'ROUND_OFF'
  | 'OTHER'

export type GstTreatment = 'GST_APPLICABLE' | 'GST_NOT_APPLICABLE' | 'GST_NON_RECOVERABLE' | 'GST_PENDING_REVIEW'
export type TdsTreatment = 'TDS_NOT_APPLICABLE' | 'TDS_DEDUCTED' | 'TDS_PENDING_REVIEW'

export interface TreasuryAdjustmentAllowedActions {
  view: boolean
  edit: boolean
  validate: boolean
  submit: boolean
  markReady: boolean
  approve: boolean
  reject: boolean
  revise: boolean
  cancel: boolean
  post: boolean
  reverse: boolean
  viewApproval: boolean
  viewAccountingPreview: boolean
  viewAccounting: boolean
}

export interface TreasuryAdjustmentLineDto {
  id: string
  lineNumber: number
  lineType: TreasuryAdjustmentLineType
  accountId: string | null
  accountCode?: string | null
  accountName?: string | null
  description?: string | null
  amount: string
  side: 'DEBIT' | 'CREDIT'
  gstTreatment: GstTreatment
  gstRate?: string | null
  gstAmount?: string | null
  gstAccountId?: string | null
  tdsTreatment: TdsTreatment
  tdsRate?: string | null
  tdsAmount?: string | null
  tdsAccountId?: string | null
  narration?: string | null
  isSystemGenerated?: boolean
}

export interface TreasuryAdjustmentValidationIssue {
  field?: string
  code?: string
  message: string
}

export type TreasuryAdjustmentAccountingLineRole = 'BANK' | 'OFFSET'
export type TreasuryAdjustmentAccountingLineDirection = 'DEBIT' | 'CREDIT'

export interface TreasuryAdjustmentAccountingLine {
  lineNumber: number
  role: TreasuryAdjustmentAccountingLineRole
  accountId: string
  direction: TreasuryAdjustmentAccountingLineDirection
  amount: string
  lineNarration: string
}

export interface TreasuryAdjustmentAccountingPreview {
  isBalanced: boolean
  totalDebit: string
  totalCredit: string
  lines: TreasuryAdjustmentAccountingLine[]
}

export interface TreasuryAdjustmentDto {
  id: string
  tenantId: string
  legalEntityId: string
  branchId?: string | null
  treasuryAccountId: string
  glAccountId: string
  draftReference: string
  adjustmentNumber?: string | null
  adjustmentType: TreasuryAdjustmentType
  direction: TreasuryAdjustmentDirection
  status: TreasuryAdjustmentStatus
  sourceMode: TreasuryAdjustmentSourceMode
  bankStatementLineId?: string | null
  standingInstructionExecutionId?: string | null
  adjustmentDate: string
  currencyCode: string
  exchangeRate: string
  bankAmount: string
  narration?: string | null
  internalNote?: string | null
  approvalRequired: boolean
  approvalRequestId?: string | null
  approvalRequest?: { id: string; status: string; currentLevel: number; totalLevels: number } | null
  rejectionReason?: string | null
  cancellationReason?: string | null
  voucherId?: string | null
  voucherNumber?: string | null
  postingEventId?: string | null
  reversalPostingEventId?: string | null
  reversalVoucherId?: string | null
  reconciliationMatchId?: string | null
  hasActiveReconciliationMatch?: boolean
  lines: TreasuryAdjustmentLineDto[]
  validation?: { isValid: boolean; errors: TreasuryAdjustmentValidationIssue[]; warnings: TreasuryAdjustmentValidationIssue[] } | null
  accountingPreview?: TreasuryAdjustmentAccountingPreview | null
  createdById: string
  updatedById?: string | null
  createdAt: string
  updatedAt: string
  allowedActions: TreasuryAdjustmentAllowedActions
}

export interface Paginated<T> {
  items: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ListTreasuryAdjustmentsQuery {
  legalEntityId: string
  status?: TreasuryAdjustmentStatus
  adjustmentType?: TreasuryAdjustmentType
  treasuryAccountId?: string
  sourceMode?: TreasuryAdjustmentSourceMode
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export interface AdjustmentLineInput {
  lineType: TreasuryAdjustmentLineType
  accountId?: string | null
  mappingKey?: string | null
  description?: string | null
  amount: string
  gstTreatment?: GstTreatment
  gstRate?: string | null
  gstAccountId?: string | null
  gstMappingKey?: string | null
  tdsTreatment?: TdsTreatment
  tdsRate?: string | null
  tdsAccountId?: string | null
  tdsMappingKey?: string | null
  narration?: string | null
}

export interface CreateAdjustmentInput {
  legalEntityId: string
  branchId?: string | null
  treasuryAccountId: string
  adjustmentType: TreasuryAdjustmentType
  direction?: TreasuryAdjustmentDirection | null
  adjustmentDate: string
  currencyCode?: string
  exchangeRate?: string
  narration?: string | null
  internalNote?: string | null
  approvalRequiredOverride?: boolean
  lines: AdjustmentLineInput[]
}

export interface UpdateAdjustmentInput extends CreateAdjustmentInput {
  expectedUpdatedAt: string
}

export interface CreateAdjustmentFromStatementLineInput {
  legalEntityId: string
  branchId?: string | null
  adjustmentType: TreasuryAdjustmentType
  direction?: TreasuryAdjustmentDirection | null
  adjustmentDate: string
  currencyCode?: string
  exchangeRate?: string
  narration?: string | null
  internalNote?: string | null
  approvalRequiredOverride?: boolean
  idempotencyKey: string
  lines: AdjustmentLineInput[]
}

export interface AdjustmentLifecycleInput {
  expectedUpdatedAt: string
  idempotencyKey?: string
}

export interface ApproveAdjustmentInput extends AdjustmentLifecycleInput {}
export interface RejectAdjustmentInput extends AdjustmentLifecycleInput {
  reason: string
}
export interface CancelAdjustmentInput extends AdjustmentLifecycleInput {
  reason: string
}
export interface ReverseAdjustmentInput extends AdjustmentLifecycleInput {
  reversalDate: string
  reason: string
  idempotencyKey: string
}

export interface ValidateAdjustmentResult {
  valid: boolean
  errors: TreasuryAdjustmentValidationIssue[]
  warnings: TreasuryAdjustmentValidationIssue[]
  accountingPreview?: TreasuryAdjustmentAccountingPreview
}

export interface TreasuryAdjustmentPostingResultDto {
  adjustment: TreasuryAdjustmentDto
  posting?: unknown
  match?: { id: string } | null
  idempotentReplay: boolean
}

// ─── Bank posting rules + classification ─────────────────────────────────────

export interface LineTemplateInput {
  lineType: TreasuryAdjustmentLineType
  accountId?: string | null
  mappingKey?: string | null
  description?: string | null
  gstTreatment?: GstTreatment
  gstRate?: string | null
  gstAccountId?: string | null
  gstMappingKey?: string | null
  tdsTreatment?: TdsTreatment
  tdsRate?: string | null
  tdsAccountId?: string | null
  tdsMappingKey?: string | null
  narration?: string | null
}

export interface BankPostingRuleDto {
  id: string
  legalEntityId: string
  treasuryAccountId?: string | null
  name: string
  description?: string | null
  isActive: boolean
  priority: number
  direction?: 'DEBIT' | 'CREDIT' | null
  keywordPatterns: string[]
  minAmount?: string | null
  maxAmount?: string | null
  adjustmentType: TreasuryAdjustmentType
  lineTemplate: LineTemplateInput
  matchCount: number
  lastMatchedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface ListBankPostingRulesQuery {
  legalEntityId: string
  isActive?: boolean
  treasuryAccountId?: string
  page?: number
  limit?: number
}

export interface CreateBankPostingRuleInput {
  legalEntityId: string
  treasuryAccountId?: string | null
  name: string
  description?: string | null
  isActive?: boolean
  priority?: number
  direction?: 'DEBIT' | 'CREDIT' | null
  keywordPatterns: string[]
  minAmount?: string | null
  maxAmount?: string | null
  adjustmentType: TreasuryAdjustmentType
  lineTemplate: LineTemplateInput
}

export interface UpdateBankPostingRuleInput extends CreateBankPostingRuleInput {
  expectedUpdatedAt: string
}

export interface ClassifyStatementLineInput {
  legalEntityId: string
}

export interface ClassifyStatementLineResultDto {
  ruleId: string
  ruleName: string
  adjustmentType: TreasuryAdjustmentType
  matchedKeywords: string[]
  lineTemplate: LineTemplateInput & { amount: string }
  candidateCount: number
}
