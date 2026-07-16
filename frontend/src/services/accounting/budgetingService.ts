/**
 * Budgeting & Forecasting mock service — Promise APIs over in-memory seed.
 * Demo / UI only. No GL posting or live commitment engine.
 */

import {
  APPROVALS_SEED,
  BUDGET_REPORTS_SEED,
  BUDGET_VERSIONS_SEED,
  BUDGETING_SETUP_SEED,
  CAPEX_SEED,
  CASH_FLOW_13W_SEED,
  CASH_FLOW_MONTHLY_SEED,
  COST_CENTRE_BUDGETS_SEED,
  DEPARTMENT_BUDGETS_SEED,
  DIMENSION_BUDGETS_SEED,
  EXPENSE_BUDGETS_SEED,
  ROLLING_FORECAST_SEED,
  WORKING_LINES,
  buildBudgetVsActualRows,
  buildBudgetingDashboard,
  resetWorkingLines,
  setWorkingLines,
} from '@/data/accounting/budgetingSeed'
import type {
  AnnualGridFilters,
  ApprovalWorkStatus,
  BudgetApprovalItem,
  BudgetLine,
  BudgetReportCard,
  BudgetVersion,
  BudgetVersionStatus,
  BudgetingDashboard,
  BudgetingSetup,
  CapexRequest,
  CashFlowSummary,
  CashFlowView,
  CostCentreBudgetRow,
  DepartmentBudgetRow,
  DimensionBudgetRow,
  ExpenseBudgetRow,
  ForecastMethod,
  FyMonth,
  MonthlyAmounts,
  RollingForecastRow,
  BudgetVsActualRow,
  BvaDimension,
} from '@/types/budgeting'
import { FY_MONTHS, emptyMonths, sumMonths } from '@/types/budgeting'

const delay = (ms = 160) => new Promise((r) => setTimeout(r, ms))

export class BudgetingServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BudgetingServiceError'
  }
}

let versions = [...BUDGET_VERSIONS_SEED]
let approvals = [...APPROVALS_SEED]
let rolling = ROLLING_FORECAST_SEED.map((r) => ({
  ...r,
  months: { ...r.months },
  monthIsActual: { ...r.monthIsActual },
}))

export async function getBudgetingDashboard(): Promise<BudgetingDashboard> {
  await delay()
  return buildBudgetingDashboard()
}

export async function listBudgetVersions(): Promise<BudgetVersion[]> {
  await delay()
  return [...versions].sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
}

export async function getBudgetVersion(id: string): Promise<BudgetVersion | null> {
  await delay()
  return versions.find((v) => v.id === id) ?? null
}

export async function createBudgetVersion(
  input: Pick<BudgetVersion, 'name' | 'kind' | 'financialYear' | 'budgetType' | 'notes'> & {
    copyFromId?: string
  },
): Promise<BudgetVersion> {
  await delay(220)
  const now = new Date().toISOString()
  const created: BudgetVersion = {
    id: `bv-${crypto.randomUUID().slice(0, 8)}`,
    name: input.name,
    kind: input.kind,
    financialYear: input.financialYear,
    budgetType: input.budgetType,
    startDate: `${input.financialYear.slice(0, 4)}-04-01`,
    endDate: `20${input.financialYear.slice(5)}-03-31`,
    status: 'draft',
    preparedBy: 'Current User',
    approvedBy: null,
    lastUpdated: now,
    isPrimary: false,
    companyId: 'co-vasant',
    companyName: 'Vasant Trailers Pvt Ltd',
    notes: input.notes,
  }
  versions = [created, ...versions]
  if (input.copyFromId) {
    const source = WORKING_LINES.filter((l) => l.versionId === input.copyFromId)
    for (const line of source) {
      WORKING_LINES.push({
        ...line,
        id: `bl-${crypto.randomUUID().slice(0, 8)}`,
        versionId: created.id,
        months: { ...line.months },
      })
    }
  }
  return created
}

