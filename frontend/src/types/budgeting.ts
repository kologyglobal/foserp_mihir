/**
 * Budgeting & Forecasting — frontend demo types.
 * No GL posting / commitment engine; UI + mock service only.
 */

export type BudgetVersionKind =
  | 'original'
  | 'revised'
  | 'forecast_1'
  | 'forecast_2'
  | 'best_case'
  | 'expected_case'
  | 'worst_case'

export type BudgetVersionStatus =
  | 'draft'
  | 'in_preparation'
  | 'pending_approval'
  | 'approved'
  | 'locked'
  | 'superseded'
  | 'cancelled'

export type BudgetType = 'annual' | 'department' | 'capex' | 'cash_flow' | 'rolling'

export type ExpenseCategory =
  | 'employee'
  | 'factory_overhead'
  | 'repairs_maintenance'
  | 'electricity_utilities'
  | 'rent'
  | 'marketing'
  | 'travel'
  | 'professional_fees'
  | 'freight'
  | 'administrative'
  | 'finance_costs'
  | 'other'

export type CapexStatus =
  | 'request'
  | 'budget_review'
  | 'approval'
  | 'purchase_requisition'
  | 'purchase_order'
  | 'capitalization'
  | 'budget_vs_actual'
  | 'rejected'
  | 'cancelled'

export type ApprovalLevel = 'budget_owner' | 'department_head' | 'finance_manager' | 'cfo' | 'management'

export type ApprovalWorkStatus = 'pending' | 'approved' | 'rejected' | 'sent_back' | 'clarification'

export type ForecastMethod =
  | 'manual'
  | 'previous_trend'
  | 'growth_pct'
  | 'average_run_rate'
  | 'seasonal'
  | 'best_case'
  | 'expected_case'
  | 'worst_case'

export type CashFlowView = 'daily' | 'weekly' | 'monthly' | 'thirteen_week'

export type BvaDimension = 'account' | 'department' | 'cost_centre' | 'plant' | 'project'

export type BvaPeriodView = 'monthly' | 'quarterly' | 'ytd'

export const FY_MONTHS = [
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
  'Jan',
  'Feb',
  'Mar',
] as const

export type FyMonth = (typeof FY_MONTHS)[number]

export type MonthlyAmounts = Record<FyMonth, number>

export interface BudgetVersion {
  id: string
  name: string
  kind: BudgetVersionKind
  financialYear: string
  budgetType: BudgetType
  startDate: string
  endDate: string
  status: BudgetVersionStatus
  preparedBy: string
  approvedBy: string | null
  lastUpdated: string
  isPrimary: boolean
  companyId: string
  companyName: string
  notes: string
}

export interface BudgetLine {
  id: string
  versionId: string
  accountCode: string
  accountName: string
  accountGroup: string
  departmentId: string
  departmentName: string
  costCentreId: string
  costCentreName: string
  plantId: string
  plantName: string
  projectId: string | null
  projectName: string | null
  previousYearActual: number
  months: MonthlyAmounts
  committed: number
  actual: number
  notes: string
}

export interface DepartmentBudgetRow {
  id: string
  versionId: string
  departmentId: string
  departmentName: string
  budgetOwner: string
  approvedBudget: number
  committed: number
  actual: number
  forecast: number
  status: BudgetVersionStatus
}

export interface CostCentreBudgetRow {
  id: string
  versionId: string
  costCentreId: string
  costCentreName: string
  departmentName: string
  budgetOwner: string
  approvedBudget: number
  committed: number
  actual: number
  forecast: number
  status: BudgetVersionStatus
}

export interface DimensionBudgetRow {
  id: string
  kind: 'sales' | 'purchase' | 'production'
  category: string
  periodLabel: string
  budget: number
  actual: number
  forecast: number
  variance: number
  status: string
}

export interface ExpenseBudgetRow {
  id: string
  versionId: string
  category: ExpenseCategory
  categoryLabel: string
  recurring: boolean
  annualBudget: number
  months: MonthlyAmounts
  actual: number
  committed: number
  notes: string
}

export interface CapexRequest {
  id: string
  requestNo: string
  assetCategory: string
  assetDescription: string
  department: string
  plant: string
  requester: string
  businessJustification: string
  estimatedCost: number
  approvedBudget: number
  expectedPurchaseDate: string
  expectedCapitalizationDate: string
  fundingSource: string
  status: CapexStatus
  purchaseOrderNo: string | null
  actualCost: number
  remainingBudget: number
  versionId: string
}

export interface CashFlowPeriodRow {
  id: string
  periodLabel: string
  opening: number
  customerReceipts: number
  vendorPayments: number
  payroll: number
  gstTds: number
  loanRepayments: number
  capex: number
  operatingExpenses: number
  otherInflows: number
  otherOutflows: number
  closing: number
  uncertainInflows: number
  highPriorityPayments: number
}

export interface CashFlowSummary {
  view: CashFlowView
  rows: CashFlowPeriodRow[]
  surplus: number
  shortfall: number
  minimumCashThreshold: number
  fundingRequirement: number
}

