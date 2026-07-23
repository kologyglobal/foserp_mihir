/**
 * Period Close — API-mode composition via backend close-readiness aggregator.
 */

import {
  closePeriod as bridgeClosePeriod,
  ensureLegalEntity,
  listFinancialYears,
  listPeriods,
  markPeriodUnderReview as bridgeMarkUnderReview,
  reopenPeriod as bridgeReopenPeriod,
} from '@/services/bridges/financeApiBridge'
import {
  getPeriodCloseReadiness as fetchCloseReadiness,
  listPeriodCloseChecklistAcks,
  upsertPeriodCloseChecklistAcks,
  type PeriodCloseReadinessApi,
  type PeriodCloseReadinessApiCheck,
} from '@/services/api/financeApi'
import type { AccountingPeriod, FinancialYear, LegalEntity } from '@/types/financeSetup'
import type {
  CloseDashboardData,
  CloseTask,
  CloseTaskStatus,
  CloseWorkflowStage,
  ModulePeriodLock,
  PeriodCloseChecklistAck,
  PeriodCloseReadiness,
  PeriodCloseReadinessCheck,
  PeriodCloseReadinessCheckCode,
  PeriodCloseReadinessSeverity,
  PeriodCloseSetup,
  PeriodFilterState,
} from '@/types/periodClose'

function dateOnly(value: string): string {
  return value.slice(0, 10)
}

function periodCodeFromStart(startDate: string): string {
  return dateOnly(startDate).slice(0, 7)
}

export async function resolvePeriodCloseLegalEntity(): Promise<LegalEntity> {
  return ensureLegalEntity()
}

function pickCurrentFy(years: FinancialYear[]): FinancialYear | undefined {
  return years.find((y) => y.isCurrent && y.status === 'ACTIVE') ?? years.find((y) => y.status === 'ACTIVE') ?? years[0]
}

function pickFocusPeriod(periods: AccountingPeriod[]): AccountingPeriod | undefined {
  if (periods.length === 0) return undefined
  const openish = periods.find((p) => p.status === 'OPEN' || p.status === 'UNDER_REVIEW' || p.status === 'REOPENED')
  if (openish) return openish
  const today = new Date().toISOString().slice(0, 10)
  const containing = periods.find((p) => dateOnly(p.startDate) <= today && dateOnly(p.endDate) >= today)
  return containing ?? periods[periods.length - 1]
}

export async function loadApiPeriodCloseSetup(): Promise<PeriodCloseSetup> {
  const le = await resolvePeriodCloseLegalEntity()
  const years = await listFinancialYears(le.id)
  const currentFy = pickCurrentFy(years)
  const periods = currentFy ? await listPeriods(le.id, currentFy.id) : []

  return {
    companies: [{ id: le.id, name: le.displayName }],
    fiscalYears: years.map((y) => ({
      code: y.id,
      label: y.name,
      start: dateOnly(y.startDate),
      end: dateOnly(y.endDate),
    })),
    periods: periods.map((p) => ({
      code: periodCodeFromStart(p.startDate),
      label: p.name,
      fiscalYear: p.financialYearId,
      start: dateOnly(p.startDate),
      end: dateOnly(p.endDate),
      id: p.id,
    })),
    taskTemplates: [],
    lockPolicies: [
      { module: 'General Ledger', softLockDaysBefore: 0, hardLockOnClose: true },
      { module: 'Payables', softLockDaysBefore: 0, hardLockOnClose: true },
      { module: 'Bank and Cash', softLockDaysBefore: 0, hardLockOnClose: true },
    ],
    fxRates: [],
  }
}

export async function resolveApiPeriodFilter(filter?: PeriodFilterState): Promise<{
  le: LegalEntity
  fy: FinancialYear
  period: AccountingPeriod
  filter: PeriodFilterState
}> {
  const le = await resolvePeriodCloseLegalEntity()
  const years = await listFinancialYears(le.id)
  const fy =
    (filter?.fiscalYearId ? years.find((y) => y.id === filter.fiscalYearId) : undefined) ??
    (filter?.fiscalYear ? years.find((y) => y.id === filter.fiscalYear || y.name === filter.fiscalYear) : undefined) ??
    pickCurrentFy(years)
  if (!fy) throw new Error('No financial year found. Generate periods in Finance Settings first.')

  const periods = await listPeriods(le.id, fy.id)
  if (periods.length === 0) throw new Error('No accounting periods for the current financial year.')

  const period =
    (filter?.periodId ? periods.find((p) => p.id === filter.periodId) : undefined) ??
    (filter?.periodCode
      ? periods.find((p) => periodCodeFromStart(p.startDate) === filter.periodCode || p.id === filter.periodCode)
      : undefined) ??
    pickFocusPeriod(periods)

  if (!period) throw new Error('Accounting period not found.')

  const nextFilter: PeriodFilterState = {
    companyId: le.id,
    companyName: le.displayName,
    fiscalYear: fy.name,
    fiscalYearId: fy.id,
    periodCode: periodCodeFromStart(period.startDate),
    periodLabel: period.name,
    periodId: period.id,
  }

  return { le, fy, period, filter: nextFilter }
}

