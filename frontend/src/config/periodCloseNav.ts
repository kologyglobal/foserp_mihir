/**
 * Period Close — canonical in-page submenu tree.
 * Matches Accounting › Period Close IA (sidebar/secondary nav).
 */

export type PeriodCloseNavItem = {
  id: string
  label: string
  path: string
  end?: boolean
  group: 'overview' | 'execution' | 'adjustments' | 'control' | 'ops'
}

/** Exact order under Period Close — every item is clickable */
export const PERIOD_CLOSE_NAV: PeriodCloseNavItem[] = [
  { id: 'dashboard', label: 'Close Dashboard', path: '/accounting/period-close', end: true, group: 'overview' },
  { id: 'calendar', label: 'Close Calendar', path: '/accounting/period-close/calendar', group: 'overview' },
  { id: 'checklist', label: 'Close Checklist', path: '/accounting/period-close/checklist', group: 'execution' },
  {
    id: 'subledger',
    label: 'Subledger Reconciliation',
    path: '/accounting/period-close/subledger-reconciliation',
    group: 'execution',
  },
  { id: 'inventory', label: 'Inventory Close', path: '/accounting/period-close/inventory', group: 'execution' },
  {
    id: 'manufacturing',
    label: 'Manufacturing Close',
    path: '/accounting/period-close/manufacturing',
    group: 'execution',
  },
  { id: 'fixed-assets', label: 'Fixed Asset Close', path: '/accounting/period-close/fixed-assets', group: 'execution' },
  {
    id: 'bank',
    label: 'Bank Reconciliation Status',
    path: '/accounting/period-close/bank-reconciliation',
    group: 'execution',
  },
  { id: 'gst-tds', label: 'GST & TDS Review', path: '/accounting/period-close/gst-tds-review', group: 'execution' },
  { id: 'accruals', label: 'Provisions & Accruals', path: '/accounting/period-close/accruals', group: 'adjustments' },
  { id: 'prepaid', label: 'Prepaid Expenses', path: '/accounting/period-close/prepaid', group: 'adjustments' },
  {
    id: 'fx',
    label: 'Foreign Exchange Revaluation',
    path: '/accounting/period-close/fx-revaluation',
    group: 'adjustments',
  },
  {
    id: 'trial-balance',
    label: 'Trial Balance Review',
    path: '/accounting/period-close/trial-balance',
    group: 'adjustments',
  },
  { id: 'locking', label: 'Period Locking', path: '/accounting/period-close/period-locking', group: 'control' },
  { id: 'year-end', label: 'Year-End Closing', path: '/accounting/period-close/year-end', group: 'control' },
  { id: 'reopen', label: 'Reopen Requests', path: '/accounting/period-close/reopen-requests', group: 'control' },
  { id: 'reports', label: 'Close Reports', path: '/accounting/period-close/reports', group: 'ops' },
  { id: 'setup', label: 'Close Setup', path: '/accounting/period-close/setup', group: 'ops' },
]

export const PERIOD_CLOSE_WORKSPACE_TABS: { id: string; label: string; path: string; end?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/accounting/period-close', end: true },
  { id: 'checklist', label: 'Checklist', path: '/accounting/period-close/checklist' },
  { id: 'recon', label: 'Reconciliation', path: '/accounting/period-close/subledger-reconciliation' },
  { id: 'accruals', label: 'Accruals', path: '/accounting/period-close/accruals' },
  { id: 'locking', label: 'Locking', path: '/accounting/period-close/period-locking' },
  { id: 'year-end', label: 'Year-End', path: '/accounting/period-close/year-end' },
  { id: 'reports', label: 'Reports', path: '/accounting/period-close/reports' },
  { id: 'setup', label: 'Setup', path: '/accounting/period-close/setup' },
]

export function periodCloseNavIsActive(pathname: string, item: PeriodCloseNavItem): boolean {
  if (item.end) return pathname === item.path || pathname === `${item.path}/`
  return pathname === item.path || pathname.startsWith(`${item.path}/`)
}

export function findPeriodCloseNavItem(pathname: string): PeriodCloseNavItem | undefined {
  return [...PERIOD_CLOSE_NAV].reverse().find((item) => periodCloseNavIsActive(pathname, item))
}

export function periodCloseBreadcrumbs(pathname: string): { label: string; to?: string }[] {
  const crumbs: { label: string; to?: string }[] = [
    { label: 'Accounting', to: '/accounting' },
    { label: 'Period Close', to: '/accounting/period-close' },
  ]
  const active = findPeriodCloseNavItem(pathname)
  if (!active || active.id === 'dashboard') return crumbs
  crumbs.push({ label: active.label })
  return crumbs
}
