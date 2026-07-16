/**
 * Financial Reports mock service — Promise-based for future API swap.
 * Demo / UI only. Does NOT produce statutory filings or real consolidation.
 *
 * SECURITY: All reads/writes/exports must also be enforced by the future backend
 * (tenant isolation + accounting.reports.* permissions). UI gating alone is not security.
 */

import {
  FINANCIAL_REPORTS_COMPANY_NAME,
  FINANCIAL_REPORTS_PERIOD_LABEL,
  seedAccountScheduleDefinitions,
  seedBalanceSheetStatement,
  seedBudgetVsActualSeries,
  seedCashFlowStatement,
  seedCostCentreProfitability,
  seedDepartmentPerformance,
  seedFinancialMisSnapshot,
  seedFinancialReportSetup,
  seedFinancialReportsDashboard,
  seedManufacturingProfitability,
  seedProfitLossStatement,
  seedProjectProfitability,
  seedTrialBalanceRows,
} from '../../data/accounting/financialReportsSeed'
import { seedCoaDimensionLookups } from '../../data/accounting/chartOfAccountsSeed'
import type {
  AccountScheduleDefinition,
  AccountScheduleRunResult,
  BalanceSheetStatement,
  BudgetVsActualSeries,
  CashFlowStatement,
  ComparativeStatementsResult,
  CostCentreProfitabilityRow,
  DepartmentPerformanceRow,
  FinancialMisDashboard,
  FinancialMisView,
  FinancialReportExportRequest,
  FinancialReportFilter,
  FinancialReportLookups,
  FinancialReportPrintPreview,
  FinancialReportSetup,
  FinancialReportsDashboardData,
  GeneralLedgerReportResult,
  ManufacturingProfitabilityRow,
  ProfitLossStatement,
  ProjectProfitabilityRow,
  RatioAnalysisResult,
  TrialBalanceResult,
} from '../../types/financialReports'
import { DEFAULT_FINANCIAL_REPORT_FILTER } from '../../types/financialReports'
import {
  formatDisplayDate,
  getIndianFinancialYear,
  resolveLedgerDateRange,
} from '../../utils/accounting/indianFinancialYear'
import { getAccountLedgerSummary, getLedgerEntries } from './ledgerEntriesService'
import { getSessionUser } from '../../utils/permissions'

export { DEFAULT_FINANCIAL_REPORT_FILTER }

export class FinancialReportsServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FinancialReportsServiceError'
  }
}

const delay = () => new Promise((r) => setTimeout(r, 60 + Math.floor(Math.random() * 80)))

let dashboardStore = seedFinancialReportsDashboard()
let trialBalanceStore = seedTrialBalanceRows()
let profitLossStore = seedProfitLossStatement()
let balanceSheetStore = seedBalanceSheetStatement()
let cashFlowStore = seedCashFlowStatement()
let scheduleStore = seedAccountScheduleDefinitions()
let manufacturingStore = seedManufacturingProfitability()
let budgetStore = seedBudgetVsActualSeries()
let costCentreStore = seedCostCentreProfitability()
let departmentStore = seedDepartmentPerformance()
let projectStore = seedProjectProfitability()
let setupStore = seedFinancialReportSetup()
let misStore = seedFinancialMisSnapshot()

function clone<T>(value: T): T {
  return structuredClone(value)
}

function mergeFilter(partial?: Partial<FinancialReportFilter>): FinancialReportFilter {
  return { ...DEFAULT_FINANCIAL_REPORT_FILTER, ...partial }
}

function resolveReportRange(filter: FinancialReportFilter): { from: string; to: string; label: string } {
  const from = filter.fromDate || getIndianFinancialYear().startDate
  const to = filter.toDate || new Date().toISOString().slice(0, 10)
  return {
    from,
    to,
    label: `${formatDisplayDate(from)} to ${formatDisplayDate(to)}`,
  }
}

/** Drill-down link understood by LedgerEntriesPage account view. */
export function buildLedgerDrilldownHref(accountId: string, fromDate: string, toDate: string): string {
  const params = new URLSearchParams()
  if (fromDate) params.set('from', fromDate)
  if (toDate) params.set('to', toDate)
  const qs = params.toString()
  return `/accounting/ledger-entries/account/${accountId}${qs ? `?${qs}` : ''}`
}

