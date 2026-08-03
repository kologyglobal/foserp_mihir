import { isApiMode } from '../../config/apiConfig'
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
import * as api from '../api/financeApi'
import { getFinanceSetupStoreState, useFinanceSetupStore } from '../../store/financeSetupStore'

function unwrap<T>(res: { data: T }): T {
  return res.data
}

export function resolveLegalEntityId(explicit?: string): string {
  if (explicit) return explicit
  const store = getFinanceSetupStoreState()
  if (store.selectedLegalEntityId) return store.selectedLegalEntityId
  const defaultEntity = store.legalEntities.find((e) => e.isDefault && e.isActive)
  if (defaultEntity) return defaultEntity.id
  const first = store.legalEntities[0]
  if (first) return first.id
  throw new Error('No legal entity selected')
}

/**
 * API-mode safe LE resolver: validates persisted selection against live
 * `/accounting/legal-entities` (ignores stale demo UUIDs in fos-finance-setup-demo).
 * Demo mode keeps the sync store resolver.
 */
export async function ensureLegalEntity(explicit?: string): Promise<LegalEntity> {
  if (!isApiMode()) {
    const id = resolveLegalEntityId(explicit)
    const found = getFinanceSetupStoreState().legalEntities.find((e) => e.id === id)
    if (!found) throw new Error('No legal entity selected')
    return found
  }

  const entities = await listLegalEntities()
  if (entities.length === 0) {
    throw new Error(
      'No legal entity available. Create one under Accounting → Setup → Legal Entities, then retry.',
    )
  }

  const store = useFinanceSetupStore.getState()
  // Prefer explicit → persisted selection → default → first active.
  // Stale demo/localStorage UUIDs that are absent from the live tenant are ignored.
  let preferred =
    (explicit ? entities.find((e) => e.id === explicit) : undefined) ??
    (store.selectedLegalEntityId
      ? entities.find((e) => e.id === store.selectedLegalEntityId)
      : undefined) ??
    entities.find((e) => e.isDefault && e.isActive) ??
    entities.find((e) => e.isActive) ??
    entities[0]

  if (store.selectedLegalEntityId !== preferred.id) {
    store.setSelectedLegalEntityId(preferred.id)
  }
  return preferred
}

export async function ensureLegalEntityId(explicit?: string): Promise<string> {
  if (!isApiMode()) return resolveLegalEntityId(explicit)
  return (await ensureLegalEntity(explicit)).id
}

export async function listLegalEntities(): Promise<LegalEntity[]> {
  if (isApiMode()) return unwrap(await api.listLegalEntities())
  return getFinanceSetupStoreState().listLegalEntities()
}

export async function createLegalEntity(data: Record<string, unknown>): Promise<LegalEntity> {
  if (isApiMode()) return unwrap(await api.createLegalEntity(data))
  return getFinanceSetupStoreState().createLegalEntity(data as Parameters<ReturnType<typeof getFinanceSetupStoreState>['createLegalEntity']>[0])
}

export async function updateLegalEntity(id: string, data: Record<string, unknown>): Promise<LegalEntity> {
  if (isApiMode()) return unwrap(await api.updateLegalEntity(id, data))
  return getFinanceSetupStoreState().updateLegalEntity(id, data as Partial<LegalEntity>)
}

export async function setDefaultLegalEntity(id: string): Promise<LegalEntity> {
  if (isApiMode()) return unwrap(await api.setDefaultLegalEntity(id))
  return getFinanceSetupStoreState().setDefaultLegalEntity(id)
}

export async function activateLegalEntity(id: string): Promise<LegalEntity> {
  if (isApiMode()) return unwrap(await api.activateLegalEntity(id))
  return getFinanceSetupStoreState().activateLegalEntity(id)
}

export async function deactivateLegalEntity(id: string): Promise<LegalEntity> {
  if (isApiMode()) return unwrap(await api.deactivateLegalEntity(id))
  return getFinanceSetupStoreState().deactivateLegalEntity(id)
}

export async function listBranches(legalEntityId?: string): Promise<Branch[]> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) return unwrap(await api.listBranches(leId))
  return getFinanceSetupStoreState().listBranches(leId)
}

