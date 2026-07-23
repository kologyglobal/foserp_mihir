/**
 * Period Close service — dual-mode.
 * Demo (`VITE_USE_API=false`): in-memory mock seed (no GL enforcement).
 * API (`VITE_USE_API=true`): real AccountingPeriod close/reopen + FE-composed readiness.
 */

import { isApiMode } from '@/config/apiConfig'
import {
  DEFAULT_PERIOD_FILTER,
  PERIOD_CLOSE_SETUP,
  SEED_ACCRUALS,
  SEED_BANK,
  SEED_CALENDAR,
  SEED_CLOSE_TASKS,
  SEED_FIXED_ASSETS,
  SEED_FX,
  SEED_GST_TDS,
  SEED_INVENTORY,
  SEED_LOCKS,
  SEED_MANUFACTURING,
  SEED_PREPAID,
  SEED_RECONCILIATIONS,
  SEED_REOPEN,
  SEED_REPORTS,
  SEED_TRIAL_BALANCE,
  SEED_YEAR_END,
  buildCloseDashboard,
} from '@/data/accounting/periodCloseSeed'
import {
  apiClosePeriod,
  apiListChecklistAcks,
  apiMarkPeriodUnderReview,
  apiReopenPeriod,
  apiUpsertChecklistAcks,
  buildApiCloseDashboard,
  buildApiCloseTasks,
  composePeriodCloseReadiness,
  listApiPeriodsForLocking,
  loadApiModuleLocks,
  loadApiPeriodCloseSetup,
  resolveApiPeriodFilter,
} from '@/services/accounting/periodCloseApiComposer'
import {
  fetchInventoryAccountingEvents,
  fetchInventoryAccountingGate,
} from '@/services/api/inventoryAccountingApi'
import {
  getAccountingWorkspaceSummary,
  listAccountingWorkspaceReconciliation,
} from '@/services/api/manufacturingCostingApi'
import type { AccountingPeriod } from '@/types/financeSetup'
import type {
  AccrualEntry,
  CloseCalendarEvent,
  CloseDashboardData,
  CloseReportDef,
  CloseTask,
  CloseTaskStatus,
  FxRevaluationLine,
  ModuleLockStatus,
  ModulePeriodLock,
  PeriodCloseChecklistAck,
  PeriodCloseReadiness,
  PeriodCloseSetup,
  PeriodFilterState,
  PrepaidExpense,
  PrepaidStatus,
  ReopenRequest,
  ReopenRequestStatus,
  SubledgerReconciliation,
  TrialBalanceLine,
  YearEndPreview,
} from '@/types/periodClose'

const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms))

let tasks = SEED_CLOSE_TASKS.map((t) => ({ ...t }))
let recons = SEED_RECONCILIATIONS.map((r) => ({ ...r }))
let accruals = SEED_ACCRUALS.map((a) => ({ ...a }))
let prepaid = SEED_PREPAID.map((p) => ({ ...p }))
let locks = SEED_LOCKS.map((l) => ({ ...l }))
let reopenRequests = SEED_REOPEN.map((r) => ({
  ...r,
  audit: r.audit.map((a) => ({ ...a })),
}))

let periodFilter: PeriodFilterState = { ...DEFAULT_PERIOD_FILTER }

export function loadPeriodCloseFilter(): PeriodFilterState {
  return { ...periodFilter }
}

export function savePeriodCloseFilter(next: PeriodFilterState): void {
  periodFilter = { ...next }
}

export async function getPeriodCloseSetup(): Promise<PeriodCloseSetup> {
  if (isApiMode()) return loadApiPeriodCloseSetup()
  await delay()
  return PERIOD_CLOSE_SETUP
}

export async function getCloseDashboard(filter?: PeriodFilterState): Promise<CloseDashboardData> {
  if (isApiMode()) {
    const resolved = await resolveApiPeriodFilter(filter ?? periodFilter)
    savePeriodCloseFilter(resolved.filter)
    return buildApiCloseDashboard(resolved.filter)
  }
  await delay()
  const f = filter ?? periodFilter
  return buildCloseDashboard(f.periodCode)
}

export async function getPeriodCloseReadiness(filter?: PeriodFilterState): Promise<PeriodCloseReadiness | null> {
  if (!isApiMode()) return null
  const resolved = await resolveApiPeriodFilter(filter ?? periodFilter)
  savePeriodCloseFilter(resolved.filter)
  return composePeriodCloseReadiness(resolved.filter)
}

export async function getCloseCalendar(periodCode?: string): Promise<CloseCalendarEvent[]> {
  if (isApiMode()) {
    // Phase 2 — calendar remains demo-only scaffolding in API mode
    return []
  }
  await delay()
  const code = periodCode ?? periodFilter.periodCode
  return SEED_CALENDAR.filter((e) => e.periodCode === code)
}