function applyTrialBalanceFilter(rows: typeof trialBalanceStore, filter: FinancialReportFilter) {
  let result = [...rows]
  if (filter.accountGroup) {
    result = result.filter((r) => r.accountGroup === filter.accountGroup)
  }
  if (!filter.includeZeroBalance) {
    result = result.filter(
      (r) =>
        r.closingDebit > 0 ||
        r.closingCredit > 0 ||
        r.periodDebit > 0 ||
        r.periodCredit > 0,
    )
  }
  return result
}

function buildTrialBalanceResult(filter: FinancialReportFilter): TrialBalanceResult {
  const range = resolveReportRange(filter)
  const rows = applyTrialBalanceFilter(trialBalanceStore, filter)
  const sum = (key: keyof (typeof rows)[0]) => rows.reduce((s, r) => s + (r[key] as number), 0)
  const totalClosingDebit = sum('closingDebit')
  const totalClosingCredit = sum('closingCredit')
  return {
    companyName: FINANCIAL_REPORTS_COMPANY_NAME,
    periodLabel: range.label,
    asOfDate: range.to,
    rows,
    totalOpeningDebit: sum('openingDebit'),
    totalOpeningCredit: sum('openingCredit'),
    totalPeriodDebit: sum('periodDebit'),
    totalPeriodCredit: sum('periodCredit'),
    totalClosingDebit,
    totalClosingCredit,
    isBalanced: Math.abs(totalClosingDebit - totalClosingCredit) < 0.01,
  }
}

function runScheduleDemoValues(
  schedule: AccountScheduleDefinition,
  filter: FinancialReportFilter,
): AccountScheduleRunResult {
  const values: Record<string, Record<string, number>> = {}
  const baseMap: Record<string, number> = {
    R01: 3_50_00_000,
    R02: 12_00_000,
    R03: 3_38_00_000,
    R04: 2_45_00_000,
    R05: 93_00_000,
    WC1: 84_20_000,
    WC2: 1_11_60_000,
    WC3: 52_40_000,
    'WC-T': 1_43_40_000,
  }

  for (const row of schedule.rows) {
    values[row.rowCode] = {}
    for (const col of schedule.columns) {
      const base = baseMap[row.rowCode] ?? 0
      const factor =
        col.columnType === 'PreviousMonth'
          ? 0.92
          : col.columnType === 'PreviousYear'
            ? 0.88
            : col.columnType === 'Budget'
              ? 1.03
              : col.columnType === 'Variance'
                ? 1
                : col.columnType === 'VariancePct'
                  ? 1
                  : 1
      let val = Math.round(base * factor)
      if (col.columnType === 'Variance') {
        val = Math.round(base * 0.03 * (row.signReversal ? -1 : 1))
      }
      if (col.columnType === 'VariancePct') {
        val = row.rowCode === 'R03' ? -1.4 : 2.1
      }
      values[row.rowCode][col.id] = val
    }
  }

  return {
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    periodLabel: resolveReportRange(filter).label,
    columns: schedule.columns,
    values,
    generatedAt: new Date().toISOString(),
  }
}

