/**
 * Financial Reports — frontend models (demo / UI only).
 * Indian manufacturing context; FY 1 Apr – 31 Mar.
 * Prepared for future Node.js / MySQL API mapping.
 * Does NOT produce statutory filings or real consolidation.
 */

import { getIndianFinancialYear } from '../utils/accounting/indianFinancialYear'

export type FinancialReportWorkspaceTab =
  | 'overview'
  | 'trial_balance'
  | 'profit_loss'
  | 'balance_sheet'
  | 'cash_flow'
  | 'general_ledger'
  | 'account_schedules'
  | 'cost_centre'
  | 'department'
  | 'project'
  | 'manufacturing'
  | 'budget_vs_actual'
  | 'comparative'
  | 'ratios'
  | 'financial_mis'
  | 'setup'

export const FINANCIAL_REPORT_WORKSPACE_TABS: {
  id: FinancialReportWorkspaceTab
  label: string
  path: string
}[] = [
  { id: 'overview', label: 'Overview', path: '/accounting/reports' },
  { id: 'trial_balance', label: 'Trial Balance', path: '/accounting/reports/trial-balance' },
  { id: 'profit_loss', label: 'Profit & Loss', path: '/accounting/reports/profit-loss' },
  { id: 'balance_sheet', label: 'Balance Sheet', path: '/accounting/reports/balance-sheet' },
  { id: 'cash_flow', label: 'Cash Flow Statement', path: '/accounting/reports/cash-flow' },
  { id: 'general_ledger', label: 'General Ledger Report', path: '/accounting/reports/general-ledger' },
  { id: 'account_schedules', label: 'Account Schedules', path: '/accounting/reports/account-schedules' },
  { id: 'cost_centre', label: 'Cost Centre Profitability', path: '/accounting/reports/cost-centre' },
  { id: 'department', label: 'Department Performance', path: '/accounting/reports/department' },
  { id: 'project', label: 'Project Profitability', path: '/accounting/reports/project' },
  { id: 'manufacturing', label: 'Manufacturing Cost Summary', path: '/accounting/reports/manufacturing' },
  { id: 'budget_vs_actual', label: 'Budget vs Actual', path: '/accounting/reports/budget-vs-actual' },
  { id: 'comparative', label: 'Comparative Statements', path: '/accounting/reports/comparative' },
  { id: 'ratios', label: 'Ratio Analysis', path: '/accounting/reports/ratios' },
  { id: 'financial_mis', label: 'Financial MIS', path: '/accounting/reports/mis' },
  { id: 'setup', label: 'Report Setup', path: '/accounting/reports/setup' },
]

export type FinancialReportComparisonMode =
  | 'none'
  | 'previous_year'
  | 'budget'
  | 'monthly'
  | 'quarterly'
  | 'ytd'

export type FinancialReportViewMode = 'summary' | 'detailed' | 'consolidated'

export interface FinancialReportFilter {
  fy: string
  fromDate: string
  toDate: string
  location: string
  plant: string
  department: string
  costCentre: string
  project: string
  accountGroup: string
  includeZeroBalance: boolean
  comparisonMode: FinancialReportComparisonMode
  viewMode: FinancialReportViewMode
}

const fy = getIndianFinancialYear()

export const DEFAULT_FINANCIAL_REPORT_FILTER: FinancialReportFilter = {
  fy: fy.label,
  fromDate: fy.startDate,
  toDate: fy.endDate < new Date().toISOString().slice(0, 10) ? fy.endDate : new Date().toISOString().slice(0, 10),
  location: '',
  plant: '',
  department: '',
  costCentre: '',
  project: '',
  accountGroup: '',
  includeZeroBalance: false,
  comparisonMode: 'none',
  viewMode: 'summary',
}

export interface FinancialReportsDashboardKpis {
  revenue: number
  grossProfit: number
  ebitda: number
  netProfit: number
  totalAssets: number
  totalLiabilities: number
  workingCapital: number
  cashAndBank: number
  receivables: number
  payables: number
  inventoryValue: number
  currentRatio: number
}

