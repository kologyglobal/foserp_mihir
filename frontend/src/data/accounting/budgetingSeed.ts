/**
 * Budgeting & Forecasting demo seed — Indian manufacturing (FY 2025-26, Chakan).
 */

import type {
  BudgetApprovalItem,
  BudgetLine,
  BudgetReportCard,
  BudgetVersion,
  BudgetingDashboard,
  BudgetingSetup,
  CapexRequest,
  CashFlowPeriodRow,
  CostCentreBudgetRow,
  DepartmentBudgetRow,
  DimensionBudgetRow,
  ExpenseBudgetRow,
  FyMonth,
  MonthlyAmounts,
  RollingForecastRow,
  BudgetVsActualRow,
} from '@/types/budgeting'
import {
  EXPENSE_CATEGORY_LABELS,
  FY_MONTHS,
  emptyMonths,
  sumMonths,
  availableBudget,
  varianceAmount,
  variancePct,
} from '@/types/budgeting'

const FY = '2025-26'
const COMPANY = { id: 'co-vasant', name: 'Vasant Trailers Pvt Ltd' }
const PLANT = { id: 'plant-chakan', name: 'Chakan Plant' }

function monthsFromAnnual(annual: number, weights?: number[]): MonthlyAmounts {
  const w = weights ?? Array(12).fill(1)
  const totalW = w.reduce((a, b) => a + b, 0)
  const m = emptyMonths()
  let allocated = 0
  FY_MONTHS.forEach((key, i) => {
    if (i === 11) {
      m[key] = Number((annual - allocated).toFixed(2))
    } else {
      const v = Number(((annual * (w[i] ?? 1)) / totalW).toFixed(2))
      m[key] = v
      allocated += v
    }
  })
  return m
}

const seasonalSales = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.1, 1.0, 0.9, 0.85, 0.8, 0.75]

export const BUDGET_VERSIONS_SEED: BudgetVersion[] = [
  {
    id: 'bv-original',
    name: 'Original Budget FY25-26',
    kind: 'original',
    financialYear: FY,
    budgetType: 'annual',
    startDate: '2025-04-01',
    endDate: '2026-03-31',
    status: 'approved',
    preparedBy: 'Anita Deshmukh',
    approvedBy: 'Ravi Kulkarni',
    lastUpdated: '2025-03-28T10:00:00+05:30',
    isPrimary: true,
    companyId: COMPANY.id,
    companyName: COMPANY.name,
    notes: 'Board-approved primary annual budget.',
  },
  {
    id: 'bv-revised',
    name: 'Revised Budget Q2',
    kind: 'revised',
    financialYear: FY,
    budgetType: 'annual',
    startDate: '2025-04-01',
    endDate: '2026-03-31',
    status: 'in_preparation',
    preparedBy: 'Anita Deshmukh',
    approvedBy: null,
    lastUpdated: '2025-09-12T14:20:00+05:30',
    isPrimary: false,
    companyId: COMPANY.id,
    companyName: COMPANY.name,
    notes: 'Mid-year revision after steel price spike.',
  },
  {
    id: 'bv-f1',
    name: 'Forecast 1',
    kind: 'forecast_1',
    financialYear: FY,
    budgetType: 'rolling',
    startDate: '2025-04-01',
    endDate: '2026-03-31',
    status: 'draft',
    preparedBy: 'Suresh Patil',
    approvedBy: null,
    lastUpdated: '2025-10-01T09:00:00+05:30',
    isPrimary: false,
    companyId: COMPANY.id,
    companyName: COMPANY.name,
    notes: '',
  },
  {
    id: 'bv-expected',
    name: 'Expected Case',
    kind: 'expected_case',
    financialYear: FY,
    budgetType: 'annual',
    startDate: '2025-04-01',
    endDate: '2026-03-31',
    status: 'pending_approval',
    preparedBy: 'Anita Deshmukh',
    approvedBy: null,
    lastUpdated: '2025-10-05T11:30:00+05:30',
    isPrimary: false,
    companyId: COMPANY.id,
    companyName: COMPANY.name,
    notes: 'Base planning scenario for H2.',
  },
  {
    id: 'bv-best',
    name: 'Best Case',
    kind: 'best_case',
    financialYear: FY,
    budgetType: 'annual',
    startDate: '2025-04-01',
    endDate: '2026-03-31',
    status: 'draft',
    preparedBy: 'Suresh Patil',
    approvedBy: null,
    lastUpdated: '2025-09-20T16:00:00+05:30',
    isPrimary: false,
    companyId: COMPANY.id,
    companyName: COMPANY.name,
    notes: 'Optimistic trailer demand.',
  },
  {
    id: 'bv-worst',
    name: 'Worst Case',
    kind: 'worst_case',
    financialYear: FY,
    budgetType: 'annual',
    startDate: '2025-04-01',
    endDate: '2026-03-31',
    status: 'draft',
    preparedBy: 'Suresh Patil',
    approvedBy: null,
    lastUpdated: '2025-09-20T16:05:00+05:30',
    isPrimary: false,
    companyId: COMPANY.id,
    companyName: COMPANY.name,
    notes: 'Demand soft + commodity inflation.',
  },
]

