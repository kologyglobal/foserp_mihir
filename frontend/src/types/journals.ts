export type JournalStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'POSTED'
  | 'SENT_BACK'
  | 'REJECTED'
  | 'REVERSED'
  | 'CANCELLED'

export interface JournalLine {
  id?: string
  lineNumber?: number
  accountId: string
  partyType?: string | null
  partyId?: string | null
  partyNameSnapshot?: string | null
  debitAmount: string
  creditAmount: string
  baseDebitAmount?: string
  baseCreditAmount?: string
  currencyCode?: string
  exchangeRate?: string
  costCentreId?: string | null
  projectReference?: string | null
  departmentReference?: string | null
  referenceDocumentType?: string | null
  referenceDocumentId?: string | null
  referenceDocumentLineId?: string | null
  dueDate?: string | null
  lineNarration?: string | null
}

export interface JournalAllowedActions {
  edit: boolean
  validate: boolean
  submit: boolean
  cancel: boolean
  approve: false
  reject: false
  sendBack: false
  post: false
  reverse: false
}

export interface Journal {
  id: string
  tenantId?: string
  legalEntityId: string
  branchId?: string | null
  financialYearId: string
  accountingPeriodId: string
  voucherType: 'JOURNAL'
  voucherNumber: string | null
  status: JournalStatus
  documentDate: string
  postingDate: string
  referenceNumber: string | null
  externalReference?: string | null
  draftReference?: string | null
  narration?: string | null
  currencyCode: string
  exchangeRate: string
  totalDebit: string
  totalCredit: string
  baseTotalDebit: string
  baseTotalCredit: string
  sourceModule?: string
  sourceDocumentType?: string
  approvalRequired: boolean
  currentApprovalLevel: number
  cancellationReason?: string | null
  createdBy?: string | null
  updatedBy?: string | null
  createdAt: string
  updatedAt: string
  lines: JournalLine[]
  allowedActions?: JournalAllowedActions
}

export interface JournalValidationError {
  code: string
  field?: string
  message: string
}

export interface JournalValidationReport {
  valid: boolean
  summary: {
    totalDebit: string
    totalCredit: string
    baseTotalDebit: string
    baseTotalCredit: string
    lineCount: number
  }
  errors: JournalValidationError[]
  warnings: JournalValidationError[]
  approval: {
    required: boolean
    canSubmit: boolean
    amount: string
    matchedRuleId?: string | null
    matchedRuleName?: string | null
    approvalLevel?: number
    journalApprovalLimit?: string | null
    blockReason?: string | null
  }
}

export interface JournalAuditEntry {
  id: string
  action: string
  createdAt: string
  userId?: string | null
  oldValues?: unknown
  newValues?: unknown
}

export interface JournalListFilters {
  legalEntityId: string
  branchId?: string
  status?: JournalStatus
  postingDateFrom?: string
  postingDateTo?: string
  search?: string
  page?: number
  limit?: number
  approvalRequired?: boolean
  createdBy?: string
}

export interface CreateJournalInput {
  legalEntityId: string
  branchId?: string | null
  documentDate: string
  postingDate: string
  referenceNumber?: string | null
  externalReference?: string | null
  narration?: string | null
  currencyCode?: string
  exchangeRate?: string
  lines: JournalLine[]
}

export interface UpdateJournalInput extends Omit<CreateJournalInput, 'legalEntityId'> {
  updatedAt?: string
}