export interface FinancialReportsDashboardData {
  kpis: FinancialReportsDashboardKpis
  monthlyTrend: { month: string; revenue: number; expenses: number; netProfit: number }[]
  expenseByCategory: { category: string; amount: number }[]
  budgetVsActual: { label: string; budget: number; actual: number; variance: number }[]
  receivablesVsPayables: { month: string; receivables: number; payables: number }[]
  plantProfitability: { plant: string; revenue: number; contribution: number; marginPct: number }[]
  productCategoryProfitability: { category: string; revenue: number; marginPct: number }[]
  alerts: {
    id: string
    type: string
    severity: 'info' | 'warning' | 'critical'
    title: string
    description: string
    href: string
  }[]
}

export interface TrialBalanceRow {
  accountId: string
  accountCode: string
  accountName: string
  accountGroup: string
  openingDebit: number
  openingCredit: number
  periodDebit: number
  periodCredit: number
  closingDebit: number
  closingCredit: number
}

export interface TrialBalanceResult {
  companyName: string
  periodLabel: string
  asOfDate: string
  rows: TrialBalanceRow[]
  totalOpeningDebit: number
  totalOpeningCredit: number
  totalPeriodDebit: number
  totalPeriodCredit: number
  totalClosingDebit: number
  totalClosingCredit: number
  isBalanced: boolean
}

export interface StatementLine {
  code: string
  label: string
  amount: number
  priorAmount?: number
  budgetAmount?: number
  variance?: number
  variancePct?: number
  indent: number
  bold: boolean
  underline: boolean
  isTotal: boolean
  isHeader: boolean
  accountId?: string
  accountRange?: string
  signReversed?: boolean
  hide?: boolean
}

export interface ProfitLossStatement {
  companyName: string
  periodLabel: string
  priorPeriodLabel?: string
  budgetLabel?: string
  sections: { id: string; title: string; lines: StatementLine[] }[]
  netProfit: number
  priorNetProfit?: number
}

export interface BalanceSheetStatement {
  companyName: string
  periodLabel: string
  priorPeriodLabel?: string
  asOfDate: string
  sections: { id: string; title: string; lines: StatementLine[] }[]
  totalAssets: number
  totalLiabilitiesAndEquity: number
  isBalanced: boolean
}

export type CashFlowSection = 'Operating' | 'Investing' | 'Financing'

export interface CashFlowStatement {
  companyName: string
  periodLabel: string
  openingCash: number
  closingCash: number
  netChangeInCash: number
  sections: {
    section: CashFlowSection
    lines: StatementLine[]
    subtotal: number
  }[]
}

export type AccountScheduleTotalingType =
  | 'PostingAccounts'
  | 'Total'
  | 'Formula'
  | 'Underline'
  | 'Blank'

export type AccountScheduleColumnType =
  | 'CurrentMonth'
  | 'PreviousMonth'
  | 'CurrentYear'
  | 'PreviousYear'
  | 'Budget'
  | 'Variance'
  | 'VariancePct'

export interface AccountScheduleRow {
  rowCode: string
  description: string
  totalingType: AccountScheduleTotalingType
  accountRange: string
  formula: string
  show: boolean
  indent: number
  bold: boolean
  underline: boolean
  signReversal: boolean
}

export interface AccountScheduleColumn {
  id: string
  label: string
  columnType: AccountScheduleColumnType
}

export interface AccountScheduleDefinition {
  id: string
  code: string
  name: string
  description: string
  category: string
  columns: AccountScheduleColumn[]
  rows: AccountScheduleRow[]
  active: boolean
  lastRunAt: string | null
  isDemo: boolean
}

export interface AccountScheduleRunResult {
  scheduleId: string
  scheduleName: string
  periodLabel: string
  columns: AccountScheduleColumn[]
  values: Record<string, Record<string, number>>
  generatedAt: string
}

export interface ManufacturingProfitabilityRow {
  productCategory: string
  unitsProduced: number
  revenue: number
  materialCost: number
  labourCost: number
  overhead: number
  grossProfit: number
  marginPct: number
}

export interface CostCentreProfitabilityRow {
  costCentreId: string
  costCentreCode: string
  costCentreName: string
  revenue: number
  directCost: number
  overhead: number
  netContribution: number
  marginPct: number
}

export interface DepartmentPerformanceRow {
  departmentId: string
  departmentCode: string
  departmentName: string
  budget: number
  actual: number
  variance: number
  variancePct: number
  headcount: number
}