const lineDefs: {
  code: string
  name: string
  group: string
  dept: string
  deptName: string
  cc: string
  ccName: string
  annual: number
  py: number
  committed: number
  actual: number
}[] = [
  { code: '4100', name: 'Trailer sales', group: 'Revenue', dept: 'd-sales', deptName: 'Sales', cc: 'cc-sales', ccName: 'Sales CC', annual: 48_00_00_000, py: 42_00_00_000, committed: 0, actual: 18_50_00_000 },
  { code: '4200', name: 'Spare parts sales', group: 'Revenue', dept: 'd-sales', deptName: 'Sales', cc: 'cc-sales', ccName: 'Sales CC', annual: 3_60_00_000, py: 3_10_00_000, committed: 0, actual: 1_40_00_000 },
  { code: '5100', name: 'Raw material — steel', group: 'COGS', dept: 'd-purchase', deptName: 'Purchase', cc: 'cc-rm', ccName: 'RM Stores', annual: 22_00_00_000, py: 19_50_00_000, committed: 4_20_00_000, actual: 8_80_00_000 },
  { code: '5200', name: 'Bought-out components', group: 'COGS', dept: 'd-purchase', deptName: 'Purchase', cc: 'cc-rm', ccName: 'RM Stores', annual: 6_50_00_000, py: 5_80_00_000, committed: 1_10_00_000, actual: 2_40_00_000 },
  { code: '6100', name: 'Direct labour', group: 'Production', dept: 'd-prod', deptName: 'Production', cc: 'cc-shop', ccName: 'Shop Floor', annual: 4_80_00_000, py: 4_20_00_000, committed: 0, actual: 1_95_00_000 },
  { code: '6200', name: 'Factory overhead', group: 'Production', dept: 'd-prod', deptName: 'Production', cc: 'cc-shop', ccName: 'Shop Floor', annual: 2_40_00_000, py: 2_10_00_000, committed: 35_00_000, actual: 98_00_000 },
  { code: '7100', name: 'Employee expenses', group: 'OpEx', dept: 'd-finance', deptName: 'Finance', cc: 'cc-admin', ccName: 'Admin CC', annual: 3_20_00_000, py: 2_90_00_000, committed: 0, actual: 1_28_00_000 },
  { code: '7200', name: 'Marketing', group: 'OpEx', dept: 'd-sales', deptName: 'Sales', cc: 'cc-sales', ccName: 'Sales CC', annual: 90_00_000, py: 75_00_000, committed: 12_00_000, actual: 38_00_000 },
  { code: '7300', name: 'Travel', group: 'OpEx', dept: 'd-sales', deptName: 'Sales', cc: 'cc-sales', ccName: 'Sales CC', annual: 45_00_000, py: 40_00_000, committed: 5_00_000, actual: 18_00_000 },
  { code: '7400', name: 'Electricity & utilities', group: 'OpEx', dept: 'd-prod', deptName: 'Production', cc: 'cc-util', ccName: 'Utilities', annual: 1_20_00_000, py: 1_05_00_000, committed: 0, actual: 52_00_000 },
  { code: '8100', name: 'CAPEX — plant machinery', group: 'CAPEX', dept: 'd-prod', deptName: 'Production', cc: 'cc-eng', ccName: 'Engineering', annual: 2_50_00_000, py: 1_80_00_000, committed: 80_00_000, actual: 45_00_000 },
]