export async function createBranch(data: Record<string, unknown>, legalEntityId?: string): Promise<Branch> {
  const leId = await ensureLegalEntityId((data.legalEntityId as string) ?? legalEntityId)
  if (isApiMode()) return unwrap(await api.createBranch(leId, data))
  return getFinanceSetupStoreState().createBranch(leId, data as Partial<Branch>)
}

export async function updateBranch(id: string, data: Record<string, unknown>): Promise<Branch> {
  if (isApiMode()) return unwrap(await api.updateBranch(id, data))
  return getFinanceSetupStoreState().updateBranch(id, data as Partial<Branch>)
}

export async function setDefaultBranch(id: string): Promise<Branch> {
  if (isApiMode()) return unwrap(await api.setDefaultBranch(id))
  return getFinanceSetupStoreState().setDefaultBranch(id)
}

export async function activateBranch(id: string): Promise<Branch> {
  if (isApiMode()) return unwrap(await api.activateBranch(id))
  return getFinanceSetupStoreState().activateBranch(id)
}

export async function deactivateBranch(id: string): Promise<Branch> {
  if (isApiMode()) return unwrap(await api.deactivateBranch(id))
  return getFinanceSetupStoreState().deactivateBranch(id)
}

export async function listFinancialYears(legalEntityId?: string): Promise<FinancialYear[]> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) return unwrap(await api.listFinancialYears(leId))
  return getFinanceSetupStoreState().listFinancialYears(leId)
}

export async function createFinancialYear(data: Record<string, unknown>): Promise<FinancialYear> {
  if (isApiMode()) return unwrap(await api.createFinancialYear(data))
  return getFinanceSetupStoreState().createFinancialYear(data as Omit<FinancialYear, 'id' | 'status' | 'isCurrent'>)
}

export async function updateFinancialYear(id: string, data: Record<string, unknown>): Promise<FinancialYear> {
  if (isApiMode()) return unwrap(await api.updateFinancialYear(id, data))
  return getFinanceSetupStoreState().updateFinancialYear(id, data as Partial<FinancialYear>)
}

export async function activateFinancialYear(id: string): Promise<FinancialYear> {
  if (isApiMode()) return unwrap(await api.activateFinancialYear(id))
  return getFinanceSetupStoreState().activateFinancialYear(id)
}

export async function closeFinancialYear(id: string): Promise<FinancialYear> {
  if (isApiMode()) return unwrap(await api.closeFinancialYear(id))
  return getFinanceSetupStoreState().closeFinancialYear(id)
}

export async function previewYearEndClose(financialYearId: string) {
  if (!isApiMode()) throw new Error('Year-end preview requires API mode')
  return unwrap(await api.previewYearEndClose(financialYearId))
}

export async function executeYearEndClose(financialYearId: string) {
  if (!isApiMode()) throw new Error('Year-end close requires API mode')
  return unwrap(await api.executeYearEndClose(financialYearId))
}

export async function listPeriodAdjustments(
  params?: Parameters<typeof api.listPeriodAdjustments>[0],
): Promise<api.PeriodAdjustmentDto[]> {
  if (!isApiMode()) throw new Error('Period adjustments require API mode')
  return unwrap(await api.listPeriodAdjustments(params))
}

export async function getPeriodAdjustment(id: string): Promise<api.PeriodAdjustmentDto> {
  if (!isApiMode()) throw new Error('Period adjustments require API mode')
  return unwrap(await api.getPeriodAdjustment(id))
}

export async function createPeriodAdjustment(body: Record<string, unknown>): Promise<api.PeriodAdjustmentDto> {
  if (!isApiMode()) throw new Error('Period adjustments require API mode')
  return unwrap(await api.createPeriodAdjustment(body))
}

export async function markPeriodAdjustmentReady(id: string): Promise<api.PeriodAdjustmentDto> {
  if (!isApiMode()) throw new Error('Period adjustments require API mode')
  return unwrap(await api.markPeriodAdjustmentReady(id))
}

export async function postPeriodAdjustment(id: string): Promise<api.PeriodAdjustmentDto> {
  if (!isApiMode()) throw new Error('Period adjustments require API mode')
  return unwrap(await api.postPeriodAdjustment(id))
}

