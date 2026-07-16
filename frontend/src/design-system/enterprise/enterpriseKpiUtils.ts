import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  FolderOpen,
  Rocket,
  TrendingUp,
} from 'lucide-react'
import type { PageInsight } from '../../components/design-system/PageInsightsStrip'
import type { EnterpriseKpiItem } from './enterpriseKpiTypes'

export const KPI_ICON_PRESETS = {
  open: FolderOpen,
  qualified: CheckCircle2,
  converted: Rocket,
  lost: AlertTriangle,
  revenue: CircleDollarSign,
  pipeline: TrendingUp,
} satisfies Record<string, LucideIcon>

/** Build a subtle sparkline from recent daily counts (0–1 normalized). */
export function buildSparklineFromCounts(counts: number[]): number[] {
  if (counts.length === 0) return []
  const max = Math.max(...counts, 1)
  return counts.map((c) => c / max)
}

export function countSince(iso: string | undefined, daysAgo = 0): boolean {
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - daysAgo)
  return d >= start
}

export function percentOf(part: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

export function pageInsightToKpiItem(insight: PageInsight, index: number): EnterpriseKpiItem {
  return {
    id: insight.id ?? `insight-${index}-${insight.label}`,
    label: insight.label,
    value: insight.value,
    helper: insight.helper,
    context: insight.context,
    trend: insight.trendInfo,
    updatedAt: insight.updatedAt,
    sparkline: insight.sparkline,
    icon: insight.icon,
    accent: insight.accent,
    active: insight.active,
    onClick: insight.onClick,
    href: insight.href,
  }
}

/** Map legacy dashboard / module KPI props to EnterpriseKpiItem */
export function dashboardKpiToEnterprise(
  kpi: {
    id?: string
    label: string
    value: string | number
    helper?: string
    context?: string
    href?: string
    onClick?: () => void
    tone?: string
    icon?: EnterpriseKpiItem['icon']
    trend?: EnterpriseKpiItem['trend']
    accent?: EnterpriseKpiItem['accent']
    active?: boolean
    updatedAt?: EnterpriseKpiItem['updatedAt']
    sparkline?: number[]
  },
  index: number,
): EnterpriseKpiItem {
  return {
    id: kpi.id ?? `dash-kpi-${index}-${kpi.label}`,
    label: kpi.label,
    value: kpi.value,
    helper: kpi.helper,
    context: kpi.context ?? kpi.helper,
    trend: kpi.trend,
    icon: kpi.icon,
    accent: kpi.accent ?? dynamicsToneToAccent(kpi.tone),
    href: kpi.href,
    onClick: kpi.onClick,
    active: kpi.active,
    updatedAt: kpi.updatedAt ?? Date.now(),
    sparkline: kpi.sparkline,
  }
}

export function dynamicsToneToAccent(tone?: string): EnterpriseKpiItem['accent'] {
  switch (tone) {
    case 'success':
      return 'green'
    case 'warning':
      return 'amber'
    case 'critical':
      return 'red'
    case 'neutral':
      return 'slate'
    default:
      return 'blue'
  }
}
