import type { LucideIcon } from 'lucide-react'

export type PremiumAccent =
  | 'blue'
  | 'cyan'
  | 'green'
  | 'amber'
  | 'red'
  | 'indigo'
  | 'orange'
  | 'purple'

export interface PremiumKpiProps {
  label: string
  value: string | number
  helper?: string
  trend?: string
  trendUp?: boolean
  icon?: LucideIcon
  accent?: PremiumAccent
  href?: string
  onClick?: () => void
  lastUpdated?: string
  docNo?: string
}