function buildRatioAnalysis(filter: FinancialReportFilter): RatioAnalysisResult {
  const kpis = dashboardStore.kpis
  const range = resolveReportRange(filter)
  return {
    periodLabel: range.label,
    asOfDate: range.to,
    categories: [
      {
        category: 'Liquidity',
        items: [
          {
            id: 'current-ratio',
            category: 'Liquidity',
            name: 'Current Ratio',
            formula: 'Current Assets / Current Liabilities',
            value: kpis.currentRatio,
            unit: 'x',
            priorValue: 1.58,
            benchmark: 1.5,
            status: kpis.currentRatio >= 1.5 ? 'good' : 'watch',
          },
          {
            id: 'quick-ratio',
            category: 'Liquidity',
            name: 'Quick Ratio',
            formula: '(CA − Inventory) / CL',
            value: 0.98,
            unit: 'x',
            priorValue: 0.94,
            benchmark: 1.0,
            status: 'watch',
            note: 'RM buffer for chassis supply',
          },
        ],
      },
      {
        category: 'Profitability',
        items: [
          {
            id: 'gross-margin',
            category: 'Profitability',
            name: 'Gross Margin',
            formula: 'Gross Profit / Revenue',
            value: Math.round((kpis.grossProfit / kpis.revenue) * 1000) / 10,
            unit: '%',
            priorValue: 29.1,
            benchmark: 30,
            status: 'good',
          },
          {
            id: 'net-margin',
            category: 'Profitability',
            name: 'Net Profit Margin',
            formula: 'Net Profit / Revenue',
            value: Math.round((kpis.netProfit / kpis.revenue) * 1000) / 10,
            unit: '%',
            priorValue: 8.5,
            status: 'good',
          },
          {
            id: 'ebitda-margin',
            category: 'Profitability',
            name: 'EBITDA Margin',
            formula: 'EBITDA / Revenue',
            value: Math.round((kpis.ebitda / kpis.revenue) * 1000) / 10,
            unit: '%',
            priorValue: 14.6,
            status: 'good',
          },
        ],
      },
      {
        category: 'Working Capital',
        items: [
          {
            id: 'debtor-days',
            category: 'Working Capital',
            name: 'Debtor Days',
            formula: 'Avg Debtors / Revenue × 365',
            value: 52,
            unit: 'days',
            priorValue: 48,
            benchmark: 45,
            status: 'watch',
          },
          {
            id: 'creditor-days',
            category: 'Working Capital',
            name: 'Creditor Days',
            formula: 'Avg Creditors / Purchases × 365',
            value: 38,
            unit: 'days',
            priorValue: 39,
            status: 'good',
          },
          {
            id: 'inventory-days',
            category: 'Working Capital',
            name: 'Inventory Days',
            formula: 'Avg Inventory / COGS × 365',
            value: 46,
            unit: 'days',
            priorValue: 42,
            status: 'watch',
          },
        ],
      },
      {
        category: 'Leverage',
        items: [
          {
            id: 'debt-equity',
            category: 'Leverage',
            name: 'Debt to Equity (demo)',
            formula: 'Total Debt / Net Worth',
            value: 0.42,
            unit: 'x',
            priorValue: 0.45,
            benchmark: 0.5,
            status: 'good',
          },
        ],
      },
    ],
  }
}

function buildComparativeStatements(filter: FinancialReportFilter): ComparativeStatementsResult {
  const pl = profitLossStore
  const cols = [
    { id: 'cy', label: pl.periodLabel, amount: 0 },
    { id: 'py', label: pl.priorPeriodLabel ?? 'Prior Year', amount: 0 },
    { id: 'bud', label: pl.budgetLabel ?? 'Budget', amount: 0 },
  ]
  const rows = pl.sections.flatMap((sec) =>
    sec.lines
      .filter((l) => l.isTotal || l.indent <= 1)
      .map((l) => ({
        code: l.code,
        label: l.label,
        indent: l.indent,
        isTotal: l.isTotal,
        values: {
          cy: l.amount,
          py: l.priorAmount ?? 0,
          bud: l.budgetAmount ?? 0,
        },
      })),
  )
  return {
    statementType: 'profit_loss',
    periodLabel: resolveReportRange(filter).label,
    columns: cols,
    rows,
  }
}

export function resetFinancialReportsDemo(): void {
  dashboardStore = seedFinancialReportsDashboard()
  trialBalanceStore = seedTrialBalanceRows()
  profitLossStore = seedProfitLossStatement()
  balanceSheetStore = seedBalanceSheetStatement()
  cashFlowStore = seedCashFlowStatement()
  scheduleStore = seedAccountScheduleDefinitions()
  manufacturingStore = seedManufacturingProfitability()
  budgetStore = seedBudgetVsActualSeries()
  costCentreStore = seedCostCentreProfitability()
  departmentStore = seedDepartmentPerformance()
  projectStore = seedProjectProfitability()
  setupStore = seedFinancialReportSetup()
  misStore = seedFinancialMisSnapshot()
}

export async function getFinancialReportLookups(): Promise<FinancialReportLookups> {
  await delay()
  const dims = seedCoaDimensionLookups()
  const fy = getIndianFinancialYear()
  const prevFy = getIndianFinancialYear(new Date(`${fy.startYear - 1}-07-01`))
  return {
    financialYears: [
      { label: fy.label, startDate: fy.startDate, endDate: fy.endDate },
      { label: prevFy.label, startDate: prevFy.startDate, endDate: prevFy.endDate },
    ],
    plants: dims.plants,
    locations: dims.locations,
    departments: dims.departments,
    costCentres: dims.costCentres,
    projects: dims.projects,
    accountGroups: [
      { code: '1100', name: 'Current Assets' },
      { code: '1140', name: 'Inventory' },
      { code: '2100', name: 'Current Liabilities' },
      { code: '4000', name: 'Income' },
      { code: '5000', name: 'Cost of Goods Sold' },
      { code: '6000', name: 'Operating Expenses' },
    ],
  }
}