export async function updateBudgetVersionStatus(
  id: string,
  status: BudgetVersionStatus,
): Promise<BudgetVersion> {
  await delay()
  const v = versions.find((x) => x.id === id)
  if (!v) throw new BudgetingServiceError('Budget version not found')
  if (status === 'approved') {
    // Only one approved primary per company + FY
    versions = versions.map((x) =>
      x.companyId === v.companyId && x.financialYear === v.financialYear && x.id !== id
        ? {
            ...x,
            isPrimary: false,
            status: x.status === 'approved' ? 'superseded' : x.status,
            lastUpdated: new Date().toISOString(),
          }
        : x,
    )
    v.isPrimary = true
    v.approvedBy = 'Ravi Kulkarni'
  }
  v.status = status
  v.lastUpdated = new Date().toISOString()
  versions = versions.map((x) => (x.id === id ? { ...v } : x))
  return { ...v }
}

export async function getAnnualGrid(filters: AnnualGridFilters): Promise<BudgetLine[]> {
  await delay()
  let rows = WORKING_LINES.filter((l) => l.versionId === filters.versionId)
  if (filters.departmentId) rows = rows.filter((l) => l.departmentId === filters.departmentId)
  if (filters.costCentreId) rows = rows.filter((l) => l.costCentreId === filters.costCentreId)
  if (filters.plantId) rows = rows.filter((l) => l.plantId === filters.plantId)
  if (filters.projectId) rows = rows.filter((l) => l.projectId === filters.projectId)
  if (filters.accountGroup) rows = rows.filter((l) => l.accountGroup === filters.accountGroup)
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase()
    rows = rows.filter(
      (l) =>
        l.accountCode.toLowerCase().includes(q) ||
        l.accountName.toLowerCase().includes(q),
    )
  }
  return rows.map((l) => ({ ...l, months: { ...l.months } }))
}

export async function saveAnnualLines(versionId: string, lines: BudgetLine[]): Promise<void> {
  await delay(200)
  setWorkingLines(
    WORKING_LINES.filter((l) => l.versionId !== versionId).concat(
      lines.map((l) => ({ ...l, versionId, months: { ...l.months } })),
    ),
  )
}

export type AllocateMode = 'equal' | 'seasonal' | 'copy_py' | 'growth'

export async function allocateAnnual(
  versionId: string,
  mode: AllocateMode,
  growthPct = 0,
): Promise<BudgetLine[]> {
  await delay(220)
  const seasonal = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.1, 1.0, 0.9, 0.85, 0.8, 0.75]
  setWorkingLines(
    WORKING_LINES.map((line) => {
      if (line.versionId !== versionId) return line
      const annual =
        mode === 'copy_py'
          ? line.previousYearActual
          : mode === 'growth'
            ? Number((line.previousYearActual * (1 + growthPct / 100)).toFixed(0))
            : sumMonths(line.months) || line.previousYearActual
      const weights = mode === 'seasonal' ? seasonal : Array(12).fill(1)
      const totalW = weights.reduce((a, b) => a + b, 0)
      const months = emptyMonths()
      let allocated = 0
      FY_MONTHS.forEach((key, i) => {
        if (i === 11) months[key] = Number((annual - allocated).toFixed(2))
        else {
          const v = Number(((annual * (weights[i] ?? 1)) / totalW).toFixed(2))
          months[key] = v
          allocated += v
        }
      })
      return { ...line, months }
    }),
  )
  return getAnnualGrid({ versionId })
}

export async function importAnnualPreview(csvText: string): Promise<{ ok: boolean; message: string; rows: number }> {
  await delay(250)
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) {
    return { ok: false, message: 'CSV needs a header and at least one data row.', rows: 0 }
  }
  return {
    ok: true,
    message: `Parsed ${lines.length - 1} row(s) — preview only; not posted to GL.`,
    rows: lines.length - 1,
  }
}

export async function listDepartmentBudgets(versionId?: string): Promise<DepartmentBudgetRow[]> {
  await delay()
  const id = versionId ?? 'bv-original'
  return DEPARTMENT_BUDGETS_SEED.filter((d) => d.versionId === id)
}

export async function listCostCentreBudgets(versionId?: string): Promise<CostCentreBudgetRow[]> {
  await delay()
  const id = versionId ?? 'bv-original'
  return COST_CENTRE_BUDGETS_SEED.filter((d) => d.versionId === id)
}

export async function listDimensionBudgets(
  kind: 'sales' | 'purchase' | 'production',
): Promise<DimensionBudgetRow[]> {
  await delay()
  return DIMENSION_BUDGETS_SEED.filter((d) => d.kind === kind)
}

