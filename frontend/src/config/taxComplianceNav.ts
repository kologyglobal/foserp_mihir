/**
 * GST & TDS Compliance — canonical in-page submenu tree.
 * Matches Accounting › GST & TDS IA (sidebar/secondary nav).
 * Deep-link pages (e.g. TDS Deduction Workbench) are intentionally omitted here.
 */

export type TaxComplianceNavItem = {
  id: string
  label: string
  path: string
  /** Exact path match only (Overview) */
  end?: boolean
  group: 'overview' | 'gst' | 'tds' | 'tcs' | 'ops'
}

/** Exact order under GST & TDS — every item is clickable */
export const TAX_COMPLIANCE_NAV: TaxComplianceNavItem[] = [
  { id: 'overview', label: 'Overview', path: '/accounting/tax-compliance', end: true, group: 'overview' },
  { id: 'gst-dashboard', label: 'GST Dashboard', path: '/accounting/tax-compliance/gst', end: true, group: 'gst' },
  { id: 'outward', label: 'Outward Supplies', path: '/accounting/tax-compliance/gst/outward-supplies', group: 'gst' },
  { id: 'inward', label: 'Inward Supplies', path: '/accounting/tax-compliance/gst/inward-supplies', group: 'gst' },
  { id: 'gstr-2b', label: 'GSTR-2B', path: '/accounting/tax-compliance/gst/gstr-2b', group: 'gst' },
  { id: 'itc', label: 'ITC Reconciliation', path: '/accounting/tax-compliance/gst/itc-reconciliation', group: 'gst' },
  { id: 'gstr-1', label: 'GSTR-1', path: '/accounting/tax-compliance/gst/gstr-1', group: 'gst' },
  { id: 'gstr-3b', label: 'GSTR-3B', path: '/accounting/tax-compliance/gst/gstr-3b', group: 'gst' },
  { id: 'rcm', label: 'Reverse Charge', path: '/accounting/tax-compliance/gst/reverse-charge', group: 'gst' },
  { id: 'e-inv', label: 'E-Invoices', path: '/accounting/tax-compliance/gst/e-invoices', group: 'gst' },
  { id: 'e-way', label: 'E-Way Bills', path: '/accounting/tax-compliance/gst/e-way-bills', group: 'gst' },
  { id: 'exceptions', label: 'GST Exceptions', path: '/accounting/tax-compliance/gst/exceptions', group: 'gst' },
  { id: 'tds-dashboard', label: 'TDS Dashboard', path: '/accounting/tax-compliance/tds', end: true, group: 'tds' },
  { id: 'tds-txns', label: 'TDS Transactions', path: '/accounting/tax-compliance/tds/transactions', group: 'tds' },
  { id: 'tds-challans', label: 'TDS Challans', path: '/accounting/tax-compliance/tds/challans', group: 'tds' },
  { id: 'tds-returns', label: 'TDS Returns', path: '/accounting/tax-compliance/tds/returns', group: 'tds' },
  { id: 'tds-certs', label: 'TDS Certificates', path: '/accounting/tax-compliance/tds/certificates', group: 'tds' },
  { id: 'tds-recon', label: 'TDS Reconciliation', path: '/accounting/tax-compliance/tds/reconciliation', group: 'tds' },
  { id: 'tcs', label: 'TCS', path: '/accounting/tax-compliance/tcs', group: 'tcs' },
  { id: 'notices', label: 'Notices', path: '/accounting/tax-compliance/notices', group: 'ops' },
  { id: 'calendar', label: 'Compliance Calendar', path: '/accounting/tax-compliance/calendar', group: 'ops' },
  { id: 'reports', label: 'Reports', path: '/accounting/tax-compliance/reports', group: 'ops' },
  { id: 'setup', label: 'Setup', path: '/accounting/tax-compliance/setup', group: 'ops' },
]

/** Condensed workspace chips — secondary to the nav tree above */
export const TAX_COMPLIANCE_WORKSPACE_TABS: { id: string; label: string; path: string; end?: boolean }[] = [
  { id: 'overview', label: 'Overview', path: '/accounting/tax-compliance', end: true },
  { id: 'gst', label: 'GST', path: '/accounting/tax-compliance/gst' },
  { id: 'itc', label: 'Input Tax Credit', path: '/accounting/tax-compliance/gst/itc-reconciliation' },
  { id: 'returns', label: 'Returns', path: '/accounting/tax-compliance/gst/gstr-1' },
  { id: 'e-inv', label: 'E-Invoice', path: '/accounting/tax-compliance/gst/e-invoices' },
  { id: 'e-way', label: 'E-Way Bill', path: '/accounting/tax-compliance/gst/e-way-bills' },
  { id: 'tds', label: 'TDS', path: '/accounting/tax-compliance/tds' },
  { id: 'tcs', label: 'TCS', path: '/accounting/tax-compliance/tcs' },
  { id: 'notices', label: 'Notices', path: '/accounting/tax-compliance/notices' },
  { id: 'calendar', label: 'Calendar', path: '/accounting/tax-compliance/calendar' },
  { id: 'reports', label: 'Reports', path: '/accounting/tax-compliance/reports' },
  { id: 'setup', label: 'Setup', path: '/accounting/tax-compliance/setup' },
]

export function taxComplianceNavIsActive(pathname: string, item: TaxComplianceNavItem): boolean {
  if (item.end) return pathname === item.path || pathname === `${item.path}/`
  return pathname === item.path || pathname.startsWith(`${item.path}/`)
}

export function findTaxComplianceNavItem(pathname: string): TaxComplianceNavItem | undefined {
  return [...TAX_COMPLIANCE_NAV].reverse().find((item) => taxComplianceNavIsActive(pathname, item))
}

export function taxComplianceBreadcrumbs(pathname: string): { label: string; to?: string }[] {
  const crumbs: { label: string; to?: string }[] = [
    { label: 'Accounting', to: '/accounting' },
    { label: 'GST & TDS', to: '/accounting/tax-compliance' },
  ]
  const active = findTaxComplianceNavItem(pathname)
  if (!active || active.id === 'overview') return crumbs

  if (active.group === 'gst' && active.id !== 'gst-dashboard') {
    crumbs.push({ label: 'GST', to: '/accounting/tax-compliance/gst' })
  }
  if (active.group === 'tds' && active.id !== 'tds-dashboard') {
    crumbs.push({ label: 'TDS', to: '/accounting/tax-compliance/tds' })
  }
  crumbs.push({ label: active.label })
  return crumbs
}
