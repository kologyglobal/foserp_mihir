import type {
  PayableCloseGateCheckStatus,
  PayableCloseGateStatus,
  PayableReconciliationExceptionCategory,
  PayableReconciliationExceptionSeverity,
  PayableReconciliationRunStatus,
  PayableReconciliationSourceMode,
  PayableReconciliationStatus,
} from '@prisma/client'

export interface CreateReconciliationRunInput {
  legalEntityId: string
  asOfDate?: string
  includeVendorLevel?: boolean
  toleranceOverride?: string
}

export interface ReconciliationActor {
  tenantId: string
  userId: string | null
}

/** A control account gathered from any of: VENDOR_PAYABLE-typed leaf accounts, the
 * DefaultAccountMapping(VENDOR_PAYABLE) target, or accounts actually referenced by open items. */
export interface ControlAccountInfo {
  accountId: string
  accountCode: string | null
  accountName: string | null
  isActive: boolean
  isGroup: boolean
}

export interface AccountBalanceRow {
  accountId: string
  accountCode: string | null
  accountName: string | null
  glBalance: string
  subledgerBalance: string
  variance: string
  matched: boolean
  openItemCount: number
}

export interface VendorBalanceRow {
  vendorId: string
  vendorCode: string | null
  vendorName: string | null
  glBalance: string
  subledgerBalance: string
  variance: string
  matched: boolean
  openItemCount: number
}

export interface ReconciliationExceptionDraft {
  severity: PayableReconciliationExceptionSeverity
  category: PayableReconciliationExceptionCategory
  code: string
  message: string
  accountId?: string | null
  vendorId?: string | null
  openItemId?: string | null
  voucherId?: string | null
  documentType?: string | null
  documentId?: string | null
  details?: Record<string, unknown> | null
}

export interface ReconciledOpenItemAsOf {
  id: string
  vendorId: string
  vendorPayableAccountId: string
  side: 'CREDIT' | 'DEBIT'
  baseOutstandingAsOf: string
}

export interface ReconciliationRunDto {
  id: string
  tenantId: string
  legalEntityId: string
  asOfDate: string
  sourceMode: PayableReconciliationSourceMode
  runStatus: PayableReconciliationRunStatus
  status: PayableReconciliationStatus | null
  baseCurrency: string
  tolerance: string
  includeVendorLevel: boolean
  controlAccountCount: number
  matchedAccountCount: number
  mismatchedAccountCount: number
  glTotal: string
  subledgerTotal: string
  variance: string
  exceptionCount: number
  infoCount: number
  warningCount: number
  errorCount: number
  blockerCount: number
  vendorCount: number
  vendorMismatchCount: number
  limitations: string[]
  errorMessage: string | null
  startedAt: string
  completedAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  isStale: boolean
}

export interface ReconciliationAccountResultDto {
  id: string
  runId: string
  accountId: string
  accountCode: string | null
  accountName: string | null
  glBalance: string
  subledgerBalance: string
  variance: string
  matched: boolean
  openItemCount: number
}

export interface ReconciliationExceptionDto {
  id: string
  runId: string
  severity: PayableReconciliationExceptionSeverity
  category: PayableReconciliationExceptionCategory
  code: string
  message: string
  accountId: string | null
  vendorId: string | null
  openItemId: string | null
  voucherId: string | null
  documentType: string | null
  documentId: string | null
  details: Record<string, unknown> | null
  isAcknowledged: boolean
  acknowledgedBy: string | null
  acknowledgedAt: string | null
  acknowledgementNote: string | null
  createdAt: string
}

export interface ListReconciliationRunsQuery {
  legalEntityId: string
  page?: number
  pageSize?: number
  sortOrder?: 'asc' | 'desc'
}

export interface ListReconciliationExceptionsQuery {
  page?: number
  pageSize?: number
  severity?: PayableReconciliationExceptionSeverity
  category?: PayableReconciliationExceptionCategory
  isAcknowledged?: boolean
}

export interface AcknowledgeExceptionInput {
  note?: string
}

// ─── Close gate ───────────────────────────────────────────────────────────────

export interface CreateCloseGateRunInput {
  legalEntityId: string
  periodId: string
  runFreshReconciliation?: boolean
  reconciliationRunId?: string
  includeVendorLevel?: boolean
}

export interface CloseGateCheckDraft {
  checkCode: string
  checkName: string
  status: PayableCloseGateCheckStatus
  message: string
  details?: Record<string, unknown> | null
}

export interface CloseGateRunDto {
  id: string
  tenantId: string
  legalEntityId: string
  periodId: string
  asOfDate: string
  status: PayableCloseGateStatus
  reconciliationRunId: string | null
  checksTotal: number
  checksPassed: number
  checksWarning: number
  checksBlocked: number
  checksFailed: number
  summary: Record<string, unknown> | null
  startedAt: string
  completedAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CloseGateCheckDto {
  id: string
  runId: string
  checkCode: string
  checkName: string
  status: PayableCloseGateCheckStatus
  message: string
  details: Record<string, unknown> | null
  createdAt: string
}

export interface ListCloseGateRunsQuery {
  legalEntityId: string
  page?: number
  pageSize?: number
  sortOrder?: 'asc' | 'desc'
}