export async function getFinancialReportsDashboard(
  filter?: Partial<FinancialReportFilter>,
): Promise<FinancialReportsDashboardData> {
  await delay()
  mergeFilter(filter)
  return clone(dashboardStore)
}

export async function getTrialBalance(filter?: Partial<FinancialReportFilter>): Promise<TrialBalanceResult> {
  await delay()
  return clone(buildTrialBalanceResult(mergeFilter(filter)))
}

export async function getProfitAndLoss(filter?: Partial<FinancialReportFilter>): Promise<ProfitLossStatement> {
  await delay()
  const f = mergeFilter(filter)
  const stmt = clone(profitLossStore)
  stmt.periodLabel = resolveReportRange(f).label
  if (f.comparisonMode === 'none') {
    delete stmt.priorPeriodLabel
    for (const sec of stmt.sections) {
      for (const line of sec.lines) delete line.priorAmount
    }
    delete stmt.priorNetProfit
  }
  return stmt
}

export async function getBalanceSheet(filter?: Partial<FinancialReportFilter>): Promise<BalanceSheetStatement> {
  await delay()
  const f = mergeFilter(filter)
  const stmt = clone(balanceSheetStore)
  stmt.periodLabel = resolveReportRange(f).label
  stmt.asOfDate = f.toDate
  return stmt
}

export async function getCashFlowStatement(filter?: Partial<FinancialReportFilter>): Promise<CashFlowStatement> {
  await delay()
  const stmt = clone(cashFlowStore)
  stmt.periodLabel = resolveReportRange(mergeFilter(filter)).label
  return stmt
}

export async function getGeneralLedgerReport(
  filter?: Partial<FinancialReportFilter>,
): Promise<GeneralLedgerReportResult> {
  await delay()
  const f = mergeFilter(filter)
  const range = resolveReportRange(f)
  const tbRows = applyTrialBalanceFilter(trialBalanceStore, f)

  const rows = await Promise.all(
    tbRows.map(async (tb) => {
      let summary
      try {
        summary = await getAccountLedgerSummary(tb.accountId, {
          postingDateFrom: range.from,
          postingDateTo: range.to,
          dateQuickRange: 'custom',
        })
      } catch {
        summary = {
          openingBalance: tb.openingDebit || tb.openingCredit,
          openingSide: (tb.openingDebit >= tb.openingCredit ? 'Dr' : 'Cr') as 'Dr' | 'Cr',
          totalDebit: tb.periodDebit,
          totalCredit: tb.periodCredit,
          closingBalance: tb.closingDebit || tb.closingCredit,
          closingSide: (tb.closingDebit >= tb.closingCredit ? 'Dr' : 'Cr') as 'Dr' | 'Cr',
          entryCount: 0,
        }
      }
      return {
        accountId: tb.accountId,
        accountCode: tb.accountCode,
        accountName: tb.accountName,
        openingBalance: summary.openingBalance,
        openingSide: summary.openingSide,
        debit: summary.totalDebit,
        credit: summary.totalCredit,
        closingBalance: summary.closingBalance,
        closingSide: summary.closingSide,
        entryCount: summary.entryCount,
        drilldownHref: buildLedgerDrilldownHref(tb.accountId, range.from, range.to),
      }
    }),
  )

  return {
    companyName: FINANCIAL_REPORTS_COMPANY_NAME,
    periodLabel: range.label,
    rows,
    totalDebit: rows.reduce((s, r) => s + r.debit, 0),
    totalCredit: rows.reduce((s, r) => s + r.credit, 0),
  }
}

export async function getAccountSchedules(): Promise<AccountScheduleDefinition[]> {
  await delay()
  return clone(scheduleStore)
}

export async function getAccountScheduleById(id: string): Promise<AccountScheduleDefinition> {
  await delay()
  const schedule = scheduleStore.find((s) => s.id === id)
  if (!schedule) throw new FinancialReportsServiceError('Account schedule not found.')
  return clone(schedule)
}

export async function runAccountSchedule(
  id: string,
  filter?: Partial<FinancialReportFilter>,
): Promise<AccountScheduleRunResult> {
  await delay()
  const schedule = scheduleStore.find((s) => s.id === id)
  if (!schedule) throw new FinancialReportsServiceError('Account schedule not found.')
  const result = runScheduleDemoValues(schedule, mergeFilter(filter))
  const idx = scheduleStore.findIndex((s) => s.id === id)
  if (idx >= 0) {
    scheduleStore[idx] = { ...scheduleStore[idx], lastRunAt: result.generatedAt }
  }
  return clone(result)
}

