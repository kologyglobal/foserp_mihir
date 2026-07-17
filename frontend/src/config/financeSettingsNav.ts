/**
 * Finance settings workspace navigation.
 */

export type FinanceSettingsNavItem = {
  id: string
  label: string
  path: string
  end?: boolean
  group?: string
}

export const FINANCE_SETTINGS_NAV: FinanceSettingsNavItem[] = [
  { id: 'overview', label: 'Overview', path: '/accounting/settings', end: true },
  { id: 'setup', label: 'Setup Wizard', path: '/accounting/settings/setup' },
  { id: 'legal-entities', label: 'Legal Entities', path: '/accounting/settings/legal-entities', group: 'Organisation' },
  { id: 'branches', label: 'Branches', path: '/accounting/settings/branches', group: 'Organisation' },
  { id: 'financial-years', label: 'Financial Years', path: '/accounting/settings/financial-years' },
  { id: 'periods', label: 'Periods', path: '/accounting/settings/periods' },
  { id: 'chart-of-accounts', label: 'Chart of Accounts', path: '/accounting/settings/chart-of-accounts' },
  { id: 'default-mappings', label: 'Account Mapping', path: '/accounting/settings/default-mappings' },
  { id: 'number-series', label: 'Number Series', path: '/accounting/settings/number-series' },
  { id: 'cost-centres', label: 'Cost Centres', path: '/accounting/settings/cost-centres' },
  { id: 'approval-rules', label: 'Approvals', path: '/accounting/settings/approval-rules' },
  { id: 'features', label: 'Features', path: '/accounting/settings/features' },
]

/** Horizontal DynamicsTabs in FinanceSettingsShell */
export const FINANCE_SETTINGS_WORKSPACE_TABS: FinanceSettingsNavItem[] = [
  { id: 'overview', label: 'Overview', path: '/accounting/settings', end: true },
  { id: 'setup', label: 'Wizard', path: '/accounting/settings/setup' },
  { id: 'legal-entities', label: 'Organisation', path: '/accounting/settings/legal-entities' },
  { id: 'financial-years', label: 'Years', path: '/accounting/settings/financial-years' },
  { id: 'periods', label: 'Periods', path: '/accounting/settings/periods' },
  { id: 'chart-of-accounts', label: 'CoA', path: '/accounting/settings/chart-of-accounts' },
  { id: 'default-mappings', label: 'Mapping', path: '/accounting/settings/default-mappings' },
  { id: 'number-series', label: 'Series', path: '/accounting/settings/number-series' },
  { id: 'cost-centres', label: 'Cost Centres', path: '/accounting/settings/cost-centres' },
  { id: 'approval-rules', label: 'Approvals', path: '/accounting/settings/approval-rules' },
  { id: 'features', label: 'Features', path: '/accounting/settings/features' },
]

export function financeSettingsNavIsActive(pathname: string, item: FinanceSettingsNavItem): boolean {
  if (item.end) return pathname === item.path || pathname === `${item.path}/`
  return pathname === item.path || pathname.startsWith(`${item.path}/`)
}

export function findFinanceSettingsNavItem(pathname: string): FinanceSettingsNavItem | undefined {
  return [...FINANCE_SETTINGS_NAV].reverse().find((item) => financeSettingsNavIsActive(pathname, item))
}

export function financeSettingsBreadcrumbs(pathname: string): { label: string; to?: string }[] {
  const crumbs: { label: string; to?: string }[] = [
    { label: 'Accounting', to: '/accounting' },
    { label: 'Finance Setup', to: '/accounting/settings' },
  ]
  const active = findFinanceSettingsNavItem(pathname)
  if (!active || active.id === 'overview') return crumbs
  crumbs.push({ label: active.label })
  return crumbs
}
