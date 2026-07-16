import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { taxComplianceBreadcrumbs, findTaxComplianceNavItem } from '@/config/taxComplianceNav'
import { TaxCompliancePeriodBar } from './TaxCompliancePeriodBar'
import { TaxCompliancePreviewBanner } from './TaxCompliancePreviewBanner'
import { TaxComplianceSideNav, TaxComplianceWorkspaceTabs } from './TaxComplianceNav'
import type { PeriodFilterState } from '@/types/taxCompliance'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'

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
}) {
  const { pathname } = useLocation()
  const active = findTaxComplianceNavItem(pathname)
  const pageTitle = title ?? active?.label ?? 'GST & TDS'

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
        <TaxCompliancePreviewBanner dense={denseBanner} />
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
