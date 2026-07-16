import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { budgetingBreadcrumbs, findBudgetingNavItem } from '@/config/budgetingNav'
import { BudgetingPreviewBanner } from './BudgetingPreviewBanner'
import { BudgetingSideNav, BudgetingWorkspaceTabs } from './BudgetingNav'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'

export function BudgetingShell({
  title,
  description,
  children,
  commandBar,
  kpiStrip,
  denseBanner,
}: {
  title?: string
  description?: string
  children: ReactNode
  commandBar?: ReactNode
  kpiStrip?: EnterpriseKpiItem[]
  denseBanner?: boolean
}) {
  const { pathname } = useLocation()
  const active = findBudgetingNavItem(pathname)
  const pageTitle = title ?? active?.label ?? 'Budgeting & Forecasting'

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Budgeting"
      title={pageTitle}
      description={description}
      breadcrumbs={budgetingBreadcrumbs(pathname)}
      autoBreadcrumbs={false}
      favoritePath={pathname}
      kpiStrip={kpiStrip}
      commandBar={commandBar}
      mergeHeaderWithWorkspace
    >
      <div className="flex flex-col gap-2">
        <BudgetingWorkspaceTabs />
        <BudgetingPreviewBanner dense={denseBanner} />
        <div className="flex min-h-[420px] flex-col overflow-hidden rounded border border-erp-border bg-white md:flex-row">
          <div className="border-b border-erp-border md:border-b-0">
            <BudgetingSideNav />
          </div>
          <div className="min-w-0 flex-1 p-3">{children}</div>
        </div>
      </div>
    </OperationalPageShell>
  )
}
