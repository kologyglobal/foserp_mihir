import type {
  Account,
  AccountTreeNode,
  AccountingPeriod,
  Branch,
  CoaTemplateId,
  CostCentre,
  CostCentreTreeNode,
  DefaultAccountMapping,
  DefaultMappingValidationResult,
  FinanceApprovalRule,
  FinanceNumberSeries,
  FinanceSettings,
  FinancialYear,
  LegalEntity,
  SetupStatus,
} from '../../types/financeSetup'
import type { Journal, JournalAuditEntry, JournalListFilters, JournalValidationReport } from '../../types/journals'
import type { ApprovalListFilters, ApprovalRequest, JournalApprovalTimelineEntry } from '../../types/approvals'
import { apiDownloadBlob, apiRequest, tenantPath } from './client'

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const q = qs.toString()
  return q ? `?${q}` : ''
}

function leQuery(legalEntityId?: string) {
  return legalEntityId ? { legalEntityId } : undefined
}

// ─── Legal entities ───────────────────────────────────────────────────────────

export async function listLegalEntities(params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<LegalEntity[]>(`${tenantPath('/accounting/legal-entities')}${buildQuery(params)}`)
}

export async function getLegalEntity(id: string) {
  return apiRequest<LegalEntity>(tenantPath(`/accounting/legal-entities/${id}`))
}