export const BUDGET_LINES_SEED: BudgetLine[] = lineDefs.map((d, i) => {
  const weights = d.group === 'Revenue' ? seasonalSales : undefined
  return {
    id: `bl-${i + 1}`,
    versionId: 'bv-original',
    accountCode: d.code,
    accountName: d.name,
    accountGroup: d.group,
    departmentId: d.dept,
    departmentName: d.deptName,
    costCentreId: d.cc,
    costCentreName: d.ccName,
    plantId: PLANT.id,
    plantName: PLANT.name,
    projectId: i === 10 ? 'prj-paint-line' : null,
    projectName: i === 10 ? 'Paint Line Expansion' : null,
    previousYearActual: d.py,
    months: monthsFromAnnual(d.annual, weights),
    committed: d.committed,
    actual: d.actual,
    notes: '',
  }
})

export const DEPARTMENT_BUDGETS_SEED: DepartmentBudgetRow[] = [
  { id: 'db-sales', versionId: 'bv-original', departmentId: 'd-sales', departmentName: 'Sales', budgetOwner: 'Neha Joshi', approvedBudget: 52_95_00_000, committed: 17_00_000, actual: 20_46_00_000, forecast: 51_50_00_000, status: 'approved' },
  { id: 'db-purchase', versionId: 'bv-original', departmentId: 'd-purchase', departmentName: 'Purchase', budgetOwner: 'Vikram Shah', approvedBudget: 28_50_00_000, committed: 5_30_00_000, actual: 11_20_00_000, forecast: 29_10_00_000, status: 'approved' },
  { id: 'db-prod', versionId: 'bv-original', departmentId: 'd-prod', departmentName: 'Production', budgetOwner: 'Prakash More', approvedBudget: 10_90_00_000, committed: 1_15_00_000, actual: 3_90_00_000, forecast: 10_50_00_000, status: 'approved' },
  { id: 'db-finance', versionId: 'bv-original', departmentId: 'd-finance', departmentName: 'Finance', budgetOwner: 'Anita Deshmukh', approvedBudget: 3_20_00_000, committed: 0, actual: 1_28_00_000, forecast: 3_15_00_000, status: 'approved' },
]

export const COST_CENTRE_BUDGETS_SEED: CostCentreBudgetRow[] = [
  { id: 'ccb-sales', versionId: 'bv-original', costCentreId: 'cc-sales', costCentreName: 'Sales CC', departmentName: 'Sales', budgetOwner: 'Neha Joshi', approvedBudget: 52_95_00_000, committed: 17_00_000, actual: 20_46_00_000, forecast: 51_50_00_000, status: 'approved' },
  { id: 'ccb-rm', versionId: 'bv-original', costCentreId: 'cc-rm', costCentreName: 'RM Stores', departmentName: 'Purchase', budgetOwner: 'Vikram Shah', approvedBudget: 28_50_00_000, committed: 5_30_00_000, actual: 11_20_00_000, forecast: 29_10_00_000, status: 'approved' },
  { id: 'ccb-shop', versionId: 'bv-original', costCentreId: 'cc-shop', costCentreName: 'Shop Floor', departmentName: 'Production', budgetOwner: 'Prakash More', approvedBudget: 7_20_00_000, committed: 35_00_000, actual: 2_93_00_000, forecast: 7_00_00_000, status: 'approved' },
  { id: 'ccb-util', versionId: 'bv-original', costCentreId: 'cc-util', costCentreName: 'Utilities', departmentName: 'Production', budgetOwner: 'Prakash More', approvedBudget: 1_20_00_000, committed: 0, actual: 52_00_000, forecast: 1_18_00_000, status: 'approved' },
  { id: 'ccb-eng', versionId: 'bv-original', costCentreId: 'cc-eng', costCentreName: 'Engineering', departmentName: 'Production', budgetOwner: 'Prakash More', approvedBudget: 2_50_00_000, committed: 80_00_000, actual: 45_00_000, forecast: 2_40_00_000, status: 'approved' },
  { id: 'ccb-admin', versionId: 'bv-original', costCentreId: 'cc-admin', costCentreName: 'Admin CC', departmentName: 'Finance', budgetOwner: 'Anita Deshmukh', approvedBudget: 3_20_00_000, committed: 0, actual: 1_28_00_000, forecast: 3_15_00_000, status: 'approved' },
]

