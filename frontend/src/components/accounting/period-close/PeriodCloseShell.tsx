import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { findPeriodCloseNavItem, periodCloseBreadcrumbs } from '@/config/periodCloseNav'
import { PeriodClosePeriodBar } from './PeriodClosePeriodBar'
import { PeriodClosePreviewBanner } from './PeriodClosePreviewBanner'
import { PeriodCloseSideNav, PeriodCloseWorkspaceTabs } from './PeriodCloseNav'
import type { PeriodFilterState } from '@/types/periodClose'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'

export function PeriodCloseShell({
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
  const active = findPeriodCloseNavItem(pathname)
  const pageTitle = title ?? active?.label ?? 'Period Close'

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Period Close"
      title={pageTitle}
      description={description}
      breadcrumbs={periodCloseBreadcrumbs(pathname)}
      autoBreadcrumbs={false}
      favoritePath={pathname}
      kpiStrip={kpiStrip}
      commandBar={commandBar}
      mergeHeaderWithWorkspace
    >
      <div className="flex flex-col gap-2">
        <PeriodCloseWorkspaceTabs />
        <PeriodClosePreviewBanner dense={denseBanner} />
        {showPeriodBar ? <PeriodClosePeriodBar value={periodFilter} onChange={onPeriodChange} /> : null}
        <div className="flex min-h-[420px] flex-col overflow-hidden rounded border border-erp-border bg-white md:flex-row">
          <div className="border-b border-erp-border md:border-b-0">
            <PeriodCloseSideNav />
          </div>
          <div className="min-w-0 flex-1 p-3">{children}</div>
        </div>
      </div>
    </OperationalPageShell>
  )
}
