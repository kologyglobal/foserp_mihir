import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'
import { statusToneFromLabel } from '../../utils/statusTone'

const colorMap = {
  gray: 'erp-badge-soft-neutral',
  blue: 'erp-badge-soft-info',
  green: 'erp-badge-soft-success',
  yellow: 'erp-badge-soft-warning',
  red: 'erp-badge-soft-danger',
  purple: 'erp-badge-soft-purple',
  orange: 'erp-badge-soft-orange',
} as const

const dotColorMap = {
  gray: 'bg-erp-muted',
  blue: 'bg-erp-info-solid',
  green: 'bg-erp-success-solid',
  yellow: 'bg-erp-warning-solid',
  red: 'bg-erp-danger-solid',
  purple: 'bg-purple-600',
  orange: 'bg-erp-warning-solid',
} as const

const solidColorMap = {
  gray: 'erp-badge-soft-neutral',
  blue: 'erp-status-solid-info',
  green: 'erp-status-solid-success',
  yellow: 'erp-status-solid-warning',
  red: 'erp-status-solid-danger',
  purple: 'erp-badge-soft-purple',
  orange: 'erp-status-solid-warning',
} as const

interface BadgeProps {
  children: ReactNode
  color?: keyof typeof colorMap
  className?: string
  dot?: boolean
  /** solid = filled semantic block; soft = default soft/fg */
  variant?: 'soft' | 'solid'
}

export function Badge({ children, color = 'gray', className, dot, variant = 'soft' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        variant === 'solid' ? solidColorMap[color] : colorMap[color],
        variant === 'solid' && color !== 'gray' && color !== 'purple' && 'text-white normal-case',
        className,
      )}
    >
      {dot && (
        <span className={cn('h-1.5 w-1.5 rounded-full', dotColorMap[color])} />
      )}
      {children}
    </span>
  )
}

/** Maps status strings to Badge colors via the shared statusTone rules. */
export function statusColor(status: string): keyof typeof colorMap {
  const s = status.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()

  // Priority / severity (not document workflow)
  if (['high', 'major', 'quarantine', 'rework', 'qc hold'].some((k) => s === k || s.includes(k))) {
    return 'orange'
  }
  if (s === 'medium' || s === 'minor') return 'yellow'
  if (s === 'low') return 'gray'

  const tone = statusToneFromLabel(status)
  const toneToColor: Record<StatusToneColor, keyof typeof colorMap> = {
    success: 'green',
    warning: 'yellow',
    danger: 'red',
    info: 'blue',
    neutral: 'gray',
  }
  return toneToColor[tone] ?? 'gray'
}

type StatusToneColor = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