function workflowFromStatus(status: string): CloseWorkflowStage {
  switch (status) {
    case 'CLOSED':
      return 'period_locked'
    case 'UNDER_REVIEW':
      return 'finance_review'
    case 'REOPENED':
      return 'adjustment_posting'
    default:
      return 'close_preparation'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'OPEN':
      return 'Open'
    case 'UNDER_REVIEW':
      return 'Under Review'
    case 'CLOSED':
      return 'Closed (posting locked)'
    case 'REOPENED':
      return 'Reopened'
    default:
      return status
  }
}

function mapSeverity(sev: PeriodCloseReadinessApiCheck['severity']): PeriodCloseReadinessSeverity {
  switch (sev) {
    case 'PASS':
      return 'ok'
    case 'WARN':
      return 'warning'
    case 'BLOCK':
      return 'blocking'
    default:
      return 'info'
  }
}

function mapTaskStatus(check: PeriodCloseReadinessApiCheck, periodStatus: string): CloseTaskStatus {
  if (check.severity === 'PASS') return 'completed'
  if (check.severity === 'BLOCK') return 'blocked'
  if (check.key === 'PERIOD_STATUS' && periodStatus === 'UNDER_REVIEW') return 'ready_for_review'
  if (check.key === 'PERIOD_STATUS' && periodStatus === 'REOPENED') return 'reopened'
  return 'in_progress'
}

function mapCheck(check: PeriodCloseReadinessApiCheck, periodStatus: string): PeriodCloseReadinessCheck {
  return {
    code: check.key as PeriodCloseReadinessCheckCode,
    label: check.label,
    status: mapTaskStatus(check, periodStatus),
    severity: mapSeverity(check.severity),
    message: check.message,
    href: check.href,
    count: check.count,
    featureEnabled: check.featureEnabled,
  }
}

function mapApiReadiness(api: PeriodCloseReadinessApi, periodCode: string): PeriodCloseReadiness {
  const checks = api.checks.map((c) => mapCheck(c, api.periodStatus))
  const completed = checks.filter((c) => c.status === 'completed' || c.status === 'not_applicable').length
  return {
    periodId: api.periodId,
    periodCode,
    periodLabel: api.periodName,
    periodStatus: api.periodStatus,
    legalEntityId: api.legalEntityId,
    overallProgressPct: checks.length ? Math.round((completed / checks.length) * 100) : 0,
    blockingCount: api.blockingCount,
    warningCount: api.warningCount,
    unpostedJournalCount: api.unpostedJournalCount,
    openBankReconCount: api.openBankReconCount,
    checks,
    canCloseSoft: api.periodStatus !== 'CLOSED',
    hardBlockEnabled: api.hardBlockEnabled,
    canClose: api.canClose,
    blockers: api.blockers.map((c) => mapCheck(c, api.periodStatus)),
  }
}

export async function composePeriodCloseReadiness(filter?: PeriodFilterState): Promise<PeriodCloseReadiness> {
  const { period } = await resolveApiPeriodFilter(filter)
  const res = await fetchCloseReadiness(period.id)
  if (!res.data) throw new Error(res.message || 'Failed to load close readiness')
  return mapApiReadiness(res.data, periodCodeFromStart(period.startDate))
}