export const DIMENSION_BUDGETS_SEED: DimensionBudgetRow[] = [
  { id: 'sb-1', kind: 'sales', category: 'Tipper trailers', periodLabel: 'FY 2025-26', budget: 28_00_00_000, actual: 10_50_00_000, forecast: 27_20_00_000, variance: 17_50_00_000, status: 'On track' },
  { id: 'sb-2', kind: 'sales', category: 'Flatbed trailers', periodLabel: 'FY 2025-26', budget: 12_00_00_000, actual: 4_80_00_000, forecast: 11_80_00_000, variance: 7_20_00_000, status: 'On track' },
  { id: 'sb-3', kind: 'sales', category: 'Spares & services', periodLabel: 'FY 2025-26', budget: 3_60_00_000, actual: 1_40_00_000, forecast: 3_50_00_000, variance: 2_20_00_000, status: 'On track' },
  { id: 'pb-1', kind: 'purchase', category: 'HR steel coils', periodLabel: 'FY 2025-26', budget: 14_00_00_000, actual: 5_60_00_000, forecast: 14_50_00_000, variance: 8_40_00_000, status: 'Watch' },
  { id: 'pb-2', kind: 'purchase', category: 'Axles & suspensions', periodLabel: 'FY 2025-26', budget: 6_50_00_000, actual: 2_40_00_000, forecast: 6_40_00_000, variance: 4_10_00_000, status: 'On track' },
  { id: 'pb-3', kind: 'purchase', category: 'Consumables', periodLabel: 'FY 2025-26', budget: 1_80_00_000, actual: 72_00_000, forecast: 1_85_00_000, variance: 1_08_00_000, status: 'On track' },
  { id: 'pr-1', kind: 'production', category: 'Fabrication hours', periodLabel: 'FY 2025-26', budget: 2_40_00_000, actual: 98_00_000, forecast: 2_35_00_000, variance: 1_42_00_000, status: 'On track' },
  { id: 'pr-2', kind: 'production', category: 'Paint shop', periodLabel: 'FY 2025-26', budget: 1_10_00_000, actual: 48_00_000, forecast: 1_15_00_000, variance: 62_00_000, status: 'Watch' },
  { id: 'pr-3', kind: 'production', category: 'Assembly', periodLabel: 'FY 2025-26', budget: 1_30_00_000, actual: 49_00_000, forecast: 1_28_00_000, variance: 81_00_000, status: 'On track' },
]

const expenseCats = Object.keys(EXPENSE_CATEGORY_LABELS) as (keyof typeof EXPENSE_CATEGORY_LABELS)[]
const expenseAnnuals = [3_20_00_000, 2_40_00_000, 85_00_000, 1_20_00_000, 48_00_000, 90_00_000, 45_00_000, 36_00_000, 72_00_000, 55_00_000, 1_10_00_000, 40_00_000]

export const EXPENSE_BUDGETS_SEED: ExpenseBudgetRow[] = expenseCats.map((cat, i) => {
  const annual = expenseAnnuals[i] ?? 40_00_000
  const actual = Number((annual * 0.4).toFixed(0))
  return {
    id: `ex-${cat}`,
    versionId: 'bv-original',
    category: cat,
    categoryLabel: EXPENSE_CATEGORY_LABELS[cat],
    recurring: !['professional_fees', 'other'].includes(cat),
    annualBudget: annual,
    months: monthsFromAnnual(annual),
    actual,
    committed: i % 3 === 0 ? Number((annual * 0.05).toFixed(0)) : 0,
    notes: '',
  }
})

