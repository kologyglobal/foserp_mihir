import type { AccountingVoucher, AccountingVoucherLine, AccountingVoucherStatus } from '@prisma/client'
import type { DraftVoucherLineInput, LedgerValidationError, VoucherStatus } from '../ledger/ledger.types.js'

export const JOURNAL_SOURCE_MODULE = 'ACCOUNTING'
export const JOURNAL_SOURCE_DOCUMENT_TYPE = 'MANUAL_JOURNAL'

export interface JournalLineInput extends Omit<DraftVoucherLineInput, 'lineNumber'> {
  lineNumber?: number
}

export interface CreateJournalDraftInput {
  legalEntityId: string
  branchId?: string | null
  documentDate: string
  postingDate: string
  referenceNumber?: string | null
  externalReference?: string | null
  narration?: string | null
  currencyCode?: string
  exchangeRate?: string
  lines: JournalLineInput[]
}

export interface UpdateJournalDraftInput {
  branchId?: string | null
  documentDate?: string
  postingDate?: string
  referenceNumber?: string | null
  externalReference?: string | null
  narration?: string | null
  currencyCode?: string
  exchangeRate?: string
  lines: JournalLineInput[]
  updatedAt?: string
}

export interface JournalTotalsSummary {
  totalDebit: string
  totalCredit: string
  baseTotalDebit: string
  baseTotalCredit: string
  lineCount: number
}

export interface JournalApprovalLevel {
  level: number
  ruleId: string
  ruleName: string
  approverRoleId: string | null
  approverUserId: string | null
}

export interface JournalApprovalInfo {
  required: boolean
  canSubmit: boolean
  amount: string
  levels: JournalApprovalLevel[]
  totalLevels: number
  matchedRuleId?: string | null
  matchedRuleName?: string | null
  approvalLevel?: number
  journalApprovalLimit?: string | null
  blockReason?: string | null
}

export interface JournalValidationReport {
  valid: boolean
  summary: JournalTotalsSummary
  errors: LedgerValidationError[]
  warnings: LedgerValidationError[]
  approval: JournalApprovalInfo
}

export interface JournalAllowedActions {
  edit: boolean
  validate: boolean
  submit: boolean
  cancel: boolean
  approve: boolean
  reject: boolean
  sendBack: boolean
  post: boolean
  reverse: boolean
}

export interface JournalLineDto {
  id: string
  lineNumber: number
  accountId: string
  partyType: string | null
  partyId: string | null
  partyNameSnapshot: string | null
  debitAmount: string
  creditAmount: string
  baseDebitAmount: string
  baseCreditAmount: string
  currencyCode: string
  exchangeRate: string
  costCentreId: string | null
  projectReference: string | null
  departmentReference: string | null
  referenceDocumentType: string | null
  referenceDocumentId: string | null
  referenceDocumentLineId: string | null
  dueDate: string | null
  lineNarration: string | null
}

export interface JournalDetailDto {
  id: string
  tenantId: string
  legalEntityId: string
  branchId: string | null
  financialYearId: string
  accountingPeriodId: string
  voucherType: 'JOURNAL'
  voucherNumber: string | null
  status: VoucherStatus
  documentDate: string
  postingDate: string
  referenceNumber: string | null
  externalReference: string | null
  narration: string | null
  currencyCode: string
  exchangeRate: string
  totalDebit: string
  totalCredit: string
  baseTotalDebit: string
  baseTotalCredit: string
  sourceModule: string
  sourceDocumentType: string
  approvalRequired: boolean
  currentApprovalLevel: number
  cancellationReason: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  postedAt?: string | null
  postedBy?: string | null
  postingEventId?: string | null
  ledgerEntryCount?: number
  generalLedgerLink?: string | null
  lines: JournalLineDto[]
  allowedActions: JournalAllowedActions
}

export interface JournalListItemDto extends Omit<JournalDetailDto, 'lines' | 'allowedActions'> {
  draftReference: string | null
}

export type JournalWithLines = AccountingVoucher & { lines: AccountingVoucherLine[] }

export const SUBMITTABLE_JOURNAL_STATUSES: AccountingVoucherStatus[] = ['DRAFT', 'SENT_BACK']
export const CANCELLABLE_JOURNAL_STATUSES: AccountingVoucherStatus[] = ['DRAFT', 'SENT_BACK']
