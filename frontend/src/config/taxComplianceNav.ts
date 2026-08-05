/**
 * GST & TDS Compliance — live extract, ledger registers, GSTR prep, e-invoice / e-way.
 * Honest labels: preparation only — not portal filing.
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
  { id: 'sales-reg', label: 'Sales Register', path: '/accounting/tax-compliance/gst/registers/sales', group: 'gst' },
  { id: 'purchase-reg', label: 'Purchase Register', path: '/accounting/tax-compliance/gst/registers/purchase', group: 'gst' },
  { id: 'rcm-reg', label: 'RCM Register', path: '/accounting/tax-compliance/gst/registers/rcm', group: 'gst' },
  { id: 'hsn-reg', label: 'HSN Summary', path: '/accounting/tax-compliance/gst/registers/hsn', group: 'gst' },
  { id: 'state-reg', label: 'State / POS', path: '/accounting/tax-compliance/gst/registers/state', group: 'gst' },
  { id: 'liability', label: 'Liability Summary', path: '/accounting/tax-compliance/gst/registers/liability', group: 'gst' },
  { id: 'itc-sum', label: 'ITC Summary', path: '/accounting/tax-compliance/gst/registers/itc', group: 'gst' },
  { id: 'payment-sum', label: 'Payment Summary', path: '/accounting/tax-compliance/gst/registers/payment', group: 'gst' },
  { id: 'payments', label: 'PMT-06 / Payment', path: '/accounting/tax-compliance/gst/payments', group: 'gst' },
  { id: 'export-sez', label: 'Export / SEZ / LUT', path: '/accounting/tax-compliance/gst/export-sez-lut', group: 'gst' },
  { id: 'specials', label: 'Special schemes', path: '/accounting/tax-compliance/gst/specials', group: 'gst' },
  { id: 'cockpit', label: 'Compliance cockpit', path: '/accounting/tax-compliance/gst/compliance-cockpit', group: 'gst' },
  { id: 'hardening', label: 'Go-live / UAT', path: '/accounting/tax-compliance/gst/go-live', group: 'gst' },
  { id: 'rate-ops', label: 'Rate master ops', path: '/accounting/tax-compliance/gst/rate-ops', group: 'gst' },
  { id: 'data-quality', label: 'Data quality / freeze', path: '/accounting/tax-compliance/gst/data-quality', group: 'gst' },
  { id: 'gl-recon', label: 'GST vs GL recon', path: '/accounting/tax-compliance/gst/gl-recon', group: 'gst' },
  { id: 'annual', label: 'Annual / FY archive', path: '/accounting/tax-compliance/gst/annual', group: 'gst' },
  { id: 'gstr-1', label: 'GSTR-1 Prep', path: '/accounting/tax-compliance/gst/gstr-1', group: 'gst' },
  { id: 'gstr-3b', label: 'GSTR-3B Prep', path: '/accounting/tax-compliance/gst/gstr-3b', group: 'gst' },
  { id: 'portal-filing', label: 'Portal Filing', path: '/accounting/tax-compliance/gst/portal-filing', group: 'gst' },
  { id: 'e-inv', label: 'E-Invoices', path: '/accounting/tax-compliance/gst/e-invoices', group: 'gst' },
  { id: 'e-way', label: 'E-Way Bills', path: '/accounting/tax-compliance/gst/e-way-bills', group: 'gst' },
]

/** Condensed workspace chips — secondary to the nav tree above */
export const TAX_COMPLIANCE_WORKSPACE_TABS: { id: string; label: string; path: string; end?: boolean }[] = [
  { id: 'overview', label: 'Overview', path: '/accounting/tax-compliance', end: true },
  { id: 'gst', label: 'GST', path: '/accounting/tax-compliance/gst' },
  { id: 'gstr1', label: 'GSTR-1', path: '/accounting/tax-compliance/gst/gstr-1' },
  { id: 'gstr3b', label: 'GSTR-3B', path: '/accounting/tax-compliance/gst/gstr-3b' },
  { id: 'portal', label: 'Portal filing', path: '/accounting/tax-compliance/gst/portal-filing' },
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