export const CAPEX_SEED: CapexRequest[] = [
  {
    id: 'cx-1',
    requestNo: 'CAPEX-2025-0012',
    assetCategory: 'Plant & Machinery',
    assetDescription: 'CNC plasma cutting table',
    department: 'Production',
    plant: PLANT.name,
    requester: 'Prakash More',
    businessJustification: 'Reduce plate cutting cycle time by 25%.',
    estimatedCost: 85_00_000,
    approvedBudget: 80_00_000,
    expectedPurchaseDate: '2025-11-15',
    expectedCapitalizationDate: '2025-12-20',
    fundingSource: 'Internal accruals',
    status: 'purchase_order',
    purchaseOrderNo: 'PO-2025-0488',
    actualCost: 45_00_000,
    remainingBudget: 35_00_000,
    versionId: 'bv-original',
  },
  {
    id: 'cx-2',
    requestNo: 'CAPEX-2025-0018',
    assetCategory: 'Building',
    assetDescription: 'Paint booth expansion',
    department: 'Production',
    plant: PLANT.name,
    requester: 'Prakash More',
    businessJustification: 'Capacity for tipper paint line.',
    estimatedCost: 1_20_00_000,
    approvedBudget: 1_10_00_000,
    expectedPurchaseDate: '2026-01-10',
    expectedCapitalizationDate: '2026-03-15',
    fundingSource: 'Term loan',
    status: 'approval',
    purchaseOrderNo: null,
    actualCost: 0,
    remainingBudget: 1_10_00_000,
    versionId: 'bv-original',
  },
  {
    id: 'cx-3',
    requestNo: 'CAPEX-2025-0021',
    assetCategory: 'IT Equipment',
    assetDescription: 'Shop-floor tablets (20 units)',
    department: 'Production',
    plant: PLANT.name,
    requester: 'Suresh Patil',
    businessJustification: 'MES data capture at work centres.',
    estimatedCost: 12_00_000,
    approvedBudget: 0,
    expectedPurchaseDate: '2025-12-01',
    expectedCapitalizationDate: '2025-12-15',
    fundingSource: 'Internal accruals',
    status: 'budget_review',
    purchaseOrderNo: null,
    actualCost: 0,
    remainingBudget: 0,
    versionId: 'bv-original',
  },
]

function cashRow(id: string, period: string, opening: number, scale: number): CashFlowPeriodRow {
  const customerReceipts = Number((1_80_00_000 * scale).toFixed(0))
  const vendorPayments = Number((1_20_00_000 * scale).toFixed(0))
  const payroll = Number((28_00_000 * scale).toFixed(0))
  const gstTds = Number((22_00_000 * scale).toFixed(0))
  const loanRepayments = Number((8_00_000 * scale).toFixed(0))
  const capex = Number((15_00_000 * scale).toFixed(0))
  const operatingExpenses = Number((18_00_000 * scale).toFixed(0))
  const otherInflows = Number((2_00_000 * scale).toFixed(0))
  const otherOutflows = Number((3_00_000 * scale).toFixed(0))
  const closing =
    opening +
    customerReceipts +
    otherInflows -
    vendorPayments -
    payroll -
    gstTds -
    loanRepayments -
    capex -
    operatingExpenses -
    otherOutflows
  return {
    id,
    periodLabel: period,
    opening,
    customerReceipts,
    vendorPayments,
    payroll,
    gstTds,
    loanRepayments,
    capex,
    operatingExpenses,
    otherInflows,
    otherOutflows,
    closing,
    uncertainInflows: Number((12_00_000 * scale).toFixed(0)),
    highPriorityPayments: Number((45_00_000 * scale).toFixed(0)),
  }
}

export const CASH_FLOW_MONTHLY_SEED: CashFlowPeriodRow[] = (() => {
  const rows: CashFlowPeriodRow[] = []
  let opening = 2_85_00_000
  FY_MONTHS.forEach((m, i) => {
    const row = cashRow(`cf-m-${i}`, `${m} ${i < 9 ? '2025' : '2026'}`, opening, 0.85 + (i % 4) * 0.05)
    rows.push(row)
    opening = row.closing
  })
  return rows
})()

export const CASH_FLOW_13W_SEED: CashFlowPeriodRow[] = (() => {
  const rows: CashFlowPeriodRow[] = []
  let opening = 3_10_00_000
  for (let w = 1; w <= 13; w++) {
    const row = cashRow(`cf-w-${w}`, `Week ${w}`, opening, 0.22)
    rows.push(row)
    opening = row.closing
  }
  return rows
})()