export async function listExpenseBudgets(versionId?: string): Promise<ExpenseBudgetRow[]> {
  await delay()
  const id = versionId ?? 'bv-original'
  return EXPENSE_BUDGETS_SEED.filter((e) => e.versionId === id).map((e) => ({
    ...e,
    months: { ...e.months },
  }))
}

export async function listCapexRequests(): Promise<CapexRequest[]> {
  await delay()
  return [...CAPEX_SEED]
}

export async function getCapexRequest(id: string): Promise<CapexRequest | null> {
  await delay()
  return CAPEX_SEED.find((c) => c.id === id) ?? null
}

export async function getCashFlowForecast(view: CashFlowView): Promise<CashFlowSummary> {
  await delay()
  const rows =
    view === 'thirteen_week'
      ? CASH_FLOW_13W_SEED
      : view === 'weekly'
        ? CASH_FLOW_13W_SEED.slice(0, 8)
        : view === 'daily'
          ? CASH_FLOW_13W_SEED.slice(0, 5).map((r, i) => ({
              ...r,
              id: `cf-d-${i}`,
              periodLabel: `Day ${i + 1}`,
            }))
          : CASH_FLOW_MONTHLY_SEED
  const closings = rows.map((r) => r.closing)
  const minClose = Math.min(...closings)
  const maxClose = Math.max(...closings)
  const threshold = BUDGETING_SETUP_SEED.minimumCashThreshold
  return {
    view,
    rows: rows.map((r) => ({ ...r })),
    surplus: Math.max(0, maxClose - threshold),
    shortfall: Math.max(0, threshold - minClose),
    minimumCashThreshold: threshold,
    fundingRequirement: Math.max(0, threshold - minClose),
  }
}

export async function listBudgetVsActual(dimension: BvaDimension = 'account'): Promise<BudgetVsActualRow[]> {
  await delay()
  if (dimension === 'department') {
    return DEPARTMENT_BUDGETS_SEED.map((d) => ({
      id: `bva-d-${d.id}`,
      dimension,
      label: d.departmentName,
      code: d.departmentId,
      budget: d.approvedBudget,
      committed: d.committed,
      actual: d.actual,
      available: d.approvedBudget - d.committed - d.actual,
      variance: d.approvedBudget - d.actual,
      variancePct: Number((((d.approvedBudget - d.actual) / d.approvedBudget) * 100).toFixed(1)),
      forecast: d.forecast,
      projectedYearEndVariance: d.approvedBudget - d.forecast,
    }))
  }
  if (dimension === 'cost_centre') {
    return COST_CENTRE_BUDGETS_SEED.map((d) => ({
      id: `bva-c-${d.id}`,
      dimension,
      label: d.costCentreName,
      code: d.costCentreId,
      budget: d.approvedBudget,
      committed: d.committed,
      actual: d.actual,
      available: d.approvedBudget - d.committed - d.actual,
      variance: d.approvedBudget - d.actual,
      variancePct: Number((((d.approvedBudget - d.actual) / d.approvedBudget) * 100).toFixed(1)),
      forecast: d.forecast,
      projectedYearEndVariance: d.approvedBudget - d.forecast,
    }))
  }
  if (dimension === 'plant') {
    const budget = WORKING_LINES.reduce((s, l) => s + sumMonths(l.months), 0)
    const actual = WORKING_LINES.reduce((s, l) => s + l.actual, 0)
    const committed = WORKING_LINES.reduce((s, l) => s + l.committed, 0)
    return [
      {
        id: 'bva-plant-chakan',
        dimension,
        label: 'Chakan Plant',
        code: 'plant-chakan',
        budget,
        committed,
        actual,
        available: budget - committed - actual,
        variance: budget - actual,
        variancePct: Number((((budget - actual) / budget) * 100).toFixed(1)),
        forecast: Number((budget * 0.98).toFixed(0)),
        projectedYearEndVariance: Number((budget * 0.02).toFixed(0)),
      },
    ]
  }
  if (dimension === 'project') {
    const line = WORKING_LINES.find((l) => l.projectId)
    if (!line) return []
    const budget = sumMonths(line.months)
    return [
      {
        id: 'bva-prj',
        dimension,
        label: line.projectName ?? 'Project',
        code: line.projectId ?? '',
        budget,
        committed: line.committed,
        actual: line.actual,
        available: budget - line.committed - line.actual,
        variance: budget - line.actual,
        variancePct: Number((((budget - line.actual) / budget) * 100).toFixed(1)),
        forecast: Number((budget * 0.95).toFixed(0)),
        projectedYearEndVariance: Number((budget * 0.05).toFixed(0)),
      },
    ]
  }
  return buildBudgetVsActualRows()
}

