import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { taxComplianceBreadcrumbs, findTaxComplianceNavItem } from '@/config/taxComplianceNav'
import { TaxCompliancePeriodBar } from './TaxCompliancePeriodBar'
import { TaxCompliancePreviewBanner } from './TaxCompliancePreviewBanner'
import { TaxComplianceSideNav, TaxComplianceWorkspaceTabs } from './TaxComplianceNav'
import type { PeriodFilterState } from '@/types/taxCompliance'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'

export type TaxComplianceBannerVariant = 'auto' | 'extract-live' | 'filing-demo' | 'demo'

const EXTRACT_LIVE_PATHS = new Set([
  '/accounting/tax-compliance',
  '/accounting/tax-compliance/gst',
  '/accounting/tax-compliance/gst/outward-supplies',
  '/accounting/tax-compliance/gst/inward-supplies',
  '/accounting/tax-compliance/gst/e-invoices',
  '/accounting/tax-compliance/gst/e-way-bills',
])

const FILING_DEMO_PATHS = [
  '/accounting/tax-compliance/gst/gstr-1',
  '/accounting/tax-compliance/gst/gstr-3b',
  '/accounting/tax-compliance/gst/gstr-2b',
]

function bannerVariantForPath(pathname: string): TaxComplianceBannerVariant {
  const normalized = pathname.replace(/\/$/, '') || '/'
  if (FILING_DEMO_PATHS.some((p) => normalized === p || normalized.startsWith(`${p}/`))) {
    return 'filing-demo'
  }
  if (EXTRACT_LIVE_PATHS.has(normalized)) {
    return 'extract-live'
  }
  return 'auto'
}

export function TaxComplianceShell({
  title,
  description,
  children,
  commandBar,
  kpiStrip,
  showPeriodBar = true,
  periodFilter,
  onPeriodChange,
  denseBanner,
  bannerVariant,
}: {
  title?: string
  description?: string
  children: ReactNode
  commandBar?: ReactNode
  kpiStrip?: EnterpriseKpiItem[]
  showPeriodBar?: boolean
  periodFilter?: PeriodFilterState
  onPeriodChange?: (next: PeriodFilterState) => void
  denseBanner?: boolean
  bannerVariant?: TaxComplianceBannerVariant
}) {
  const { pathname } = useLocation()
  const active = findTaxComplianceNavItem(pathname)
  const pageTitle = title ?? active?.label ?? 'GST & TDS'
  const resolvedBanner = bannerVariant ?? bannerVariantForPath(pathname)

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="GST & TDS"
      title={pageTitle}
      description={description}
      breadcrumbs={taxComplianceBreadcrumbs(pathname)}
      autoBreadcrumbs={false}
      favoritePath={pathname}
      kpiStrip={kpiStrip}
      commandBar={commandBar}
      mergeHeaderWithWorkspace
    >
      <div className="flex flex-col gap-2">
        <TaxComplianceWorkspaceTabs />
        <TaxCompliancePreviewBanner dense={denseBanner} variant={resolvedBanner} />
        {showPeriodBar ? <TaxCompliancePeriodBar value={periodFilter} onChange={onPeriodChange} /> : null}
        <div className="flex min-h-[420px] flex-col overflow-hidden rounded border border-erp-border bg-white md:flex-row">
          <div className="border-b border-erp-border md:border-b-0">
            <TaxComplianceSideNav />
          </div>
          <div className="min-w-0 flex-1 p-3">{children}</div>
        </div>
      </div>
    </OperationalPageShell>
  )
}
