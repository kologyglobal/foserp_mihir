import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'
import { EnterpriseKpiStrip } from '../../design-system/enterprise/EnterpriseKpiStrip'
import { pageInsightToKpiItem } from '../../design-system/enterprise/enterpriseKpiUtils'
import type { EnterpriseKpiTrendInfo } from '../../design-system/enterprise/enterpriseKpiTypes'

export interface PageInsight {
  id?: string
  label: string
  value: string | number
  helper?: string
  context?: string
  accent?: 'blue' | 'green' | 'amber' | 'red' | 'slate'
  onClick?: () => void
  href?: string
  active?: boolean
  trendInfo?: EnterpriseKpiTrendInfo
  updatedAt?: Date | number | string
  sparkline?: number[]
  icon?: LucideIcon
}

interface PageInsightsStripProps {
  insights: PageInsight[]
  className?: string
}

/** Compact KPI row — delegates to global EnterpriseKpiStrip */
export function PageInsightsStrip({ insights, className }: PageInsightsStripProps) {
  const items = insights.map((insight, index) => pageInsightToKpiItem(insight, index))

  return (
    <EnterpriseKpiStrip
      items={items}
      columns={insights.length >= 5 ? 5 : insights.length}
      className={cn(className)}
    />
  )
}

export function PageInsightsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="ent-kpi-strip" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="ent-kpi-card erp-skeleton min-h-[124px]" />
      ))}
    </div>
  )
}
