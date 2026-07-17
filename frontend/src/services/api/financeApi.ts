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
import { apiRequest, tenantPath } from './client'

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
