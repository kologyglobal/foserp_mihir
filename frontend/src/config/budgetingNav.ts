/**
 * Budgeting & Forecasting — canonical in-page submenu tree.
 * Matches Accounting › Budgeting & Forecasting IA (sidebar/secondary nav).
 */

export type BudgetingNavItem = {
  id: string
  label: string
  path: string
  /** Exact path match only (Overview) */
  end?: boolean
  group: 'overview' | 'prepare' | 'dimensions' | 'analyse' | 'ops'
}

/** Exact order under Budgeting & Forecasting — every item is clickable */
export const BUDGETING_NAV: BudgetingNavItem[] = [
  { id: 'overview', label: 'Overview', path: '/accounting/budgeting', end: true, group: 'overview' },
  { id: 'versions', label: 'Budget Versions', path: '/accounting/budgeting/versions', group: 'prepare' },
  { id: 'annual', label: 'Annual Budget', path: '/accounting/budgeting/annual', group: 'prepare' },
  { id: 'departments', label: 'Department Budgets', path: '/accounting/budgeting/departments', group: 'dimensions' },
  { id: 'cost-centres', label: 'Cost Centre Budgets', path: '/accounting/budgeting/cost-centres', group: 'dimensions' },
  { id: 'sales', label: 'Sales Budget', path: '/accounting/budgeting/sales', group: 'dimensions' },
  { id: 'purchase', label: 'Purchase Budget', path: '/accounting/budgeting/purchase', group: 'dimensions' },
  { id: 'production', label: 'Production Budget', path: '/accounting/budgeting/production', group: 'dimensions' },
  { id: 'expense', label: 'Expense Budget', path: '/accounting/budgeting/expense', group: 'dimensions' },
  { id: 'capex', label: 'Capital Expenditure Budget', path: '/accounting/budgeting/capex', group: 'dimensions' },
  { id: 'cash-flow', label: 'Cash Flow Forecast', path: '/accounting/budgeting/cash-flow', group: 'analyse' },
  { id: 'vs-actual', label: 'Budget vs Actual', path: '/accounting/budgeting/vs-actual', group: 'analyse' },
  { id: 'rolling', label: 'Rolling Forecast', path: '/accounting/budgeting/rolling-forecast', group: 'analyse' },
  { id: 'approvals', label: 'Budget Approvals', path: '/accounting/budgeting/approvals', group: 'ops' },
  { id: 'reports', label: 'Reports', path: '/accounting/budgeting/reports', group: 'ops' },
  { id: 'setup', label: 'Setup', path: '/accounting/budgeting/setup', group: 'ops' },
]

/** Condensed workspace chips — secondary to the nav tree above */
export const BUDGETING_WORKSPACE_TABS: { id: string; label: string; path: string; end?: boolean }[] = [
  { id: 'overview', label: 'Overview', path: '/accounting/budgeting', end: true },
  { id: 'versions', label: 'Versions', path: '/accounting/budgeting/versions' },
  { id: 'annual', label: 'Annual', path: '/accounting/budgeting/annual' },
  { id: 'cash', label: 'Cash Flow', path: '/accounting/budgeting/cash-flow' },
  { id: 'bva', label: 'vs Actual', path: '/accounting/budgeting/vs-actual' },
  { id: 'approvals', label: 'Approvals', path: '/accounting/budgeting/approvals' },
]

export function budgetingNavIsActive(pathname: string, item: BudgetingNavItem): boolean {
  if (item.end) return pathname === item.path || pathname === `${item.path}/`
  return pathname === item.path || pathname.startsWith(`${item.path}/`)
}

export function findBudgetingNavItem(pathname: string): BudgetingNavItem | undefined {
  return [...BUDGETING_NAV].reverse().find((item) => budgetingNavIsActive(pathname, item))
}

export function budgetingBreadcrumbs(pathname: string): { label: string; to?: string }[] {
  const crumbs: { label: string; to?: string }[] = [
    { label: 'Accounting', to: '/accounting' },
    { label: 'Budgeting & Forecasting', to: '/accounting/budgeting' },
  ]
  const active = findBudgetingNavItem(pathname)
  if (!active || active.id === 'overview') return crumbs
  crumbs.push({ label: active.label })
  return crumbs
}