export async function saveAccountScheduleDemo(
  def: Omit<AccountScheduleDefinition, 'isDemo' | 'lastRunAt'> & { id?: string },
): Promise<AccountScheduleDefinition> {
  await delay()
  const user = getSessionUser()
  if (def.id) {
    const idx = scheduleStore.findIndex((s) => s.id === def.id)
    if (idx < 0) throw new FinancialReportsServiceError('Account schedule not found.')
    scheduleStore[idx] = {
      ...scheduleStore[idx],
      ...def,
      isDemo: true,
      lastRunAt: scheduleStore[idx].lastRunAt,
    }
    return clone(scheduleStore[idx])
  }
  const created: AccountScheduleDefinition = {
    ...def,
    id: `asch-${Date.now()}`,
    lastRunAt: null,
    isDemo: true,
  }
  scheduleStore = [created, ...scheduleStore]
  void user
  return clone(created)
}

export async function getCostCentreProfitability(
  filter?: Partial<FinancialReportFilter>,
): Promise<CostCentreProfitabilityRow[]> {
  await delay()
  const f = mergeFilter(filter)
  return clone(
    costCentreStore.filter((r) => !f.costCentre || r.costCentreId === f.costCentre),
  )
}

export async function getDepartmentPerformance(
  filter?: Partial<FinancialReportFilter>,
): Promise<DepartmentPerformanceRow[]> {
  await delay()
  const f = mergeFilter(filter)
  return clone(
    departmentStore.filter((r) => !f.department || r.departmentId === f.department),
  )
}

export async function getProjectProfitability(
  filter?: Partial<FinancialReportFilter>,
): Promise<ProjectProfitabilityRow[]> {
  await delay()
  const f = mergeFilter(filter)
  return clone(projectStore.filter((r) => !f.project || r.projectId === f.project))
}

export async function getManufacturingCostSummary(
  filter?: Partial<FinancialReportFilter>,
): Promise<ManufacturingProfitabilityRow[]> {
  await delay()
  mergeFilter(filter)
  return clone(manufacturingStore)
}

export async function getBudgetVsActual(filter?: Partial<FinancialReportFilter>): Promise<BudgetVsActualSeries[]> {
  await delay()
  mergeFilter(filter)
  return clone(budgetStore)
}

export async function getComparativeStatements(
  filter?: Partial<FinancialReportFilter>,
): Promise<ComparativeStatementsResult> {
  await delay()
  return clone(buildComparativeStatements(mergeFilter(filter)))
}

export async function getRatioAnalysis(filter?: Partial<FinancialReportFilter>): Promise<RatioAnalysisResult> {
  await delay()
  return clone(buildRatioAnalysis(mergeFilter(filter)))
}

export async function getFinancialMis(filter?: Partial<FinancialReportFilter>): Promise<FinancialMisDashboard> {
  await delay()
  const f = mergeFilter(filter)
  const view = (f.viewMode === 'detailed' ? 'plant_dashboard' : 'executive_summary') as FinancialMisView
  return clone({
    ...misStore,
    ...seedFinancialMisSnapshot(view),
    periodLabel: resolveReportRange(f).label,
  })
}

export async function getFinancialReportSetup(): Promise<FinancialReportSetup> {
  await delay()
  return clone(setupStore)
}

export async function updateFinancialReportSetupDemo(
  patch: Partial<FinancialReportSetup>,
): Promise<FinancialReportSetup> {
  await delay()
  const user = getSessionUser()
  setupStore = {
    ...setupStore,
    ...patch,
    lastUpdatedBy: user.name,
    lastUpdatedAt: new Date().toISOString(),
  }
  return clone(setupStore)
}

