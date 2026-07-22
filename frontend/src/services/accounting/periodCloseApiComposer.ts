/**
 * Period Close Phase 1 — API-mode composition (no dedicated readiness BE).
 * Uses AccountingPeriod, AP close-gate, journals, bank recon sessions.
 */

import { listJournals } from '@/services/bridges/journalApiBridge'
import {
  closePeriod as bridgeClosePeriod,
  ensureLegalEntity,
  listFinancialYears,
  listPeriods,
  markPeriodUnderReview as bridgeMarkUnderReview,
  reopenPeriod as bridgeReopenPeriod,
} from '@/services/bridges/financeApiBridge'
import { getLatestPayableCloseGateRun } from '@/services/bridges/payablesApiBridge'
import { fetchReconciliationSessions } from '@/modules/accounting/treasury/bank-reconciliation/api/bank-reconciliation.api'
import type { AccountingPeriod, FinancialYear, LegalEntity } from '@/types/financeSetup'
import type { Journal } from '@/types/journals'
import type {
  CloseDashboardData,
  CloseTask,
  CloseWorkflowStage,
  ModulePeriodLock,
  PeriodCloseReadiness,
  PeriodCloseReadinessCheck,
  PeriodCloseSetup,
  PeriodFilterState,
} from '@/types/periodClose'