export async function createLegalEntity(data: Record<string, unknown>) {
  return apiRequest<LegalEntity>(tenantPath('/accounting/legal-entities'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateLegalEntity(id: string, data: Record<string, unknown>) {
  return apiRequest<LegalEntity>(tenantPath(`/accounting/legal-entities/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function setDefaultLegalEntity(id: string) {
  return apiRequest<LegalEntity>(tenantPath(`/accounting/legal-entities/${id}/set-default`), { method: 'POST' })
}

export async function activateLegalEntity(id: string) {
  return apiRequest<LegalEntity>(tenantPath(`/accounting/legal-entities/${id}/activate`), { method: 'POST' })
}

export async function deactivateLegalEntity(id: string) {
  return apiRequest<LegalEntity>(tenantPath(`/accounting/legal-entities/${id}/deactivate`), { method: 'POST' })
}

// ─── Branches ─────────────────────────────────────────────────────────────────

export async function listBranches(legalEntityId: string, params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<Branch[]>(
    `${tenantPath(`/accounting/legal-entities/${legalEntityId}/branches`)}${buildQuery(params)}`,
  )
}

export async function createBranch(legalEntityId: string, data: Record<string, unknown>) {
  return apiRequest<Branch>(tenantPath(`/accounting/legal-entities/${legalEntityId}/branches`), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateBranch(id: string, data: Record<string, unknown>) {
  return apiRequest<Branch>(tenantPath(`/accounting/branches/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function setDefaultBranch(id: string) {
  return apiRequest<Branch>(tenantPath(`/accounting/branches/${id}/set-default`), { method: 'POST' })
}

export async function activateBranch(id: string) {
  return apiRequest<Branch>(tenantPath(`/accounting/branches/${id}/activate`), { method: 'POST' })
}

export async function deactivateBranch(id: string) {
  return apiRequest<Branch>(tenantPath(`/accounting/branches/${id}/deactivate`), { method: 'POST' })
}

// ─── Financial years ──────────────────────────────────────────────────────────

export async function listFinancialYears(legalEntityId: string, params?: Record<string, string | number | boolean | undefined>) {
  return apiRequest<FinancialYear[]>(
    `${tenantPath('/accounting/financial-years')}${buildQuery({ ...params, legalEntityId })}`,
  )
}

export async function createFinancialYear(data: Record<string, unknown>) {
  return apiRequest<FinancialYear>(tenantPath('/accounting/financial-years'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateFinancialYear(id: string, data: Record<string, unknown>) {
  return apiRequest<FinancialYear>(tenantPath(`/accounting/financial-years/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function activateFinancialYear(id: string) {
  return apiRequest<FinancialYear>(tenantPath(`/accounting/financial-years/${id}/activate`), { method: 'POST' })
}

export async function closeFinancialYear(id: string) {
  return apiRequest<FinancialYear>(tenantPath(`/accounting/financial-years/${id}/close`), { method: 'POST' })
}

export interface YearEndClosePreviewApi {
  financialYearId: string
  financialYearName: string
  legalEntityId: string
  status: string
  alreadyClosed: boolean
  existingRun: {
    id: string
    status: string
    voucherId: string | null
    voucherNumber: string | null
    closedAt: string
  } | null
  postingDate: string
  lastPeriod: { id: string; name: string; status: string; endDate: string } | null
  openPeriodNames: string[]
  revenueToClose: string
  expenseToClose: string
  profitOrLoss: string
  retainedEarnings: { accountId: string; accountCode: string; accountName: string } | null
  lines: Array<{
    accountId: string
    accountCode: string
    accountName: string
    category: 'INCOME' | 'EXPENSE'
    netBalance: string
    closeDebit: string
    closeCredit: string
  }>
  blockers: Array<{ code: string; message: string }>
  readyToPost: boolean
}

export async function previewYearEndClose(financialYearId: string) {
  return apiRequest<YearEndClosePreviewApi>(
    tenantPath(`/accounting/financial-years/${financialYearId}/year-end-preview`),
  )
}

export async function executeYearEndClose(financialYearId: string) {
  return apiRequest<{
    run: Record<string, unknown>
    preview: YearEndClosePreviewApi
    idempotentReplay: boolean
  }>(tenantPath(`/accounting/financial-years/${financialYearId}/year-end-close`), { method: 'POST' })
}

// ─── Periods ──────────────────────────────────────────────────────────────────

export async function listPeriods(
  legalEntityId: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  return apiRequest<AccountingPeriod[]>(
    `${tenantPath('/accounting/periods')}${buildQuery({ ...params, legalEntityId })}`,
  )
}

export async function generatePeriods(data: { legalEntityId: string; financialYearId: string }) {
  return apiRequest<AccountingPeriod[]>(tenantPath('/accounting/periods/generate'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updatePeriod(id: string, data: Record<string, unknown>) {
  return apiRequest<AccountingPeriod>(tenantPath(`/accounting/periods/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function markPeriodUnderReview(id: string) {
  return apiRequest<AccountingPeriod>(tenantPath(`/accounting/periods/${id}/mark-under-review`), { method: 'POST' })
}

export async function closePeriod(id: string) {
  return apiRequest<AccountingPeriod>(tenantPath(`/accounting/periods/${id}/close`), { method: 'POST' })
}

export async function reopenPeriod(id: string, reason: string) {
  return apiRequest<AccountingPeriod>(tenantPath(`/accounting/periods/${id}/reopen`), {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export type PeriodCloseReadinessApiCheck = {
  key: string
  label: string
  severity: 'PASS' | 'WARN' | 'BLOCK'
  message: string
  href?: string
  count?: number
  featureEnabled?: boolean
}

export type PeriodCloseReadinessApi = {
  periodId: string
  periodName: string
  periodStatus: string
  legalEntityId: string
  startDate: string
  endDate: string
  hardBlockEnabled: boolean
  canClose: boolean
  blockingCount: number
  warningCount: number
  unpostedJournalCount: number
  openBankReconCount: number
  checks: PeriodCloseReadinessApiCheck[]
  blockers: PeriodCloseReadinessApiCheck[]
}

export type PeriodCloseChecklistAckApi = {
  id: string
  periodId: string
  checkKey: string
  status: 'ACK' | 'NA'
  note: string | null
  ackedBy: string | null
  ackedAt: string
  updatedAt: string
}

export async function getPeriodCloseReadiness(id: string) {
  return apiRequest<PeriodCloseReadinessApi>(tenantPath(`/accounting/periods/${id}/close-readiness`))
}

export async function listPeriodCloseChecklistAcks(id: string) {
  return apiRequest<PeriodCloseChecklistAckApi[]>(tenantPath(`/accounting/periods/${id}/checklist-acks`))
}

export async function upsertPeriodCloseChecklistAcks(
  id: string,
  items: Array<{ checkKey: string; status: 'ACK' | 'NA'; note?: string | null }>,
) {
  return apiRequest<PeriodCloseChecklistAckApi[]>(tenantPath(`/accounting/periods/${id}/checklist-acks`), {
    method: 'PUT',
    body: JSON.stringify({ items }),
  })
}

// ─── Period-end adjustments (accruals + prepaid) ──────────────────────────────

export type PeriodAdjustmentKindApi = 'ACCRUAL' | 'PREPAID'
export type PeriodAdjustmentStatusApi =
  | 'DRAFT'
  | 'READY_TO_POST'
  | 'POSTED'
  | 'PARTIALLY_RECOGNISED'
  | 'FULLY_RECOGNISED'
  | 'REVERSED'
  | 'CANCELLED'

export type PeriodAdjustmentScheduleApi = {
  id: string
  sequence: number
  periodId: string
  periodName: string
  periodStatus: string
  periodEndDate: string
  amount: string
  status: string
  voucherId: string | null
  voucherNumber: string | null
  postedAt: string | null
}

export type PeriodAdjustmentDto = {
  id: string
  kind: PeriodAdjustmentKindApi
  adjustmentNumber: string
  status: PeriodAdjustmentStatusApi
  legalEntityId: string
  description: string
  narration: string | null
  totalAmount: string
  recognisedAmount: string
  remainingAmount: string
  currencyCode: string
  expenseAccount: { id: string; accountCode: string; accountName: string }
  balanceSheetAccount: { id: string; accountCode: string; accountName: string }
  costCentre: { id: string; code: string; name: string } | null
  departmentReference: string | null
  projectReference: string | null
  period: { id: string; name: string; status: string; startDate: string; endDate: string }
  postingDate: string
  autoReverse: boolean
  reversalPeriod: { id: string; name: string; status: string; startDate: string } | null
  numberOfPeriods: number | null
  voucherId: string | null
  voucherNumber: string | null
  reversalVoucherId: string | null
  reversalVoucherNumber: string | null
  postedAt: string | null
  reversedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  schedules: PeriodAdjustmentScheduleApi[]
  createdAt: string
  updatedAt: string
}

export async function listPeriodAdjustments(params?: {
  legalEntityId?: string
  kind?: PeriodAdjustmentKindApi
  status?: PeriodAdjustmentStatusApi
  periodId?: string
  page?: number
  limit?: number
  search?: string
}) {
  return apiRequest<PeriodAdjustmentDto[]>(
    `${tenantPath('/accounting/period-adjustments')}${buildQuery(params)}`,
  )
}

export async function getPeriodAdjustment(id: string) {
  return apiRequest<PeriodAdjustmentDto>(tenantPath(`/accounting/period-adjustments/${id}`))
}

export async function createPeriodAdjustment(body: Record<string, unknown>) {
  return apiRequest<PeriodAdjustmentDto>(tenantPath('/accounting/period-adjustments'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updatePeriodAdjustment(id: string, body: Record<string, unknown>) {
  return apiRequest<PeriodAdjustmentDto>(tenantPath(`/accounting/period-adjustments/${id}`), {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function markPeriodAdjustmentReady(id: string) {
  return apiRequest<PeriodAdjustmentDto>(tenantPath(`/accounting/period-adjustments/${id}/mark-ready`), {
    method: 'POST',
  })
}

export async function revisePeriodAdjustment(id: string) {
  return apiRequest<PeriodAdjustmentDto>(tenantPath(`/accounting/period-adjustments/${id}/revise`), {
    method: 'POST',
  })
}

export async function cancelPeriodAdjustment(id: string, reason: string) {
  return apiRequest<PeriodAdjustmentDto>(tenantPath(`/accounting/period-adjustments/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function postPeriodAdjustment(id: string) {
  return apiRequest<PeriodAdjustmentDto>(tenantPath(`/accounting/period-adjustments/${id}/post`), {
    method: 'POST',
  })
}

export async function reversePeriodAdjustment(id: string, body: { reason: string; reversalDate?: string }) {
  return apiRequest<PeriodAdjustmentDto>(tenantPath(`/accounting/period-adjustments/${id}/reverse`), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function recognisePrepaidSchedule(id: string, scheduleId: string) {
  return apiRequest<PeriodAdjustmentDto>(
    tenantPath(`/accounting/period-adjustments/${id}/schedules/${scheduleId}/recognise`),
    { method: 'POST' },
  )
}

export async function getPeriodAdjustmentSummary(periodId: string) {
  return apiRequest<Record<string, unknown>>(
    tenantPath(`/accounting/period-adjustments/periods/${periodId}/summary`),
  )
}

// ─── Period Close ops (calendar / templates / reopen requests) ────────────────

export type PeriodCloseChecklistTemplateApi = {
  id: string
  legalEntityId: string
  code: string
  title: string
  module: string
  defaultOwnerRole: string | null
  defaultDueOffsetDays: number
  sortOrder: number
  isActive: boolean
  blocksClose: boolean
  createdAt: string
  updatedAt: string
}

export type PeriodCloseCalendarEventApi = {
  id: string
  periodId: string
  title: string
  category: string
  dueDate: string
  ownerLabel: string | null
  status: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type PeriodReopenRequestApi = {
  id: string
  requestNumber: string
  status: string
  legalEntityId: string
  periodId: string
  periodName: string
  periodStatus: string
  moduleLabel: string
  reasonCode: string
  reasonDetail: string | null
  documentRef: string | null
  riskExplanation: string
  requestedUntil: string
  requestedBy: string | null
  requestedAt: string | null
  approvedBy: string | null
  approvedAt: string | null
  rejectedBy: string | null
  rejectedAt: string | null
  rejectReason: string | null
  openedAt: string | null
  expiredAt: string | null
  closedAt: string | null
  audit: Array<{ at: string; by: string; action: string; note?: string }>
  createdAt: string
  updatedAt: string
}

export async function listPeriodCloseTemplates(legalEntityId: string, includeInactive = false) {
  return apiRequest<PeriodCloseChecklistTemplateApi[]>(
    `${tenantPath('/accounting/period-close/checklist-templates')}${buildQuery({ legalEntityId, includeInactive, limit: 100 })}`,
  )
}

export async function createPeriodCloseTemplate(body: Record<string, unknown>) {
  return apiRequest<PeriodCloseChecklistTemplateApi>(tenantPath('/accounting/period-close/checklist-templates'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function listPeriodCloseCalendarEvents(periodId: string) {
  return apiRequest<PeriodCloseCalendarEventApi[]>(
    tenantPath(`/accounting/period-close/periods/${periodId}/calendar-events`),
  )
}

export async function generatePeriodCloseCalendar(periodId: string) {
  return apiRequest<PeriodCloseCalendarEventApi[]>(
    tenantPath(`/accounting/period-close/periods/${periodId}/calendar/generate`),
    { method: 'POST' },
  )
}

export async function createPeriodCloseCalendarEvent(periodId: string, body: Record<string, unknown>) {
  return apiRequest<PeriodCloseCalendarEventApi>(
    tenantPath(`/accounting/period-close/periods/${periodId}/calendar-events`),
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export async function listPeriodReopenRequests(params?: {
  legalEntityId?: string
  periodId?: string
  status?: string
  page?: number
  limit?: number
}) {
  return apiRequest<PeriodReopenRequestApi[]>(
    `${tenantPath('/accounting/period-close/reopen-requests')}${buildQuery(params)}`,
  )
}

export async function createPeriodReopenRequest(body: Record<string, unknown>) {
  return apiRequest<PeriodReopenRequestApi>(tenantPath('/accounting/period-close/reopen-requests'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function submitPeriodReopenRequest(id: string) {
  return apiRequest<PeriodReopenRequestApi>(tenantPath(`/accounting/period-close/reopen-requests/${id}/submit`), {
    method: 'POST',
  })
}

export async function approvePeriodReopenRequest(id: string, body?: { note?: string; activate?: boolean }) {
  return apiRequest<PeriodReopenRequestApi>(tenantPath(`/accounting/period-close/reopen-requests/${id}/approve`), {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
}

export async function rejectPeriodReopenRequest(id: string, reason: string) {
  return apiRequest<PeriodReopenRequestApi>(tenantPath(`/accounting/period-close/reopen-requests/${id}/reject`), {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function instantiatePeriodCloseChecklist(periodId: string) {
  return apiRequest<unknown[]>(tenantPath(`/accounting/period-close/periods/${periodId}/checklist/instantiate`), {
    method: 'POST',
  })
}

// ─── FX revaluation (period close) ────────────────────────────────────────────

export type FxRevaluationLineApi = {
  id: string
  accountOrParty: string
  currency: string
  foreignAmount: number
  originalRate: number
  closingRate: number
  bookValueInr: number
  revaluedValueInr: number
  gainLoss: number
  sourceType: string
  sourceId: string
  isAsset: boolean
}

export type FxRevaluationRunApi = {
  id: string
  status: string
  legalEntityId: string
  periodId: string
  periodName: string
  asOfDate: string
  baseCurrency: string
  totalGain: string
  totalLoss: string
  netGainLoss: string
  exchangeGainAccount: string | null
  exchangeLossAccount: string | null
  gainAccountId: string | null
  lossAccountId: string | null
  reversalPeriod: { id: string; name: string; startDate: string } | null
  voucherId: string | null
  voucherNumber: string | null
  reversalVoucherNumber: string | null
  postedAt: string | null
  reversedAt: string | null
  lines: FxRevaluationLineApi[]
  createdAt: string
  updatedAt: string
}

export type FxExchangeRateApi = {
  id: string
  legalEntityId: string
  currencyCode: string
  asOfDate: string
  rate: string
  source: string
  notes: string | null
}

export async function listFxRates(params: {
  legalEntityId: string
  currencyCode?: string
  asOfDate?: string
  page?: number
  limit?: number
}) {
  return apiRequest<FxExchangeRateApi[]>(
    `${tenantPath('/accounting/period-close/fx-revaluation/rates')}${buildQuery(params)}`,
  )
}

export async function upsertFxRate(body: {
  legalEntityId: string
  currencyCode: string
  asOfDate: string
  rate: string | number
  notes?: string
}) {
  return apiRequest<FxExchangeRateApi>(tenantPath('/accounting/period-close/fx-revaluation/rates'), {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function getFxRevaluationRun(periodId: string) {
  return apiRequest<FxRevaluationRunApi | null>(
    tenantPath(`/accounting/period-close/fx-revaluation/periods/${periodId}/run`),
  )
}

export async function previewFxRevaluation(periodId: string) {
  return apiRequest<FxRevaluationRunApi>(
    tenantPath(`/accounting/period-close/fx-revaluation/periods/${periodId}/preview`),
    { method: 'POST' },
  )
}

export async function postFxRevaluation(runId: string) {
  return apiRequest<FxRevaluationRunApi>(
    tenantPath(`/accounting/period-close/fx-revaluation/runs/${runId}/post`),
    { method: 'POST' },
  )
}

export async function reverseFxRevaluation(runId: string, body: { reason: string; reversalDate?: string }) {
  return apiRequest<FxRevaluationRunApi>(
    tenantPath(`/accounting/period-close/fx-revaluation/runs/${runId}/reverse`),
    { method: 'POST', body: JSON.stringify(body) },
  )
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export async function listAccounts(
  legalEntityId: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  return apiRequest<Account[]>(
    `${tenantPath('/accounting/accounts')}${buildQuery({ ...params, legalEntityId })}`,
  )
}

export async function getAccountTree(legalEntityId: string, includeInactive = false) {
  return apiRequest<AccountTreeNode[]>(
    `${tenantPath('/accounting/accounts/tree')}${buildQuery({ legalEntityId, includeInactive })}`,
  )
}

export async function createAccount(data: Record<string, unknown>) {
  return apiRequest<Account>(tenantPath('/accounting/accounts'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateAccount(id: string, data: Record<string, unknown>) {
  return apiRequest<Account>(tenantPath(`/accounting/accounts/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function activateAccount(id: string) {
  return apiRequest<Account>(tenantPath(`/accounting/accounts/${id}/activate`), { method: 'POST' })
}

export async function deactivateAccount(id: string) {
  return apiRequest<Account>(tenantPath(`/accounting/accounts/${id}/deactivate`), { method: 'POST' })
}

export async function applyCoaTemplate(legalEntityId: string, templateId: CoaTemplateId) {
  return apiRequest<{ applied: number }>(tenantPath('/accounting/accounts/apply-template'), {
    method: 'POST',
    body: JSON.stringify({ legalEntityId, templateId }),
  })
}

export type CoaImportSummary = {
  imported: number
  updated: number
  skipped: number
  failed: number
  rows: Array<{ row: number; ok: boolean; code?: string; errors?: string[] }>
}

export async function importCoaAccounts(body: {
  legalEntityId: string
  rows: Array<Record<string, string>>
  duplicateMode?: 'skip' | 'update' | 'reject'
}) {
  return apiRequest<CoaImportSummary>(tenantPath('/accounting/accounts/import'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function downloadCoaImportTemplate(): Promise<void> {
  const { blob, filename } = await apiDownloadBlob(tenantPath('/accounting/accounts/import/template'))
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? 'chart-of-accounts-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Default mappings ─────────────────────────────────────────────────────────

export async function getDefaultMappings(legalEntityId: string) {
  return apiRequest<DefaultAccountMapping[]>(
    `${tenantPath('/accounting/default-mappings')}${buildQuery(leQuery(legalEntityId))}`,
  )
}

export async function saveDefaultMappings(data: {
  legalEntityId: string
  mappings: Array<{ mappingKey: string; accountId: string; isMandatory?: boolean; description?: string }>
}) {
  return apiRequest<DefaultAccountMapping[]>(tenantPath('/accounting/default-mappings'), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function validateDefaultMappings(legalEntityId: string) {
  return apiRequest<DefaultMappingValidationResult>(
    `${tenantPath('/accounting/default-mappings/validate')}${buildQuery(leQuery(legalEntityId))}`,
  )
}

// ─── Finance settings ─────────────────────────────────────────────────────────

export async function getFinanceSettings(legalEntityId: string) {
  return apiRequest<FinanceSettings>(
    `${tenantPath('/accounting/settings')}${buildQuery(leQuery(legalEntityId))}`,
  )
}

export async function saveFinanceSettings(data: Record<string, unknown>) {
  return apiRequest<FinanceSettings>(tenantPath('/accounting/settings'), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function getSetupStatus(legalEntityId: string) {
  return apiRequest<SetupStatus>(
    `${tenantPath('/accounting/setup-status')}${buildQuery(leQuery(legalEntityId))}`,
  )
}

export async function activateFinance(legalEntityId: string) {
  return apiRequest<FinanceSettings>(tenantPath('/accounting/activate'), {
    method: 'POST',
    body: JSON.stringify({ legalEntityId }),
  })
}

// ─── Cost centres ─────────────────────────────────────────────────────────────

export async function listCostCentres(
  legalEntityId: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  return apiRequest<CostCentre[]>(
    `${tenantPath('/accounting/cost-centres')}${buildQuery({ ...params, legalEntityId })}`,
  )
}

export async function getCostCentreTree(legalEntityId: string) {
  return apiRequest<CostCentreTreeNode[]>(
    `${tenantPath('/accounting/cost-centres/tree')}${buildQuery(leQuery(legalEntityId))}`,
  )
}

export async function createCostCentre(data: Record<string, unknown>) {
  return apiRequest<CostCentre>(tenantPath('/accounting/cost-centres'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateCostCentre(id: string, data: Record<string, unknown>) {
  return apiRequest<CostCentre>(tenantPath(`/accounting/cost-centres/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function activateCostCentre(id: string) {
  return apiRequest<CostCentre>(tenantPath(`/accounting/cost-centres/${id}/activate`), { method: 'POST' })
}

export async function deactivateCostCentre(id: string) {
  return apiRequest<CostCentre>(tenantPath(`/accounting/cost-centres/${id}/deactivate`), { method: 'POST' })
}

// ─── Number series ────────────────────────────────────────────────────────────

export async function listNumberSeries(legalEntityId: string) {
  return apiRequest<FinanceNumberSeries[]>(
    `${tenantPath('/accounting/number-series')}${buildQuery(leQuery(legalEntityId))}`,
  )
}

export async function upsertNumberSeries(data: Record<string, unknown>) {
  return apiRequest<FinanceNumberSeries>(tenantPath('/accounting/number-series'), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// ─── Approval rules ───────────────────────────────────────────────────────────

export async function listApprovalRules(
  legalEntityId: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  return apiRequest<FinanceApprovalRule[]>(
    `${tenantPath('/accounting/approval-rules')}${buildQuery({ ...params, legalEntityId })}`,
  )
}

export async function createApprovalRule(data: Record<string, unknown>) {
  return apiRequest<FinanceApprovalRule>(tenantPath('/accounting/approval-rules'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateApprovalRule(id: string, data: Record<string, unknown>) {
  return apiRequest<FinanceApprovalRule>(tenantPath(`/accounting/approval-rules/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// ─── Manual journals (Phase 2C1) ──────────────────────────────────────────────

export async function listJournals(params: JournalListFilters) {
  return apiRequest<Journal[]>(
    `${tenantPath('/accounting/journals')}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`,
  )
}

export async function getJournal(id: string) {
  return apiRequest<Journal>(tenantPath(`/accounting/journals/${id}`))
}

export async function createJournal(data: Record<string, unknown>) {
  return apiRequest<Journal>(tenantPath('/accounting/journals'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateJournal(id: string, data: Record<string, unknown>) {
  return apiRequest<Journal>(tenantPath(`/accounting/journals/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function validateJournal(id: string) {
  return apiRequest<JournalValidationReport>(tenantPath(`/accounting/journals/${id}/validate`), { method: 'POST' })
}

export async function submitJournal(id: string) {
  return apiRequest<Journal>(tenantPath(`/accounting/journals/${id}/submit`), { method: 'POST' })
}

export async function cancelJournal(id: string, cancellationReason: string) {
  return apiRequest<Journal>(tenantPath(`/accounting/journals/${id}/cancel`), {
    method: 'POST',
    body: JSON.stringify({ cancellationReason }),
  })
}

export async function getJournalAudit(id: string) {
  return apiRequest<JournalAuditEntry[]>(tenantPath(`/accounting/journals/${id}/audit`))
}

// ─── Journal approvals (Phase 2C2A) ─────────────────────────────────────────

export async function listApprovalRequests(params: ApprovalListFilters) {
  return apiRequest<ApprovalRequest[]>(
    `${tenantPath('/accounting/approvals')}${buildQuery(params as unknown as Record<string, string | number | boolean | undefined>)}`,
  )
}

export async function getApprovalRequest(id: string) {
  return apiRequest<ApprovalRequest>(tenantPath(`/accounting/approvals/${id}`))
}

export async function getJournalApprovals(journalId: string) {
  return apiRequest<JournalApprovalTimelineEntry[]>(tenantPath(`/accounting/journals/${journalId}/approvals`))
}

export async function approveJournal(journalId: string, comments?: string) {
  return apiRequest<Journal>(tenantPath(`/accounting/journals/${journalId}/approve`), {
    method: 'POST',
    body: JSON.stringify({ comments }),
  })
}

export async function sendBackJournal(journalId: string, comments: string) {
  return apiRequest<Journal>(tenantPath(`/accounting/journals/${journalId}/send-back`), {
    method: 'POST',
    body: JSON.stringify({ comments }),
  })
}

export async function rejectJournal(journalId: string, comments: string) {
  return apiRequest<Journal>(tenantPath(`/accounting/journals/${journalId}/reject`), {
    method: 'POST',
    body: JSON.stringify({ comments }),
  })
}

export interface JournalPostResponse {
  journal: Journal
  posting: {
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
    status: string
  }
}

export interface JournalLedgerEntry {
  id: string
  voucherId: string
  voucherLineId: string | null
  lineNumber: number
  accountId: string
  debitAmount: string
  creditAmount: string
  postingDate: string
  voucherNumber: string
}

export async function postJournal(id: string) {
  return apiRequest<JournalPostResponse>(tenantPath(`/accounting/journals/${id}/post`), { method: 'POST' })
}

export interface JournalReverseResponse {
  journal: Journal
  posting: JournalPostResponse['posting']
  reversalVoucherId: string
  idempotentReplay: boolean
}

export async function reverseJournal(id: string, reason: string) {
  return apiRequest<JournalReverseResponse>(tenantPath(`/accounting/journals/${id}/reverse`), {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function getJournalLedger(id: string) {
  return apiRequest<JournalLedgerEntry[]>(tenantPath(`/accounting/journals/${id}/ledger`))
}

// ─── Accounting vouchers (posted GL drill-through) ──────────────────────────

export interface AccountingVoucherLedgerAccount {
  id: string
  code: string
  name: string
  category: string
  accountType: string
  isGroup: boolean
  normalBalance: string
  isControlAccount: boolean
}

export interface AccountingVoucherLedgerLine {
  id: string
  voucherId: string
  voucherLineId: string
  voucherType: string
  voucherNumber: string
  lineNumber: number
  postingDate: string | null
  documentDate: string | null
  accountId: string
  account: AccountingVoucherLedgerAccount | null
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
  sourceModule: string | null
  sourceDocumentType: string | null
  sourceDocumentId: string | null
  isReversal: boolean
  reversalOfEntryId: string | null
  reversedByEntryId: string | null
  postedBy: string | null
  postedAt: string | null
}

export interface AccountingVoucherLedgerHeader {
  id: string
  voucherNumber: string | null
  voucherType: string
  status: string
  documentDate: string | null
  postingDate: string | null
  referenceNumber: string | null
  externalReference: string | null
  narration: string | null
  currencyCode: string
  exchangeRate: string
  sourceModule: string | null
  sourceDocumentType: string | null
  sourceDocumentId: string | null
  reversalOfVoucherId: string | null
  reversedByVoucherId: string | null
  reversalReason: string | null
  postedAt: string | null
  postedBy: string | null
  totalDebit: string
  totalCredit: string
}

export interface AccountingVoucherLedgerResponse {
  voucher: AccountingVoucherLedgerHeader
  entries: AccountingVoucherLedgerLine[]
}

export async function getAccountingVoucher(id: string) {
  return apiRequest<Record<string, unknown>>(tenantPath(`/accounting/vouchers/${id}`))
}

export async function getAccountingVoucherLedger(id: string) {
  return apiRequest<AccountingVoucherLedgerResponse>(tenantPath(`/accounting/vouchers/${id}/ledger`))
}