export async function exportFinancialReport(
  req: FinancialReportExportRequest,
): Promise<{ filename: string; content: string; disclaimer: string }> {
  await delay()
  const disclaimer = 'Export generated in demo mode. Backend export service is not connected.'
  const stamp = new Date().toISOString().slice(0, 10)

  if (req.format === 'pdf') {
    return {
      filename: `financial-report-${req.scope}-${stamp}.txt`,
      content: `PDF export placeholder for ${req.scope}.\nUse CSV/Excel in demo mode for structured data.`,
      disclaimer,
    }
  }

  let rows: string[][] = [['Demo Financial Report', req.scope, req.format]]

  if (req.scope === 'trial_balance') {
    const data = await getTrialBalance(req.filter)
    rows = [
      ['Account Code', 'Account Name', 'Closing Dr', 'Closing Cr'],
      ...data.rows.map((r) => [r.accountCode, r.accountName, String(r.closingDebit), String(r.closingCredit)]),
    ]
  } else if (req.scope === 'profit_loss') {
    const data = await getProfitAndLoss(req.filter)
    rows = [['Code', 'Line', 'Amount']]
    for (const sec of data.sections) {
      for (const line of sec.lines) {
        rows.push([line.code, line.label, String(line.amount)])
      }
    }
  } else if (req.scope === 'budget_vs_actual') {
    const data = await getBudgetVsActual(req.filter)
    rows = [['Label', 'Budget', 'Actual', 'Variance'], ...data.map((d) => [d.label, String(d.budget), String(d.actual), String(d.variance)])]
  } else if (req.scope === 'account_schedule' && req.scheduleId) {
    const run = await runAccountSchedule(req.scheduleId, req.filter)
    rows = [['Row', ...run.columns.map((c) => c.label)]]
    for (const row of scheduleStore.find((s) => s.id === req.scheduleId)?.rows ?? []) {
      rows.push([row.description, ...run.columns.map((c) => String(run.values[row.rowCode]?.[c.id] ?? 0))])
    }
  } else if (req.scope === 'general_ledger') {
    const data = await getGeneralLedgerReport(req.filter)
    rows = [
      ['Code', 'Account', 'Debit', 'Credit', 'Closing'],
      ...data.rows.map((r) => [r.accountCode, r.accountName, String(r.debit), String(r.credit), String(r.closingBalance)]),
    ]
  } else if (req.scope === 'dashboard') {
    const data = await getFinancialReportsDashboard(req.filter)
    rows = [
      ['KPI', 'Value'],
      ['Revenue', String(data.kpis.revenue)],
      ['Net Profit', String(data.kpis.netProfit)],
      ['Current Ratio', String(data.kpis.currentRatio)],
    ]
  }

  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
  return {
    filename: `financial-report-${req.scope}-${stamp}.${req.format === 'excel' ? 'csv' : 'csv'}`,
    content: csv,
    disclaimer,
  }
}

export async function getFinancialReportPrintPreview(
  reportName: string,
  filter?: Partial<FinancialReportFilter>,
): Promise<FinancialReportPrintPreview> {
  await delay()
  const f = mergeFilter(filter)
  const range = resolveReportRange(f)
  const user = getSessionUser()
  const fyRange = resolveLedgerDateRange('this_financial_year', f.fromDate, f.toDate)

  let body = FINANCIAL_REPORTS_PERIOD_LABEL
  if (reportName.toLowerCase().includes('trial')) {
    const tb = await getTrialBalance(f)
    body = `${tb.rows.length} accounts · Closing Dr ₹${tb.totalClosingDebit.toLocaleString('en-IN')}`
  } else if (reportName.toLowerCase().includes('profit') || reportName.toLowerCase().includes('p&l')) {
    const pl = await getProfitAndLoss(f)
    body = `Net Profit ₹${pl.netProfit.toLocaleString('en-IN')}`
  } else if (reportName.toLowerCase().includes('balance')) {
    const bs = await getBalanceSheet(f)
    body = `Total Assets ₹${bs.totalAssets.toLocaleString('en-IN')} · Balanced: ${bs.isBalanced ? 'Yes' : 'No'}`
  }

  return {
    reportName,
    companyName: FINANCIAL_REPORTS_COMPANY_NAME,
    periodLabel: range.label || fyRange.label,
    generatedBy: user.name,
    generatedAt: new Date().toISOString(),
    htmlPreview: `<div><h1>${reportName}</h1><p>${FINANCIAL_REPORTS_COMPANY_NAME}</p><p>${body}</p><p><em>Demo print preview — not a statutory financial statement.</em></p></div>`,
    disclaimer: 'Print preview generated in demo mode. Backend document service is not connected.',
    isDemo: true,
  }
}

/** Optional helper — fetch ledger rows for GL report drill-down validation in tests. */
export async function getGeneralLedgerEntrySample(accountId: string, filter?: Partial<FinancialReportFilter>) {
  const f = mergeFilter(filter)
  const range = resolveReportRange(f)
  return getLedgerEntries({
    accountId,
    postingDateFrom: range.from,
    postingDateTo: range.to,
    dateQuickRange: 'custom',
  })
}