export async function reversePeriodAdjustment(
  id: string,
  body: { reason: string; reversalDate?: string },
): Promise<api.PeriodAdjustmentDto> {
  if (!isApiMode()) throw new Error('Period adjustments require API mode')
  return unwrap(await api.reversePeriodAdjustment(id, body))
}

export async function cancelPeriodAdjustment(id: string, reason: string): Promise<api.PeriodAdjustmentDto> {
  if (!isApiMode()) throw new Error('Period adjustments require API mode')
  return unwrap(await api.cancelPeriodAdjustment(id, reason))
}

export async function recognisePrepaidSchedule(id: string, scheduleId: string): Promise<api.PeriodAdjustmentDto> {
  if (!isApiMode()) throw new Error('Period adjustments require API mode')
  return unwrap(await api.recognisePrepaidSchedule(id, scheduleId))
}

export async function listPeriodCloseCalendarEvents(periodId: string): Promise<api.PeriodCloseCalendarEventApi[]> {
  if (!isApiMode()) throw new Error('Period close calendar requires API mode')
  return unwrap(await api.listPeriodCloseCalendarEvents(periodId))
}

export async function generatePeriodCloseCalendar(periodId: string): Promise<api.PeriodCloseCalendarEventApi[]> {
  if (!isApiMode()) throw new Error('Period close calendar requires API mode')
  return unwrap(await api.generatePeriodCloseCalendar(periodId))
}

export async function listPeriodCloseTemplates(legalEntityId: string): Promise<api.PeriodCloseChecklistTemplateApi[]> {
  if (!isApiMode()) throw new Error('Period close templates require API mode')
  return unwrap(await api.listPeriodCloseTemplates(legalEntityId))
}

export async function listPeriodReopenRequests(
  params?: Parameters<typeof api.listPeriodReopenRequests>[0],
): Promise<api.PeriodReopenRequestApi[]> {
  if (!isApiMode()) throw new Error('Period reopen requests require API mode')
  return unwrap(await api.listPeriodReopenRequests(params))
}

export async function createPeriodReopenRequest(body: Record<string, unknown>): Promise<api.PeriodReopenRequestApi> {
  if (!isApiMode()) throw new Error('Period reopen requests require API mode')
  return unwrap(await api.createPeriodReopenRequest(body))
}

export async function approvePeriodReopenRequest(
  id: string,
  body?: { note?: string; activate?: boolean },
): Promise<api.PeriodReopenRequestApi> {
  if (!isApiMode()) throw new Error('Period reopen requests require API mode')
  return unwrap(await api.approvePeriodReopenRequest(id, body))
}

export async function rejectPeriodReopenRequest(id: string, reason: string): Promise<api.PeriodReopenRequestApi> {
  if (!isApiMode()) throw new Error('Period reopen requests require API mode')
  return unwrap(await api.rejectPeriodReopenRequest(id, reason))
}

export async function getFxRevaluationRun(periodId: string): Promise<api.FxRevaluationRunApi | null> {
  if (!isApiMode()) throw new Error('FX revaluation requires API mode')
  return unwrap(await api.getFxRevaluationRun(periodId))
}

export async function previewFxRevaluation(periodId: string): Promise<api.FxRevaluationRunApi> {
  if (!isApiMode()) throw new Error('FX revaluation requires API mode')
  return unwrap(await api.previewFxRevaluation(periodId))
}

export async function postFxRevaluation(runId: string): Promise<api.FxRevaluationRunApi> {
  if (!isApiMode()) throw new Error('FX revaluation requires API mode')
  return unwrap(await api.postFxRevaluation(runId))
}

export async function reverseFxRevaluation(
  runId: string,
  body: { reason: string; reversalDate?: string },
): Promise<api.FxRevaluationRunApi> {
  if (!isApiMode()) throw new Error('FX revaluation requires API mode')
  return unwrap(await api.reverseFxRevaluation(runId, body))
}

export async function upsertFxRate(body: {
  legalEntityId: string
  currencyCode: string
  asOfDate: string
  rate: string | number
  notes?: string
}): Promise<api.FxExchangeRateApi> {
  if (!isApiMode()) throw new Error('FX rates require API mode')
  return unwrap(await api.upsertFxRate(body))
}