export function buildBudgetVsActualRows(): BudgetVsActualRow[] {
  return BUDGET_LINES_SEED.map((l) => {
    const budget = sumMonths(l.months)
    const available = availableBudget(budget, l.committed, l.actual)
    const variance = varianceAmount(budget, l.actual)
    return {
      id: `bva-${l.id}`,
      dimension: 'account',
      label: l.accountName,
      code: l.accountCode,
      budget,
      committed: l.committed,
      actual: l.actual,
      available,
      variance,
      variancePct: variancePct(budget, l.actual),
      forecast: Number((budget * 0.98).toFixed(0)),
      projectedYearEndVariance: Number((budget * 0.02).toFixed(0)),
    }
  })
}

export const ROLLING_FORECAST_SEED: RollingForecastRow[] = BUDGET_LINES_SEED.slice(0, 6).map((l) => {
  const monthIsActual = Object.fromEntries(
    FY_MONTHS.map((m, i) => [m, i < 4]),
  ) as Record<FyMonth, boolean>
  const months = { ...l.months }
  // Apr–Jul use actual-ish; Aug–Mar keep budget as forecast
  ;(['Apr', 'May', 'Jun', 'Jul'] as FyMonth[]).forEach((m) => {
    months[m] = Number((l.months[m] * 0.95).toFixed(0))
  })
  return {
    id: `rf-${l.id}`,
    accountCode: l.accountCode,
    accountName: l.accountName,
    months,
    monthIsActual,
    fullYear: sumMonths(months),
    method: 'manual',
  }
})

export let APPROVALS_SEED: BudgetApprovalItem[] = [
  {
    id: 'ap-1',
    versionId: 'bv-expected',
    versionName: 'Expected Case',
    department: 'All',
    budgetOwner: 'Anita Deshmukh',
    requestedAmount: 95_00_00_000,
    previousBudget: 92_00_00_000,
    variance: 3_00_00_000,
    submittedDate: '2025-10-05',
    currentLevel: 'finance_manager',
    status: 'pending',
    comments: '',
    history: [
      { at: '2025-10-05T11:30:00+05:30', actor: 'Anita Deshmukh', action: 'Submitted', comment: 'H2 base case ready for review.' },
    ],
  },
  {
    id: 'ap-2',
    versionId: 'bv-revised',
    versionName: 'Revised Budget Q2',
    department: 'Purchase',
    budgetOwner: 'Vikram Shah',
    requestedAmount: 29_50_00_000,
    previousBudget: 28_50_00_000,
    variance: 1_00_00_000,
    submittedDate: '2025-09-18',
    currentLevel: 'department_head',
    status: 'clarification',
    comments: 'Need commodity index backup.',
    history: [
      { at: '2025-09-18T10:00:00+05:30', actor: 'Vikram Shah', action: 'Submitted', comment: 'Steel revision.' },
      { at: '2025-09-19T15:00:00+05:30', actor: 'Ravi Kulkarni', action: 'Request Clarification', comment: 'Need commodity index backup.' },
    ],
  },
]

export const BUDGET_REPORTS_SEED: BudgetReportCard[] = [
  { id: 'r1', title: 'Annual Budget Summary', description: 'Version-wise annual totals by account group.', href: '/accounting/budgeting/annual' },
  { id: 'r2', title: 'Budget vs Actual', description: 'Variance by account, department, and cost centre.', href: '/accounting/budgeting/vs-actual' },
  { id: 'r3', title: 'Department Utilization', description: 'Approved vs actual utilization by department.', href: '/accounting/budgeting/departments' },
  { id: 'r4', title: 'CAPEX Pipeline', description: 'CAPEX requests by status and remaining budget.', href: '/accounting/budgeting/capex' },
  { id: 'r5', title: '13-Week Cash Forecast', description: 'Weekly closing cash and funding gap.', href: '/accounting/budgeting/cash-flow' },
  { id: 'r6', title: 'Rolling Forecast Pack', description: 'Actual + forecast full-year view.', href: '/accounting/budgeting/rolling-forecast' },
]

export const BUDGETING_SETUP_SEED: BudgetingSetup = {
  financialYear: FY,
  fyStartMonth: 'April',
  allocationMethods: ['Equal monthly', 'Seasonal (sales-weighted)', 'Manual monthly', 'Previous-year pattern'],
  approvalMatrix: [
    { level: 'budget_owner', roleLabel: 'Budget Owner' },
    { level: 'department_head', roleLabel: 'Department Head' },
    { level: 'finance_manager', roleLabel: 'Finance Manager' },
    { level: 'cfo', roleLabel: 'CFO' },
    { level: 'management', roleLabel: 'Management' },
  ],
  minimumCashThreshold: 1_50_00_000,
  overrunAlertPct: 5,
  primaryVersionRule: 'Only one Approved primary budget per company and financial year.',
}

