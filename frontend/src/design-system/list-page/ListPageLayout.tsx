import type { ReactNode } from 'react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import type { EnterpriseKpiItem } from '../enterprise/enterpriseKpiTypes'
import type { PageInsight } from '../../components/design-system/PageInsightsStrip'

/** Standard CRM/Sales list page shell — wraps OperationalPageShell. */
export function ListPageLayout({
  title,
  description,
  favoritePath,
  badge,
  breadcrumbs,
  autoBreadcrumbs,
  commandBar,
  filterBar,
  kpiStrip,
  insights,
  children,
}: {
  title: string
  description?: string
  favoritePath?: string
  badge?: string
  breadcrumbs?: { label: string; to?: string }[]
  autoBreadcrumbs?: boolean
  commandBar?: ReactNode
  filterBar?: ReactNode
  kpiStrip?: EnterpriseKpiItem[]
  insights?: PageInsight[]
  children: ReactNode
}) {
  return (
    <OperationalPageShell
      title={title}
      description={description}
      favoritePath={favoritePath}
      badge={badge}
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={autoBreadcrumbs}
      variant="dynamics"
      commandBar={commandBar}
      filterBar={filterBar}
      kpiStrip={kpiStrip}
      insights={insights}
    >
      {children}
    </OperationalPageShell>
  )
}