export async function listPeriods(legalEntityId?: string, financialYearId?: string): Promise<AccountingPeriod[]> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) {
    return unwrap(
      await api.listPeriods(leId, {
        ...(financialYearId ? { financialYearId } : {}),
        limit: 100,
      }),
    )
  }
  return getFinanceSetupStoreState().listPeriods(leId, financialYearId)
}

export async function generatePeriods(financialYearId: string, legalEntityId?: string): Promise<AccountingPeriod[]> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) return unwrap(await api.generatePeriods({ legalEntityId: leId, financialYearId }))
  return getFinanceSetupStoreState().generatePeriods(leId, financialYearId)
}

export async function updatePeriod(id: string, data: Record<string, unknown>): Promise<AccountingPeriod> {
  if (isApiMode()) return unwrap(await api.updatePeriod(id, data))
  return getFinanceSetupStoreState().updatePeriod(id, data as Partial<AccountingPeriod>)
}

export async function markPeriodUnderReview(id: string): Promise<AccountingPeriod> {
  if (isApiMode()) return unwrap(await api.markPeriodUnderReview(id))
  return getFinanceSetupStoreState().markPeriodUnderReview(id)
}

export async function closePeriod(id: string): Promise<AccountingPeriod> {
  if (isApiMode()) return unwrap(await api.closePeriod(id))
  return getFinanceSetupStoreState().closePeriod(id)
}

export async function reopenPeriod(id: string, reason: string): Promise<AccountingPeriod> {
  if (isApiMode()) return unwrap(await api.reopenPeriod(id, reason))
  return getFinanceSetupStoreState().reopenPeriod(id, reason)
}

export async function listAccounts(legalEntityId?: string): Promise<Account[]> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) return unwrap(await api.listAccounts(leId))
  return getFinanceSetupStoreState().listAccounts(leId)
}

export async function getAccountTree(legalEntityId?: string, includeInactive = false): Promise<AccountTreeNode[]> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) return unwrap(await api.getAccountTree(leId, includeInactive))
  return getFinanceSetupStoreState().getAccountTree(leId, includeInactive)
}

export async function createAccount(data: Record<string, unknown>): Promise<Account> {
  if (isApiMode()) return unwrap(await api.createAccount(data))
  return getFinanceSetupStoreState().createAccount(data as Omit<Account, 'id'>)
}

export async function updateAccount(id: string, data: Record<string, unknown>): Promise<Account> {
  if (isApiMode()) return unwrap(await api.updateAccount(id, data))
  return getFinanceSetupStoreState().updateAccount(id, data as Partial<Account>)
}

export async function activateAccount(id: string): Promise<Account> {
  if (isApiMode()) return unwrap(await api.activateAccount(id))
  return getFinanceSetupStoreState().activateAccount(id)
}

export async function deactivateAccount(id: string): Promise<Account> {
  if (isApiMode()) return unwrap(await api.deactivateAccount(id))
  return getFinanceSetupStoreState().deactivateAccount(id)
}

export async function applyCoaTemplate(templateId: CoaTemplateId, legalEntityId?: string): Promise<{ applied: number }> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) return unwrap(await api.applyCoaTemplate(leId, templateId))
  return getFinanceSetupStoreState().applyCoaTemplate(leId, templateId)
}

export async function getDefaultMappings(legalEntityId?: string): Promise<DefaultAccountMapping[]> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) return unwrap(await api.getDefaultMappings(leId))
  return getFinanceSetupStoreState().getDefaultMappings(leId)
}

export async function saveDefaultMappings(
  mappings: Array<{ mappingKey: string; accountId: string; isMandatory?: boolean; description?: string }>,
  legalEntityId?: string,
): Promise<DefaultAccountMapping[]> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) return unwrap(await api.saveDefaultMappings({ legalEntityId: leId, mappings }))
  return getFinanceSetupStoreState().saveDefaultMappings(
    leId,
    mappings as Array<{ mappingKey: DefaultAccountMapping['mappingKey']; accountId: string }>,
  )
}

export async function validateDefaultMappings(legalEntityId?: string): Promise<DefaultMappingValidationResult> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) return unwrap(await api.validateDefaultMappings(leId))
  return getFinanceSetupStoreState().validateDefaultMappings(leId)
}

