import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export interface Enterprise360KpiItem {
  id: string
  label: string
  value: string | number
  hint?: string
  accent?: 'blue' | 'green' | 'amber' | 'red' | 'slate'
  onClick?: () => void
  href?: string
}

export interface Enterprise360PipelineStage {
  id: string
  label: string
  completedAt?: string | null
  isCurrent?: boolean
  isPast?: boolean
  /** Lost / disqualified treatment on this step */
  isLost?: boolean
}

export interface Enterprise360InfoField {
  label: string
  value: ReactNode
  colSpan?: 1 | 2
}

export interface Enterprise360InfoSection {
  id: string
  title: string
  fields: Enterprise360InfoField[]
  collapsible?: boolean
  defaultOpen?: boolean
}

export interface Enterprise360AiInsight {
  id: string
  label: string
  value: string
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'critical'
}

export interface Enterprise360RelatedLink {
  id: string
  label: string
  subtitle?: string
  value?: string
  href?: string
}

export interface Enterprise360Action {
  id: string
  label: string
  icon?: LucideIcon
  onClick?: () => void
  href?: string
  disabled?: boolean
  disabledReason?: string
  danger?: boolean
  primary?: boolean
}

export interface Enterprise360CommAction {
  id: string
  label: string
  icon: LucideIcon
  onClick?: () => void
  href?: string
}

export interface Enterprise360StickyField {
  label: string
  value: string
  highlight?: boolean
}