export async function listRollingForecast(): Promise<RollingForecastRow[]> {
  await delay()
  return rolling.map((r) => ({
    ...r,
    months: { ...r.months },
    monthIsActual: { ...r.monthIsActual },
  }))
}

export async function applyRollingMethod(
  method: ForecastMethod,
  growthPct = 5,
): Promise<{ ok: boolean; message: string; rows: RollingForecastRow[] }> {
  await delay(200)
  if (method !== 'manual') {
    return {
      ok: false,
      message: `Forecast method “${method}” is a frontend placeholder until a forecasting engine is connected. Switch to Manual to edit.`,
      rows: await listRollingForecast(),
    }
  }
  rolling = rolling.map((r) => {
    const months = { ...r.months } as MonthlyAmounts
    FY_MONTHS.forEach((m) => {
      if (!r.monthIsActual[m]) {
        months[m] = Number((months[m] * (1 + growthPct / 100)).toFixed(0))
      }
    })
    return {
      ...r,
      method,
      months,
      fullYear: sumMonths(months),
    }
  })
  return { ok: true, message: 'Manual forecast updated (demo).', rows: await listRollingForecast() }
}

export async function updateRollingMonth(
  rowId: string,
  month: FyMonth,
  value: number,
): Promise<RollingForecastRow> {
  await delay(80)
  const row = rolling.find((r) => r.id === rowId)
  if (!row) throw new BudgetingServiceError('Rolling forecast row not found')
  if (row.monthIsActual[month]) throw new BudgetingServiceError('Completed months are locked to actuals')
  row.months[month] = value
  row.fullYear = sumMonths(row.months)
  row.method = 'manual'
  return { ...row, months: { ...row.months }, monthIsActual: { ...row.monthIsActual } }
}

export async function listBudgetApprovals(): Promise<BudgetApprovalItem[]> {
  await delay()
  return approvals.map((a) => ({ ...a, history: [...a.history] }))
}

export async function submitApprovalAction(
  id: string,
  action: 'approve' | 'reject' | 'send_back' | 'clarification',
  comment: string,
): Promise<BudgetApprovalItem> {
  await delay(200)
  const item = approvals.find((a) => a.id === id)
  if (!item) throw new BudgetingServiceError('Approval item not found')
  if ((action === 'reject' || action === 'send_back' || action === 'clarification') && !comment.trim()) {
    throw new BudgetingServiceError('Comment is mandatory for reject, send back, and clarification.')
  }
  const statusMap: Record<typeof action, ApprovalWorkStatus> = {
    approve: 'approved',
    reject: 'rejected',
    send_back: 'sent_back',
    clarification: 'clarification',
  }
  item.status = statusMap[action]
  item.comments = comment
  item.history = [
    ...item.history,
    {
      at: new Date().toISOString(),
      actor: 'Current User',
      action:
        action === 'approve'
          ? 'Approved'
          : action === 'reject'
            ? 'Rejected'
            : action === 'send_back'
              ? 'Sent Back'
              : 'Request Clarification',
      comment,
    },
  ]
  if (action === 'approve') {
    await updateBudgetVersionStatus(item.versionId, 'approved')
  }
  approvals = approvals.map((a) => (a.id === id ? { ...item, history: [...item.history] } : a))
  return { ...item, history: [...item.history] }
}

export async function listBudgetReports(): Promise<BudgetReportCard[]> {
  await delay()
  return [...BUDGET_REPORTS_SEED]
}

export async function getBudgetingSetup(): Promise<BudgetingSetup> {
  await delay()
  return { ...BUDGETING_SETUP_SEED, approvalMatrix: [...BUDGETING_SETUP_SEED.approvalMatrix] }
}

/** Test helper */
export function __resetBudgetingDemoState() {
  versions = [...BUDGET_VERSIONS_SEED]
  approvals = [...APPROVALS_SEED]
  resetWorkingLines()
  rolling = ROLLING_FORECAST_SEED.map((r) => ({
    ...r,
    months: { ...r.months },
    monthIsActual: { ...r.monthIsActual },
  }))
}