export interface BudgetVsActualRow {
  id: string
  dimension: BvaDimension
  label: string
  code: string
  budget: number
  committed: number
  actual: number
  available: number
  variance: number
  variancePct: number
  forecast: number
  projectedYearEndVariance: number
}

export interface RollingForecastRow {
  id: string
  accountCode: string
  accountName: string
  months: MonthlyAmounts
  /** true = actual locked month */
  monthIsActual: Record<FyMonth, boolean>
  fullYear: number
  method: ForecastMethod
}

export interface BudgetApprovalItem {
  id: string
  versionId: string
  versionName: string
  department: string
  budgetOwner: string
  requestedAmount: number
  previousBudget: number
  variance: number
  submittedDate: string
  currentLevel: ApprovalLevel
  status: ApprovalWorkStatus
  comments: string
  history: { at: string; actor: string; action: string; comment: string }[]
}

export interface BudgetingKpis {
  annualBudget: number
  actualYtd: number
  committed: number
  available: number
  utilizationPct: number
  revenueVariance: number
  expenseVariance: number
  cashForecastClosing: number
  pendingApprovals: number
}

export interface BudgetingDashboard {
  kpis: BudgetingKpis
  monthlyBudgetVsActual: { month: FyMonth; budget: number; actual: number }[]
  departmentUtilization: { name: string; budget: number; actual: number; utilizationPct: number }[]
  costCentreVariance: { name: string; variance: number; variancePct: number }[]
  expenseCategoryVariance: { category: string; budget: number; actual: number; variance: number }[]
  capexStatus: { status: CapexStatus; count: number; amount: number }[]
  cashForecastStrip: { period: string; closing: number }[]
  highRiskOverruns: { label: string; available: number; variancePct: number }[]
  pendingApprovals: BudgetApprovalItem[]
}

export interface BudgetReportCard {
  id: string
  title: string
  description: string
  href: string
}

export interface BudgetingSetup {
  financialYear: string
  fyStartMonth: string
  allocationMethods: string[]
  approvalMatrix: { level: ApprovalLevel; roleLabel: string }[]
  minimumCashThreshold: number
  overrunAlertPct: number
  primaryVersionRule: string
}

export interface AnnualGridFilters {
  versionId: string
  departmentId?: string
  costCentreId?: string
  plantId?: string
  projectId?: string
  accountGroup?: string
  search?: string
}

export function sumMonths(m: MonthlyAmounts): number {
  return FY_MONTHS.reduce((s, key) => s + (m[key] ?? 0), 0)
}

export function emptyMonths(fill = 0): MonthlyAmounts {
  return Object.fromEntries(FY_MONTHS.map((k) => [k, fill])) as MonthlyAmounts
}

export function availableBudget(budget: number, committed: number, actual: number): number {
  return budget - committed - actual
}

export function varianceAmount(budget: number, actual: number): number {
  return budget - actual
}

export function variancePct(budget: number, actual: number): number {
  if (!budget) return actual ? -100 : 0
  return Number((((budget - actual) / budget) * 100).toFixed(1))
}

export const BUDGET_VERSION_KIND_LABELS: Record<BudgetVersionKind, string> = {
  original: 'Original Budget',
  revised: 'Revised Budget',
  forecast_1: 'Forecast 1',
  forecast_2: 'Forecast 2',
  best_case: 'Best Case',
  expected_case: 'Expected Case',
  worst_case: 'Worst Case',
}

export const BUDGET_VERSION_STATUS_LABELS: Record<BudgetVersionStatus, string> = {
  draft: 'Draft',
  in_preparation: 'In Preparation',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  locked: 'Locked',
  superseded: 'Superseded',
  cancelled: 'Cancelled',
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  employee: 'Employee expenses',
  factory_overhead: 'Factory overhead',
  repairs_maintenance: 'Repairs and maintenance',
  electricity_utilities: 'Electricity and utilities',
  rent: 'Rent',
  marketing: 'Marketing',
  travel: 'Travel',
  professional_fees: 'Professional fees',
  freight: 'Freight',
  administrative: 'Administrative expenses',
  finance_costs: 'Finance costs',
  other: 'Other expenses',
}

export const CAPEX_STATUS_LABELS: Record<CapexStatus, string> = {
  request: 'CAPEX Request',
  budget_review: 'Budget Review',
  approval: 'Approval',
  purchase_requisition: 'Purchase Requisition',
  purchase_order: 'Purchase Order',
  capitalization: 'Asset Capitalization',
  budget_vs_actual: 'Budget vs Actual',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export const APPROVAL_LEVEL_LABELS: Record<ApprovalLevel, string> = {
  budget_owner: 'Budget Owner',
  department_head: 'Department Head',
  finance_manager: 'Finance Manager',
  cfo: 'CFO',
  management: 'Management',
}

export const FORECAST_METHOD_LABELS: Record<ForecastMethod, string> = {
  manual: 'Manual',
  previous_trend: 'Previous-period trend',
  growth_pct: 'Growth percentage',
  average_run_rate: 'Average run rate',
  seasonal: 'Seasonal pattern',
  best_case: 'Best case',
  expected_case: 'Expected case',
  worst_case: 'Worst case',
}