export async function buildApiCloseDashboard(filter?: PeriodFilterState): Promise<CloseDashboardData> {
  const readiness = await composePeriodCloseReadiness(filter)
  const { period } = await resolveApiPeriodFilter(filter)
  const completed = readiness.checks.filter((c) => c.status === 'completed' || c.status === 'not_applicable').length
  const pending = readiness.checks.length - completed
  const hardNote = readiness.hardBlockEnabled
    ? 'Hard-block close is ON — blockers must be cleared before close.'
    : 'Hard-block close is OFF — blockers are advisory only.'

  return {
    periodCode: readiness.periodCode,
    periodLabel: readiness.periodLabel,
    workflowStage: workflowFromStatus(readiness.periodStatus),
    overallProgressPct: readiness.overallProgressPct,
    tasksCompleted: completed,
    tasksPending: pending,
    overdueTasks: 0,
    unpostedDocuments: readiness.unpostedJournalCount,
    reconciliationDifferences: readiness.openBankReconCount ?? 0,
    blockingExceptions: readiness.blockingCount,
    periodStatusLabel: `${statusLabel(readiness.periodStatus)} · ${hardNote}`,
    deptProgress: [
      {
        department: 'General Ledger',
        completed: readiness.periodStatus === 'CLOSED' ? 1 : 0,
        total: 1,
        pct: readiness.periodStatus === 'CLOSED' ? 100 : 0,
      },
      {
        department: 'Purchase & AP',
        completed: readiness.checks.find((c) => c.code === 'AP_CLOSE_GATE')?.status === 'completed' ? 1 : 0,
        total: 1,
        pct: readiness.checks.find((c) => c.code === 'AP_CLOSE_GATE')?.status === 'completed' ? 100 : 0,
      },
      {
        department: 'Bank & Cash',
        completed: readiness.checks.find((c) => c.code === 'BANK_RECON')?.status === 'completed' ? 1 : 0,
        total: 1,
        pct: readiness.checks.find((c) => c.code === 'BANK_RECON')?.status === 'completed' ? 100 : 0,
      },
    ],
    criticalBlockers: (readiness.blockers ?? readiness.checks.filter((c) => c.severity === 'blocking')).map((c) => ({
      id: c.code,
      title: c.message,
      module: c.label,
      href: c.href ?? '/accounting/period-close/checklist',
    })),
    pendingReconciliations: [],
    unpostedItems: [],
    approvalWorklist: readiness.checks
      .filter((c) => c.severity === 'warning' || c.severity === 'blocking')
      .map((c) => ({
        id: c.code,
        title: c.label,
        owner: 'Finance',
        status: c.status,
      })),
    recentActivities: [
      {
        id: 'period-status',
        at: new Date().toISOString(),
        by: 'System',
        summary: `${period.name}: ${statusLabel(period.status)}`,
      },
    ],
    moduleLocks: [
      {
        id: period.id,
        module: 'General Ledger (Accounting Period)',
        lockThroughDate: dateOnly(period.endDate),
        status:
          period.status === 'CLOSED'
            ? 'hard_locked'
            : period.status === 'UNDER_REVIEW'
              ? 'soft_locked'
              : period.status === 'REOPENED'
                ? 'reopened_temporarily'
                : 'open',
        lockedBy: period.closedBy ?? undefined,
        lockedDate: period.closedAt ? dateOnly(period.closedAt) : undefined,
        reopenAllowed: period.status === 'CLOSED' || period.status === 'UNDER_REVIEW',
      },
    ],
  }
}

export async function buildApiCloseTasks(filter?: PeriodFilterState): Promise<CloseTask[]> {
  const readiness = await composePeriodCloseReadiness(filter)
  return readiness.checks.map((c) => ({
    id: `ready-${c.code}`,
    periodCode: readiness.periodCode,
    task: c.label,
    module:
      c.code === 'AP_CLOSE_GATE'
        ? 'purchase_ap'
        : c.code === 'BANK_RECON'
          ? 'bank_cash'
          : c.code === 'INVENTORY_GL'
            ? 'inventory'
            : c.code === 'MFG_GL'
              ? 'manufacturing'
              : 'general_ledger',
    owner: 'Finance',
    reviewer: 'Finance Manager',
    dueDate: dateOnly(new Date().toISOString()),
    dependencyIds: [],
    status: c.status,
    completionPct: c.status === 'completed' || c.status === 'not_applicable' ? 100 : c.status === 'not_started' ? 0 : 40,
    evidence: c.message,
    comments: readiness.hardBlockEnabled
      ? c.severity === 'blocking'
        ? 'Hard-block enabled — must clear before close.'
        : undefined
      : c.severity === 'blocking'
        ? 'Advisory blocker — hard-block close is off.'
        : undefined,
  }))
}

export async function loadApiModuleLocks(filter?: PeriodFilterState): Promise<ModulePeriodLock[]> {
  const { le, fy } = await resolveApiPeriodFilter(filter)
  const periods = await listPeriods(le.id, fy.id)
  return periods.map((p) => ({
    id: p.id,
    module: p.name,
    lockThroughDate: dateOnly(p.endDate),
    status:
      p.status === 'CLOSED'
        ? 'hard_locked'
        : p.status === 'UNDER_REVIEW'
          ? 'soft_locked'
          : p.status === 'REOPENED'
            ? 'reopened_temporarily'
            : 'open',
    lockedBy: p.closedBy ?? undefined,
    lockedDate: p.closedAt ? dateOnly(p.closedAt) : undefined,
    reopenAllowed: p.status === 'CLOSED' || p.status === 'UNDER_REVIEW',
  }))
}

export async function apiClosePeriod(periodId: string) {
  return bridgeClosePeriod(periodId)
}

export async function apiReopenPeriod(periodId: string, reason: string) {
  return bridgeReopenPeriod(periodId, reason)
}

export async function apiMarkPeriodUnderReview(periodId: string) {
  return bridgeMarkUnderReview(periodId)
}

export async function listApiPeriodsForLocking(filter?: PeriodFilterState): Promise<AccountingPeriod[]> {
  const { le, fy } = await resolveApiPeriodFilter(filter)
  return listPeriods(le.id, fy.id)
}

export async function apiListChecklistAcks(periodId: string): Promise<PeriodCloseChecklistAck[]> {
  const res = await listPeriodCloseChecklistAcks(periodId)
  return res.data ?? []
}

export async function apiUpsertChecklistAcks(
  periodId: string,
  items: Array<{ checkKey: string; status: 'ACK' | 'NA'; note?: string | null }>,
): Promise<PeriodCloseChecklistAck[]> {
  const res = await upsertPeriodCloseChecklistAcks(periodId, items)
  return res.data ?? []
}
