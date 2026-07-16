import type { LucideIcon } from 'lucide-react'

export type EnterpriseKpiTrend = 'up' | 'down' | 'flat'

export interface EnterpriseKpiTrendInfo {
  direction: EnterpriseKpiTrend
  label: string
  tone?: 'positive' | 'negative' | 'neutral'
}

export interface EnterpriseKpiItem {
  id: string
  label: string
  value: string | number
  helper?: string
  context?: string
  trend?: EnterpriseKpiTrendInfo
  updatedAt?: Date | number | string
  sparkline?: number[]
  icon?: LucideIcon
  accent?: 'blue' | 'green' | 'amber' | 'red' | 'slate'
  active?: boolean
  onClick?: () => void
  href?: string
}