export async function getCloseTasks(periodCode?: string): Promise<CloseTask[]> {
  if (isApiMode()) {
    return buildApiCloseTasks(
      periodCode
        ? { ...periodFilter, periodCode }
        : periodFilter,
    )
  }
  await delay()
  const code = periodCode ?? periodFilter.periodCode
  return tasks.filter((t) => t.periodCode === code).map((t) => ({ ...t }))
}

export async function updateCloseTaskStatus(
  taskId: string,
  status: CloseTaskStatus,
  completionPct?: number,
): Promise<CloseTask> {
  if (isApiMode()) {
    throw new Error(
      'API-mode readiness checklist is computed from finance data. Resolve the underlying issue (journals, AP close gate, bank recon) instead of marking tasks manually.',
    )
  }
  await delay()
  const idx = tasks.findIndex((t) => t.id === taskId)
  if (idx < 0) throw new Error('Task not found')
  const pct =
    completionPct ??
    (status === 'completed' || status === 'not_applicable'
      ? 100
      : status === 'not_started'
        ? 0
        : tasks[idx].completionPct)
  tasks[idx] = { ...tasks[idx], status, completionPct: pct }
  return { ...tasks[idx] }
}

export async function getSubledgerReconciliations(periodCode?: string): Promise<SubledgerReconciliation[]> {
  if (isApiMode()) return []
  await delay()
  const code = periodCode ?? periodFilter.periodCode
  return recons.filter((r) => r.periodCode === code).map((r) => ({ ...r }))
}

export async function markReconciliationReviewed(id: string, note?: string): Promise<SubledgerReconciliation> {
  if (isApiMode()) throw new Error('Subledger reconciliation workbench is demo-only in Phase 1. Use Money Out AP reconciliation.')
  await delay()
  const idx = recons.findIndex((r) => r.id === id)
  if (idx < 0) throw new Error('Reconciliation not found')
  if (Math.abs(recons[idx].difference) > 0.5) {
    throw new Error('Cannot mark reviewed while a difference remains. Resolve supporting entries first.')
  }
  recons[idx] = {
    ...recons[idx],
    status: 'reviewed',
    lastReconciled: new Date().toISOString().slice(0, 10),
    notes: note ?? recons[idx].notes,
  }
  return { ...recons[idx] }
}

export async function addReconciliationNote(id: string, note: string): Promise<SubledgerReconciliation> {
  if (isApiMode()) throw new Error('Subledger reconciliation workbench is demo-only in Phase 1.')
  await delay()
  const idx = recons.findIndex((r) => r.id === id)
  if (idx < 0) throw new Error('Reconciliation not found')
  recons[idx] = { ...recons[idx], notes: note }
  return { ...recons[idx] }
}

export async function getInventoryCloseSummary() {
  if (isApiMode()) {
    try {
      const [gateRes, recordedRes, failedRes, adjRes] = await Promise.all([
        fetchInventoryAccountingGate().catch(() => null),
        fetchInventoryAccountingEvents({ status: 'RECORDED', limit: 1 }).catch(() => null),
        fetchInventoryAccountingEvents({ status: 'FAILED', limit: 1 }).catch(() => null),
        fetchInventoryAccountingEvents({ eventType: 'STOCK_ADJUSTMENT', status: 'RECORDED', limit: 1 }).catch(
          () => null,
        ),
      ])
      const unposted = recordedRes?.meta?.total ?? recordedRes?.data?.length ?? 0
      const failed = failedRes?.meta?.total ?? failedRes?.data?.length ?? 0
      const pendingAdj = adjRes?.meta?.total ?? adjRes?.data?.length ?? 0
      const enabled = Boolean(gateRes?.data?.enabled)
      return {
        inventoryValue: 0,
        negativeStockItems: 0,
        unpostedMovements: unposted,
        pendingTransfers: 0,
        pendingAdjustments: pendingAdj,
        itemLedgerVsGlDiff: 0,
        costAdjustmentStatus: enabled
          ? failed > 0
            ? `${failed} failed inventory GL event(s)`
            : unposted > 0
              ? `${unposted} unposted inventory GL event(s)`
              : 'Inventory GL events clear'
          : 'INVENTORY_ACCOUNTING flag off — events recorded only',
      }
    } catch {
      return {
        ...SEED_INVENTORY,
        costAdjustmentStatus: 'Unable to load live inventory accounting — check API',
      }
    }
  }
  await delay()
  return { ...SEED_INVENTORY }
}

