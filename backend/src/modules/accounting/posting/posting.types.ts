import type { PostingEventStatus, VoucherType } from '../ledger/ledger.types.js'

export type PostingPurpose = 'SYSTEM_DOCUMENT' | 'MANUAL_JOURNAL' | 'OPENING_BALANCE' | 'REVERSAL'

export type PostingPartyType = 'CUSTOMER' | 'VENDOR' | 'EMPLOYEE' | 'OTHER'

export interface PostingRequestLine {
  lineNumber: number
  accountId?: string
  accountMappingKey?: string
  partyType?: PostingPartyType | null
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

export interface PostingRequest {
  legalEntityId: string
  eventKey: string
  eventType: string
  eventVersion?: number
  postingPurpose: PostingPurpose
  voucherType: VoucherType
  documentDate: string
  postingDate: string
  branchId?: string | null
  referenceNumber?: string | null
  externalReference?: string | null
  narration?: string | null
  currencyCode?: string
  exchangeRate?: string
  sourceModule?: string | null
  sourceDocumentType?: string | null
  sourceDocumentId?: string | null
  sourceDocumentLineId?: string | null
  lines: PostingRequestLine[]
}

export interface PostingAuthorizationContext {
  permissionChecked: boolean
}

export interface PostingWorkflowContext {
  workflowSatisfied: boolean
}

export interface PostingContext {
  tenantId: string
  userId?: string | null
  authorization: PostingAuthorizationContext
  workflow: PostingWorkflowContext
  ipAddress?: string | null
  userAgent?: string | null
}

export interface ResolvedPostingLine {
  lineNumber: number
  accountId: string
  accountCode: string
  accountName: string
  partyType?: PostingPartyType | null
  partyId?: string | null
  partyNameSnapshot?: string | null
  debitAmount: string
  creditAmount: string
  baseDebitAmount: string
  baseCreditAmount: string
  currencyCode: string
  exchangeRate: string
  costCentreId?: string | null
  projectReference?: string | null
  departmentReference?: string | null
  referenceDocumentType?: string | null
  referenceDocumentId?: string | null
  referenceDocumentLineId?: string | null
  dueDate?: string | null
  lineNarration?: string | null
}

export interface ValidatedPostingData {
  request: PostingRequest
  financialYearId: string
  accountingPeriodId: string
  baseCurrency: string
  resolvedLines: ResolvedPostingLine[]
  totalDebit: string
  totalCredit: string
  baseTotalDebit: string
  baseTotalCredit: string
  voucherCurrency: string
  voucherExchangeRate: string
}

export interface PostingResult {
  success: boolean
  idempotentReplay: boolean
  postingEventId: string
  voucherId: string
  voucherNumber: string
  voucherStatus: 'POSTED'
  postingDate: string
  totalDebit: string
  totalCredit: string
  ledgerEntryCount: number
  status: PostingEventStatus
}

export interface PostingEngineStatus {
  phase: '2B'
  modelsPresent: boolean
  postingEngine: true
  publicPostingWorkflow: false
  journalWorkflow: true
  reversalWorkflow: false
  foundationReady: true
  tables: string[]
}