export function buildBudgetingDashboard(): BudgetingDashboard {
  const lines = BUDGET_LINES_SEED
  const annualBudget = lines.reduce((s, l) => s + sumMonths(l.months), 0)
  const actualYtd = lines.reduce((s, l) => s + l.actual, 0)
  const committed = lines.reduce((s, l) => s + l.committed, 0)
  const available = annualBudget - committed - actualYtd
  const revenueLines = lines.filter((l) => l.accountGroup === 'Revenue')
  const expenseLike = lines.filter((l) => l.accountGroup !== 'Revenue')
  const revBudget = revenueLines.reduce((s, l) => s + sumMonths(l.months), 0)
  const revActual = revenueLines.reduce((s, l) => s + l.actual, 0)
  const expBudget = expenseLike.reduce((s, l) => s + sumMonths(l.months), 0)
  const expActual = expenseLike.reduce((s, l) => s + l.actual, 0)

  const monthlyBudgetVsActual = FY_MONTHS.map((month, i) => ({
    month,
    budget: lines.reduce((s, l) => s + l.months[month], 0),
    actual: i < 4 ? lines.reduce((s, l) => s + Number((l.months[month] * 0.92).toFixed(0)), 0) : 0,
  }))

  return {
    kpis: {
      annualBudget,
      actualYtd,
      committed,
      available,
      utilizationPct: Number(((actualYtd / annualBudget) * 100).toFixed(1)),
      revenueVariance: revBudget - revActual,
      expenseVariance: expBudget - expActual,
      cashForecastClosing: CASH_FLOW_MONTHLY_SEED[3]?.closing ?? 0,
      pendingApprovals: APPROVALS_SEED.filter((a) => a.status === 'pending' || a.status === 'clarification').length,
    },
    monthlyBudgetVsActual,
    departmentUtilization: DEPARTMENT_BUDGETS_SEED.map((d) => ({
      name: d.departmentName,
      budget: d.approvedBudget,
      actual: d.actual,
      utilizationPct: Number(((d.actual / d.approvedBudget) * 100).toFixed(1)),
    })),
    costCentreVariance: COST_CENTRE_BUDGETS_SEED.map((c) => ({
      name: c.costCentreName,
      variance: c.approvedBudget - c.actual,
      variancePct: variancePct(c.approvedBudget, c.actual),
    })),
    expenseCategoryVariance: EXPENSE_BUDGETS_SEED.slice(0, 6).map((e) => ({
      category: e.categoryLabel,
      budget: e.annualBudget,
      actual: e.actual,
      variance: e.annualBudget - e.actual,
    })),
    capexStatus: [
      { status: 'purchase_order', count: 1, amount: 80_00_000 },
      { status: 'approval', count: 1, amount: 1_10_00_000 },
      { status: 'budget_review', count: 1, amount: 12_00_000 },
    ],
    cashForecastStrip: CASH_FLOW_MONTHLY_SEED.slice(0, 6).map((r) => ({
      period: r.periodLabel,
      closing: r.closing,
    })),
    highRiskOverruns: [
      { label: 'Raw material — steel', available: availableBudget(22_00_00_000, 4_20_00_000, 8_80_00_000), variancePct: 4.2 },
      { label: 'Paint shop (production)', available: 62_00_000, variancePct: 6.1 },
    ],
    pendingApprovals: APPROVALS_SEED.filter((a) => a.status === 'pending' || a.status === 'clarification'),
  }
}

/** Mutable working copy of annual lines for demo edits */
export let WORKING_LINES: BudgetLine[] = BUDGET_LINES_SEED.map((l) => ({
  ...l,
  months: { ...l.months },
}))

export function setWorkingLines(lines: BudgetLine[]) {
  WORKING_LINES = lines.map((l) => ({ ...l, months: { ...l.months } }))
}

export function resetWorkingLines() {
  WORKING_LINES = BUDGET_LINES_SEED.map((l) => ({ ...l, months: { ...l.months } }))
}