export async function getManufacturingCloseSummary() {
  if (isApiMode()) {
    try {
      const [summaryRes, reconRes] = await Promise.all([
        getAccountingWorkspaceSummary(),
        listAccountingWorkspaceReconciliation().catch(() => null),
      ])
      const s = summaryRes.data
      const recon = reconRes?.data ?? []
      const varianceDiff = recon
        .filter((r) => r.status === 'DIFFERENCE' || r.status === 'BLOCKED')
        .reduce((sum, r) => sum + Math.abs(Number(r.difference ?? 0)), 0)
      return {
        openProductionOrders: s.workOrdersReadyToClose + s.provisionalCount,
        completedUnclosedOrders: s.workOrdersReadyToClose,
        wipValue: Number(s.wipValue ?? 0),
        unpostedConsumption: s.unpostedCount,
        missingLabourBooking: s.provisionalCount,
        missingMachineBooking: s.failedCount,
        unallocatedOverhead: 0,
        productionVariance: varianceDiff,
        scrapVariance: 0,
      }
    } catch {
      return {
        openProductionOrders: 0,
        completedUnclosedOrders: 0,
        wipValue: 0,
        unpostedConsumption: 0,
        missingLabourBooking: 0,
        missingMachineBooking: 0,
        unallocatedOverhead: 0,
        productionVariance: 0,
        scrapVariance: 0,
      }
    }
  }
  await delay()
  return { ...SEED_MANUFACTURING }
}

export async function getFixedAssetCloseSummary() {
  await delay()
  return { ...SEED_FIXED_ASSETS }
}

export async function getBankCloseSummary() {
  if (isApiMode()) {
    try {
      const readiness = await composePeriodCloseReadiness(periodFilter)
      const bank = readiness.checks.find((c) => c.code === 'BANK_RECON')
      const open = readiness.openBankReconCount ?? bank?.count ?? 0
      return {
        accountsPendingRecon: open,
        cashCountsPending: 0,
        chequesInTransit: 0,
        unidentifiedTransactions: 0,
        bankVsGlDiff: 0,
        statusMessage: bank?.message ?? 'Bank recon status loaded from close readiness.',
      }
    } catch {
      return {
        ...SEED_BANK,
        statusMessage: 'Unable to load live bank recon — check API',
      }
    }
  }
  await delay()
  return { ...SEED_BANK }
}

export async function listCloseChecklistAcks(periodId?: string): Promise<PeriodCloseChecklistAck[]> {
  if (!isApiMode()) return []
  const resolved = await resolveApiPeriodFilter(
    periodId ? { ...periodFilter, periodId } : periodFilter,
  )
  return apiListChecklistAcks(resolved.period.id)
}

export async function saveCloseChecklistAcks(
  items: Array<{ checkKey: string; status: 'ACK' | 'NA'; note?: string | null }>,
  periodId?: string,
): Promise<PeriodCloseChecklistAck[]> {
  if (!isApiMode()) throw new Error('Checklist acks are API-mode only.')
  const resolved = await resolveApiPeriodFilter(
    periodId ? { ...periodFilter, periodId } : periodFilter,
  )
  return apiUpsertChecklistAcks(resolved.period.id, items)
}

export async function getGstTdsCloseSummary() {
  await delay()
  return { ...SEED_GST_TDS }
}

export async function getAccruals(): Promise<AccrualEntry[]> {
  await delay()
  return accruals.map((a) => ({ ...a }))
}

export async function getAccrualById(id: string): Promise<AccrualEntry | null> {
  await delay()
  return accruals.find((a) => a.id === id) ?? null
}

export async function previewAccrualPosting(id: string): Promise<AccrualEntry> {
  await delay()
  const idx = accruals.findIndex((a) => a.id === id)
  if (idx < 0) throw new Error('Accrual not found')
  accruals[idx] = { ...accruals[idx], status: 'previewed' }
  return { ...accruals[idx] }
}

export async function getPrepaidExpenses(): Promise<PrepaidExpense[]> {
  await delay()
  return prepaid.map((p) => ({ ...p }))
}

export async function updatePrepaidStatus(id: string, status: PrepaidStatus): Promise<PrepaidExpense> {
  await delay()
  const idx = prepaid.findIndex((p) => p.id === id)
  if (idx < 0) throw new Error('Prepaid expense not found')
  prepaid[idx] = { ...prepaid[idx], status }
  return { ...prepaid[idx] }
}

