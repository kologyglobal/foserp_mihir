/**
 * GST & TDS Compliance — live extract + e-invoice / e-way only.
 * Filing (GSTR-1/3B/2B), ITC, TDS/TCS, notices, calendar, tax reports/setup removed.
 */

export type TaxComplianceNavItem = {
  id: string
  label: string
  path: string
  /** Exact path match only (Overview) */
  end?: boolean
  group: 'overview' | 'gst'
}

/** Exact order under GST & TDS — every item is clickable */
export const TAX_COMPLIANCE_NAV: TaxComplianceNavItem[] = [
  { id: 'overview', label: 'Overview', path: '/accounting/tax-compliance', end: true, group: 'overview' },
  { id: 'gst-dashboard', label: 'GST Dashboard', path: '/accounting/tax-compliance/gst', end: true, group: 'gst' },
  { id: 'outward', label: 'Outward Supplies', path: '/accounting/tax-compliance/gst/outward-supplies', group: 'gst' },
  { id: 'inward', label: 'Inward Supplies', path: '/accounting/tax-compliance/gst/inward-supplies', group: 'gst' },
  { id: 'e-inv', label: 'E-Invoices', path: '/accounting/tax-compliance/gst/e-invoices', group: 'gst' },
  { id: 'e-way', label: 'E-Way Bills', path: '/accounting/tax-compliance/gst/e-way-bills', group: 'gst' },
]

/** Condensed workspace chips — secondary to the nav tree above */
export const TAX_COMPLIANCE_WORKSPACE_TABS: { id: string; label: string; path: string; end?: boolean }[] = [
  { id: 'overview', label: 'Overview', path: '/accounting/tax-compliance', end: true },
  { id: 'gst', label: 'GST', path: '/accounting/tax-compliance/gst' },
  { id: 'e-inv', label: 'E-Invoice', path: '/accounting/tax-compliance/gst/e-invoices' },
  { id: 'e-way', label: 'E-Way Bill', path: '/accounting/tax-compliance/gst/e-way-bills' },
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
  crumbs.push({ label: active.label })
  return crumbs
}