const UNPOSTED_JOURNAL_STATUSES = new Set(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT_BACK'])

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

async function loadUnpostedJournals(legalEntityId: string, period: AccountingPeriod): Promise<Journal[]> {
  try {
    const rows = await listJournals({
      legalEntityId,
      postingDateFrom: dateOnly(period.startDate),
      postingDateTo: dateOnly(period.endDate),
      limit: 100,
      page: 1,
    })
    return rows.filter((j) => UNPOSTED_JOURNAL_STATUSES.has(j.status))
  } catch {
    return []
  }
}

async function loadApCloseGate(
  legalEntityId: string,
  periodId: string,
): Promise<{ status: string | null; message: string; available: boolean }> {
  try {
    const detail = await getLatestPayableCloseGateRun(periodId, legalEntityId)
    if (!detail?.run) {
      return {
        status: null,
        available: true,
        message: 'No AP close-gate run for this period yet. Run assessment from Money Out → Close Gate.',
      }
    }
    return {
      status: detail.run.status,
      available: true,
      message: `Latest AP close gate: ${detail.run.status} (${detail.run.checksPassed}/${detail.run.checksTotal} passed).`,
    }
  } catch {
    return {
      status: null,
      available: false,
      message: 'AP close gate unavailable (permission or API error). Soft warning only.',
    }
  }
}

async function loadBankReconOpenCount(legalEntityId: string, period: AccountingPeriod): Promise<number> {
  try {
    const page = await fetchReconciliationSessions({ legalEntityId, page: 1, limit: 50 })
    const start = dateOnly(period.startDate)
    const end = dateOnly(period.endDate)
    return page.items.filter((s) => {
      if (s.status === 'FINALIZED' || s.status === 'CANCELLED') return false
      const sStart = dateOnly(s.statementStartDate)
      const sEnd = dateOnly(s.statementEndDate)
      return sStart <= end && sEnd >= start
    }).length
  } catch {
    return -1
  }
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

export async function composePeriodCloseReadiness(filter?: PeriodFilterState): Promise<PeriodCloseReadiness> {
  const { le, period } = await resolveApiPeriodFilter(filter)
  const [unposted, apGate, bankOpen] = await Promise.all([
    loadUnpostedJournals(le.id, period),
    loadApCloseGate(le.id, period.id),
    loadBankReconOpenCount(le.id, period),
  ])

  const checks: PeriodCloseReadinessCheck[] = []

  if (period.status === 'CLOSED') {
    checks.push({
      code: 'PERIOD_STATUS',
      label: 'Period status',
      status: 'completed',
      severity: 'ok',
      message: `${period.name} is CLOSED. Journal posting into this period is blocked.`,
      href: '/accounting/period-close/period-locking',
    })
  } else if (period.status === 'UNDER_REVIEW') {
    checks.push({
      code: 'PERIOD_STATUS',
      label: 'Period status',
      status: 'ready_for_review',
      severity: 'warning',
      message: `${period.name} is UNDER_REVIEW. Close when ready.`,
      href: '/accounting/period-close/period-locking',
    })
  } else {
    checks.push({
      code: 'PERIOD_STATUS',
      label: 'Period status',
      status: period.status === 'REOPENED' ? 'reopened' : 'in_progress',
      severity: 'info',
      message: `${period.name} is ${period.status}. Soft readiness checks below do not hard-block close.`,
      href: '/accounting/period-close/period-locking',
    })
  }

  if (!apGate.available) {
    checks.push({
      code: 'AP_CLOSE_GATE',
      label: 'AP close gate',
      status: 'waiting',
      severity: 'warning',
      message: apGate.message,
      href: '/accounting/money-out/close-gate',
    })
  } else if (!apGate.status) {
    checks.push({
      code: 'AP_CLOSE_GATE',
      label: 'AP close gate',
      status: 'not_started',
      severity: 'warning',
      message: apGate.message,
      href: '/accounting/money-out/close-gate',
    })
  } else if (apGate.status === 'PASS') {
    checks.push({
      code: 'AP_CLOSE_GATE',
      label: 'AP close gate',
      status: 'completed',
      severity: 'ok',
      message: apGate.message,
      href: '/accounting/money-out/close-gate',
    })
  } else if (apGate.status === 'PASS_WITH_WARNINGS') {
    checks.push({
      code: 'AP_CLOSE_GATE',
      label: 'AP close gate',
      status: 'ready_for_review',
      severity: 'warning',
      message: apGate.message,
      href: '/accounting/money-out/close-gate',
    })
  } else {
    checks.push({
      code: 'AP_CLOSE_GATE',
      label: 'AP close gate',
      status: 'blocked',
      severity: 'blocking',
      message: apGate.message,
      href: '/accounting/money-out/close-gate',
    })
  }

  if (unposted.length === 0) {
    checks.push({
      code: 'UNPOSTED_JOURNALS',
      label: 'Unposted journals',
      status: 'completed',
      severity: 'ok',
      message: 'No draft / pending / approved (unposted) journals in this period date range.',
      href: '/accounting/entries/journals',
      count: 0,
    })
  } else {
    checks.push({
      code: 'UNPOSTED_JOURNALS',
      label: 'Unposted journals',
      status: 'in_progress',
      severity: 'warning',
      message: `${unposted.length} unposted journal(s) with posting date in ${period.name}. Soft warning — close still allowed.`,
      href: '/accounting/entries/journals',
      count: unposted.length,
    })
  }

  if (bankOpen < 0) {
    checks.push({
      code: 'BANK_RECON',
      label: 'Bank reconciliation',
      status: 'waiting',
      severity: 'info',
      message: 'Bank reconciliation status unavailable (permission or API error).',
      href: '/accounting/bank-cash/reconciliation',
    })
  } else if (bankOpen === 0) {
    checks.push({
      code: 'BANK_RECON',
      label: 'Bank reconciliation',
      status: 'completed',
      severity: 'ok',
      message: 'No open bank reconciliation sessions overlapping this period.',
      href: '/accounting/bank-cash/reconciliation',
      count: 0,
    })
  } else {
    checks.push({
      code: 'BANK_RECON',
      label: 'Bank reconciliation',
      status: 'in_progress',
      severity: 'warning',
      message: `${bankOpen} open bank reconciliation session(s) overlap this period. Soft warning.`,
      href: '/accounting/bank-cash/reconciliation',
      count: bankOpen,
    })
  }

  const completed = checks.filter((c) => c.status === 'completed' || c.status === 'not_applicable').length
  const blockingCount = checks.filter((c) => c.severity === 'blocking').length
  const warningCount = checks.filter((c) => c.severity === 'warning').length

  return {
    periodId: period.id,
    periodCode: periodCodeFromStart(period.startDate),
    periodLabel: period.name,
    periodStatus: period.status,
    legalEntityId: le.id,
    overallProgressPct: checks.length ? Math.round((completed / checks.length) * 100) : 0,
    blockingCount,
    warningCount,
    unpostedJournalCount: unposted.length,
    checks,
    canCloseSoft: period.status !== 'CLOSED',
  }
}

export async function buildApiCloseDashboard(filter?: PeriodFilterState): Promise<CloseDashboardData> {
  const readiness = await composePeriodCloseReadiness(filter)
  const { period } = await resolveApiPeriodFilter(filter)
  const completed = readiness.checks.filter((c) => c.status === 'completed' || c.status === 'not_applicable').length
  const pending = readiness.checks.length - completed

  return {
    periodCode: readiness.periodCode,
    periodLabel: readiness.periodLabel,
    workflowStage: workflowFromStatus(readiness.periodStatus),
    overallProgressPct: readiness.overallProgressPct,
    tasksCompleted: completed,
    tasksPending: pending,
    overdueTasks: 0,
    unpostedDocuments: readiness.unpostedJournalCount,
    reconciliationDifferences: readiness.checks.some((c) => c.code === 'BANK_RECON' && (c.count ?? 0) > 0)
      ? (readiness.checks.find((c) => c.code === 'BANK_RECON')?.count ?? 0)
      : 0,
    blockingExceptions: readiness.blockingCount,
    periodStatusLabel: statusLabel(readiness.periodStatus),
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
    criticalBlockers: readiness.checks
      .filter((c) => c.severity === 'blocking')
      .map((c) => ({
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
          : c.code === 'UNPOSTED_JOURNALS'
            ? 'general_ledger'
            : 'general_ledger',
    owner: 'Finance',
    reviewer: 'Finance Manager',
    dueDate: dateOnly(new Date().toISOString()),
    dependencyIds: [],
    status: c.status,
    completionPct: c.status === 'completed' || c.status === 'not_applicable' ? 100 : c.status === 'not_started' ? 0 : 40,
    evidence: c.message,
    comments: c.severity === 'blocking' ? 'Soft advisory — period close API does not hard-block on this check.' : undefined,
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