export async function getFxRevaluation(): Promise<{
  lines: FxRevaluationLine[]
  totalGain: number
  totalLoss: number
  exchangeGainAccount: string
  exchangeLossAccount: string
  reversalPeriod: string
}> {
  await delay()
  const lines = SEED_FX.map((l) => ({ ...l }))
  const totalGain = lines.filter((l) => l.gainLoss > 0).reduce((s, l) => s + l.gainLoss, 0)
  const totalLoss = lines.filter((l) => l.gainLoss < 0).reduce((s, l) => s + Math.abs(l.gainLoss), 0)
  return {
    lines,
    totalGain,
    totalLoss,
    exchangeGainAccount: '4810 Foreign Exchange Gain',
    exchangeLossAccount: '5810 Foreign Exchange Loss',
    reversalPeriod: '2026-08',
  }
}

export async function getTrialBalanceReview(): Promise<TrialBalanceLine[]> {
  await delay()
  return SEED_TRIAL_BALANCE.map((l) => ({ ...l }))
}

export async function getModuleLocks(): Promise<ModulePeriodLock[]> {
  if (isApiMode()) return loadApiModuleLocks(periodFilter)
  await delay()
  return locks.map((l) => ({ ...l }))
}

export async function listPeriodClosePeriods(): Promise<AccountingPeriod[]> {
  if (isApiMode()) return listApiPeriodsForLocking(periodFilter)
  await delay()
  return []
}

export async function closeAccountingPeriod(periodId: string): Promise<AccountingPeriod> {
  return apiClosePeriod(periodId)
}

export async function reopenAccountingPeriod(periodId: string, reason: string): Promise<AccountingPeriod> {
  return apiReopenPeriod(periodId, reason)
}

export async function markAccountingPeriodUnderReview(periodId: string): Promise<AccountingPeriod> {
  return apiMarkPeriodUnderReview(periodId)
}

export async function updateModuleLock(
  id: string,
  status: ModuleLockStatus,
  lockedBy: string,
  overrideReason?: string,
): Promise<ModulePeriodLock> {
  if (isApiMode()) {
    throw new Error(
      'Use Close / Under Review / Reopen on the accounting period (finance.period.*) instead of module soft/hard locks.',
    )
  }
  await delay()
  const idx = locks.findIndex((l) => l.id === id)
  if (idx < 0) throw new Error('Module lock not found')
  if (status === 'soft_locked' && !overrideReason && locks[idx].status === 'hard_locked') {
    throw new Error('Override reason required when changing hard lock')
  }
  locks[idx] = {
    ...locks[idx],
    status,
    lockedBy,
    lockedDate: new Date().toISOString().slice(0, 10),
  }
  return { ...locks[idx] }
}

export async function getReopenRequests(): Promise<ReopenRequest[]> {
  if (isApiMode()) return []
  await delay()
  return reopenRequests.map((r) => ({ ...r, audit: r.audit.map((a) => ({ ...a })) }))
}

export async function submitReopenRequest(
  input: Omit<ReopenRequest, 'id' | 'status' | 'audit'>,
): Promise<ReopenRequest> {
  if (isApiMode()) {
    throw new Error('Reopen request workflow is Phase 2. Use Period Locking → Reopen with a reason (finance.period.reopen).')
  }
  await delay()
  const row: ReopenRequest = {
    ...input,
    id: `rr-${String(reopenRequests.length + 1).padStart(3, '0')}`,
    status: 'pending_approval',
    audit: [
      {
        at: new Date().toISOString(),
        by: input.requestedBy,
        action: 'Submitted',
      },
    ],
  }
  reopenRequests = [row, ...reopenRequests]
  return { ...row, audit: [...row.audit] }
}

export async function updateReopenStatus(
  id: string,
  status: ReopenRequestStatus,
  by: string,
  note?: string,
): Promise<ReopenRequest> {
  if (isApiMode()) throw new Error('Reopen request workflow is Phase 2.')
  await delay()
  const idx = reopenRequests.findIndex((r) => r.id === id)
  if (idx < 0) throw new Error('Reopen request not found')
  const audit = [
    ...reopenRequests[idx].audit,
    { at: new Date().toISOString(), by, action: status, note },
  ]
  reopenRequests[idx] = { ...reopenRequests[idx], status, audit }
  return { ...reopenRequests[idx], audit: [...audit] }
}

export async function getYearEndPreview(fiscalYear?: string): Promise<YearEndPreview> {
  await delay()
  return { ...SEED_YEAR_END, fiscalYear: fiscalYear ?? SEED_YEAR_END.fiscalYear }
}

export async function getCloseReports(): Promise<CloseReportDef[]> {
  await delay()
  return SEED_REPORTS.map((r) => ({ ...r }))
}

export async function exportCloseReportDemo(reportId: string): Promise<{ message: string }> {
  await delay(120)
  const report = SEED_REPORTS.find((r) => r.id === reportId)
  return {
    message: report
      ? `Placeholder export for “${report.name}” prepared in demo mode. No file was written to disk.`
      : 'Report not found.',
  }
}
