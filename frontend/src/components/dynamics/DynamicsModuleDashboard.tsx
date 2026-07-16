import type { ReactNode } from 'react'
import { SaaSPageShell } from '../saas'
import { CommandCenterHeader, type CommandCenterMetric } from '../premium/CommandCenterHeader'
import type { LucideIcon } from 'lucide-react'
import { EnterpriseKpiStrip } from '../../design-system/enterprise/EnterpriseKpiStrip'
import { dashboardKpiToEnterprise } from '../../design-system/enterprise/enterpriseKpiUtils'
import type { EnterpriseKpiItem, EnterpriseKpiTrendInfo } from '../../design-system/enterprise/enterpriseKpiTypes'
import { type DynamicsKpiTone } from './DynamicsKpiTile'
import { DynamicsCommandBar } from './DynamicsCommandBar'
import { FioriBreadcrumb, type FioriBreadcrumbItem } from '../fiori/FioriBreadcrumb'
import { cn } from '../../utils/cn'

export type ModuleDashboardVariant = 'default' | 'fiori'

export type ModuleDashboardKpi = {
  id?: string
  label: string
  value: string | number
  helper?: string
  context?: string
  href?: string
  onClick?: () => void
  tone?: DynamicsKpiTone
  icon?: LucideIcon
  trend?: EnterpriseKpiTrendInfo
  accent?: EnterpriseKpiItem['accent']
  active?: boolean
  updatedAt?: EnterpriseKpiItem['updatedAt']
  sparkline?: number[]
}

export function DynamicsModuleDashboard({
  title,
  subtitle,
  healthScore,
  healthLabel,
  healthSublabel,
  heroMetrics,
  badge,
  favoritePath,
  actions,
  quickActions,
  alert,
  emptyState,
  liveSections,
  kpiStrip,
  children,
  showFactoryLive,
  heroLayout,
  kpiColumns,
  variant = 'default',
  breadcrumb,
}: {
  title: string
  subtitle?: string
  healthScore?: number
  healthLabel?: string
  healthSublabel?: string
  heroMetrics: CommandCenterMetric[]
  badge?: string
  favoritePath?: string
  actions?: ReactNode
  quickActions?: ReactNode
  alert?: ReactNode
  emptyState?: ReactNode
  liveSections?: ReactNode
  kpiStrip?: ModuleDashboardKpi[]
  children?: ReactNode
  showFactoryLive?: boolean
  heroLayout?: 'default' | 'uniform'
  kpiColumns?: number
  variant?: ModuleDashboardVariant
  breadcrumb?: FioriBreadcrumbItem[]
}) {
  const isFiori = variant === 'fiori'

  return (
    <SaaSPageShell>
      <div
        className={cn(
          'erp-page dyn-module-dashboard',
          isFiori ? 'fiori-analytical-page space-y-4' : 'space-y-5',
        )}
      >
        {isFiori && breadcrumb && breadcrumb.length > 0 ? <FioriBreadcrumb items={breadcrumb} /> : null}

        <CommandCenterHeader
          title={title}
          subtitle={subtitle}
          healthScore={healthScore}
          healthLabel={healthLabel}
          healthSublabel={healthSublabel}
          metrics={heroMetrics}
          badge={badge}
          favoritePath={favoritePath}
          actions={actions}
          showFactoryLive={showFactoryLive}
          heroLayout={heroLayout}
        />

        {alert}
        {emptyState}
        {liveSections}

        {quickActions && !isFiori ? (
          <DynamicsCommandBar className="dyn-module-command-bar">{quickActions}</DynamicsCommandBar>
        ) : null}

        {quickActions && isFiori ? quickActions : null}

        {kpiStrip && kpiStrip.length > 0 && (
          <EnterpriseKpiStrip
            items={kpiStrip.map((kpi, i) => dashboardKpiToEnterprise(kpi, i))}
            columns={kpiColumns ?? Math.min(kpiStrip.length, 5)}
          />
        )}

        {children}
      </div>
    </SaaSPageShell>
  )
}