export async function getFinanceSettings(legalEntityId?: string): Promise<FinanceSettings> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) return unwrap(await api.getFinanceSettings(leId))
  return getFinanceSetupStoreState().getFinanceSettings(leId)
}

export async function saveFinanceSettings(data: Record<string, unknown>, legalEntityId?: string): Promise<FinanceSettings> {
  const leId = await ensureLegalEntityId((data.legalEntityId as string) ?? legalEntityId)
  if (isApiMode()) return unwrap(await api.saveFinanceSettings({ ...data, legalEntityId: leId }))
  return getFinanceSetupStoreState().saveFinanceSettings(leId, data as Partial<FinanceSettings>)
}

export async function getSetupStatus(legalEntityId?: string): Promise<SetupStatus> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) return unwrap(await api.getSetupStatus(leId))
  return getFinanceSetupStoreState().getSetupStatus(leId)
}

export async function activateFinance(legalEntityId?: string): Promise<FinanceSettings> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) return unwrap(await api.activateFinance(leId))
  return getFinanceSetupStoreState().activateFinance(leId)
}

export async function listCostCentres(legalEntityId?: string): Promise<CostCentre[]> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) return unwrap(await api.listCostCentres(leId))
  return getFinanceSetupStoreState().listCostCentres(leId)
}

export async function getCostCentreTree(legalEntityId?: string): Promise<CostCentreTreeNode[]> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) return unwrap(await api.getCostCentreTree(leId))
  return getFinanceSetupStoreState().getCostCentreTree(leId)
}

export async function createCostCentre(data: Record<string, unknown>): Promise<CostCentre> {
  if (isApiMode()) return unwrap(await api.createCostCentre(data))
  return getFinanceSetupStoreState().createCostCentre(data as Omit<CostCentre, 'id'>)
}

export async function updateCostCentre(id: string, data: Record<string, unknown>): Promise<CostCentre> {
  if (isApiMode()) return unwrap(await api.updateCostCentre(id, data))
  return getFinanceSetupStoreState().updateCostCentre(id, data as Partial<CostCentre>)
}

export async function activateCostCentre(id: string): Promise<CostCentre> {
  if (isApiMode()) return unwrap(await api.activateCostCentre(id))
  return getFinanceSetupStoreState().activateCostCentre(id)
}

export async function deactivateCostCentre(id: string): Promise<CostCentre> {
  if (isApiMode()) return unwrap(await api.deactivateCostCentre(id))
  return getFinanceSetupStoreState().deactivateCostCentre(id)
}

export async function listNumberSeries(legalEntityId?: string): Promise<FinanceNumberSeries[]> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) return unwrap(await api.listNumberSeries(leId))
  return getFinanceSetupStoreState().listNumberSeries(leId)
}

export async function upsertNumberSeries(data: Record<string, unknown>): Promise<FinanceNumberSeries> {
  if (isApiMode()) return unwrap(await api.upsertNumberSeries(data))
  return getFinanceSetupStoreState().upsertNumberSeries(data as Parameters<ReturnType<typeof getFinanceSetupStoreState>['upsertNumberSeries']>[0])
}

export async function listApprovalRules(legalEntityId?: string): Promise<FinanceApprovalRule[]> {
  const leId = await ensureLegalEntityId(legalEntityId)
  if (isApiMode()) return unwrap(await api.listApprovalRules(leId))
  return getFinanceSetupStoreState().listApprovalRules(leId)
}

export async function createApprovalRule(data: Record<string, unknown>): Promise<FinanceApprovalRule> {
  if (isApiMode()) return unwrap(await api.createApprovalRule(data))
  return getFinanceSetupStoreState().createApprovalRule(data as Omit<FinanceApprovalRule, 'id'>)
}

export async function updateApprovalRule(id: string, data: Record<string, unknown>): Promise<FinanceApprovalRule> {
  if (isApiMode()) return unwrap(await api.updateApprovalRule(id, data))
  return getFinanceSetupStoreState().updateApprovalRule(id, data as Partial<FinanceApprovalRule>)
}

export { useFinanceSetupStore }
