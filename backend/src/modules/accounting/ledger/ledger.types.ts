/** Domain types for the accounting ledger — not re-exported Prisma models. */

export type VoucherType =
  | 'JOURNAL'
  | 'RECEIPT'
  | 'PAYMENT'
  | 'CONTRA'
  | 'DEBIT_NOTE'
  | 'CREDIT_NOTE'
  | 'OPENING_BALANCE'
  | 'REVERSAL'
  | 'SYSTEM'

export type VoucherStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'POSTED'
  | 'SENT_BACK'
  | 'REJECTED'
  | 'REVERSED'
  | 'CANCELLED'

export type PartyType = 'CUSTOMER' | 'VENDOR' | 'EMPLOYEE' | 'OTHER'

export type PostingEventStatus =
  | 'RECEIVED'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'PROCESSING'
  | 'POSTED'
  | 'FAILED'
  | 'REVERSED'
  | 'IGNORED'

export type PostingLineSide = 'DEBIT' | 'CREDIT'

export interface LedgerValidationError {
  code: string
  field?: string
  message: string
}

export interface LedgerValidationResult {
  valid: boolean
  errors: LedgerValidationError[]
}

export interface DraftVoucherLineInput {
  lineNumber: number
  accountId: string
  partyType?: PartyType | null
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

export interface DraftVoucherInput {
  legalEntityId: string
  branchId?: string | null
  financialYearId: string
  accountingPeriodId: string
  voucherType: VoucherType
  documentDate: string
  postingDate: string
  referenceNumber?: string | null
  externalReference?: string | null
  narration?: string | null
  currencyCode?: string
  exchangeRate?: string
  sourceModule?: string | null
  sourceDocumentType?: string | null
  sourceDocumentId?: string | null
  sourceDocumentLineId?: string | null
  lines?: DraftVoucherLineInput[]
}

export interface PostingEventInput {
  legalEntityId: string
  eventKey: string
  eventType: string
  eventVersion?: number
  sourceModule?: string | null
  sourceDocumentType?: string | null
  sourceDocumentId?: string | null
  sourceDocumentLineId?: string | null
  payload: Record<string, unknown>
}

export interface PostingRuleLineDefinition {
  side: PostingLineSide
  accountMappingKey: string
  amountSource: string
  optional?: boolean
}

export interface PostingRuleCondition {
  field: string
  operator: 'eq' | 'neq' | 'in' | 'gt' | 'gte' | 'lt' | 'lte'
  value: string | number | boolean | string[]
}

export interface PostingRuleConfig {
  ruleCode: string
  ruleName: string
  eventType: string
  version?: number
  priority?: number
  effectiveFrom: string
  effectiveTo?: string | null
  conditions?: PostingRuleCondition[]
  lineDefinitions: PostingRuleLineDefinition[]
  isSystemRule?: boolean
}

export interface LedgerQueryFilters {
  legalEntityId: string
  financialYearId?: string
  accountingPeriodId?: string
  voucherType?: VoucherType
  status?: VoucherStatus
  accountId?: string
  partyType?: PartyType
  partyId?: string
  sourceModule?: string
  sourceDocumentType?: string
  sourceDocumentId?: string
  fromDate?: string
  toDate?: string
  page?: number
  limit?: number
}

export interface LedgerSchemaStatus {
  phase: '2B'
  modelsPresent: boolean
  postingEngine: true
  publicPostingWorkflow: false
  journalWorkflow: false
  reversalWorkflow: false
  foundationReady: true
  tables: string[]
}

export const EDITABLE_VOUCHER_STATUSES: VoucherStatus[] = ['DRAFT', 'SENT_BACK']

export const TERMINAL_VOUCHER_STATUSES: VoucherStatus[] = ['POSTED', 'REVERSED', 'CANCELLED']