export interface ProjectProfitabilityRow {
  projectId: string
  projectCode: string
  projectName: string
  customer: string
  revenue: number
  cost: number
  netResult: number
  marginPct: number
  status: string
}

export interface BudgetVsActualSeries {
  label: string
  category: string
  budget: number
  actual: number
  variance: number
  variancePct: number
}

export interface ComparativeStatementColumn {
  id: string
  label: string
  amount: number
}

export interface ComparativeStatementRow {
  code: string
  label: string
  indent: number
  values: Record<string, number>
  isTotal: boolean
}

export interface ComparativeStatementsResult {
  statementType: 'profit_loss' | 'balance_sheet'
  periodLabel: string
  columns: ComparativeStatementColumn[]
  rows: ComparativeStatementRow[]
}

export interface RatioAnalysisItem {
  id: string
  category: string
  name: string
  formula: string
  value: number
  unit: string
  priorValue?: number
  benchmark?: number
  status: 'good' | 'watch' | 'critical'
  note?: string
}

export interface RatioAnalysisResult {
  periodLabel: string
  asOfDate: string
  categories: { category: string; items: RatioAnalysisItem[] }[]
}

export type FinancialMisView =
  | 'executive_summary'
  | 'plant_dashboard'
  | 'working_capital'
  | 'cash_forecast'
  | 'margin_analysis'

export interface FinancialMisDashboard {
  view: FinancialMisView
  periodLabel: string
  generatedAt: string
  headline: string
  kpis: { label: string; value: number; unit: string; trendPct?: number }[]
  charts: {
    id: string
    title: string
    type: 'bar' | 'line' | 'pie'
    data: { label: string; value: number }[]
  }[]
  highlights: string[]
  risks: string[]
}

export interface FinancialReportSetup {
  defaultFy: string
  defaultComparisonMode: FinancialReportComparisonMode
  defaultViewMode: FinancialReportViewMode
  showZeroBalanceAccounts: boolean
  roundToNearest: 1 | 100 | 1000
  currencyDisplay: 'actual' | 'lakhs' | 'crores'
  includeProvisionalEntries: boolean
  consolidatePlants: boolean
  watermarkDemoReports: boolean
  exportFormats: ('csv' | 'excel' | 'pdf')[]
  scheduleEmailRecipients: string[]
  lastUpdatedBy: string
  lastUpdatedAt: string
}

export type FinancialReportExportScope =
  | 'dashboard'
  | 'trial_balance'
  | 'profit_loss'
  | 'balance_sheet'
  | 'cash_flow'
  | 'general_ledger'
  | 'account_schedule'
  | 'cost_centre'
  | 'department'
  | 'project'
  | 'manufacturing'
  | 'budget_vs_actual'
  | 'comparative'
  | 'ratios'
  | 'mis'

export interface FinancialReportExportRequest {
  scope: FinancialReportExportScope
  format: 'csv' | 'excel' | 'pdf'
  filter?: Partial<FinancialReportFilter>
  scheduleId?: string
  reportName?: string
}

export interface GeneralLedgerReportRow {
  accountId: string
  accountCode: string
  accountName: string
  openingBalance: number
  openingSide: 'Dr' | 'Cr'
  debit: number
  credit: number
  closingBalance: number
  closingSide: 'Dr' | 'Cr'
  entryCount: number
  drilldownHref: string
}

export interface GeneralLedgerReportResult {
  companyName: string
  periodLabel: string
  rows: GeneralLedgerReportRow[]
  totalDebit: number
  totalCredit: number
}

export interface FinancialReportLookups {
  financialYears: { label: string; startDate: string; endDate: string }[]
  plants: { id: string; code: string; name: string }[]
  locations: { id: string; code: string; name: string }[]
  departments: { id: string; code: string; name: string }[]
  costCentres: { id: string; code: string; name: string }[]
  projects: { id: string; code: string; name: string }[]
  accountGroups: { code: string; name: string }[]
}

export interface FinancialReportPrintPreview {
  reportName: string
  companyName: string
  periodLabel: string
  generatedBy: string
  generatedAt: string
  htmlPreview: string
  disclaimer: string
  isDemo: boolean
}
