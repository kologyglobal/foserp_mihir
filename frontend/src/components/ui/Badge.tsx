import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

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

export function statusColor(
  status: string,
): keyof typeof colorMap {
  const map: Record<string, keyof typeof colorMap> = {
    draft: 'gray',
    open: 'blue',
    pending: 'yellow',
    released: 'purple',
    in_progress: 'blue',
    'in-progress': 'blue',
    'in_production': 'blue',
    'in-production': 'blue',
    qc_hold: 'orange',
    'qc-hold': 'orange',
    rejected: 'red',
    failed: 'red',
    completed: 'green',
    closed: 'green',
    confirmed: 'blue',
    engineering: 'purple',
    'ready-dispatch': 'green',
    ready_dispatch: 'green',
    dispatched: 'green',
    delivered: 'green',
    planned: 'gray',
    submitted: 'yellow',
    approved: 'purple',
    material_reserved: 'blue',
    partially_issued: 'yellow',
    fully_issued: 'green',
    fg_received: 'green',
    partially_reserved: 'yellow',
    issued: 'green',
    sent: 'blue',
    partial_received: 'yellow',
    partial: 'orange',
    quoted: 'purple',
    converted: 'green',
    received: 'green',
    posted: 'green',
    invoiced: 'purple',
    unpaid: 'yellow',
    paid: 'green',
    overdue: 'red',
    cancelled: 'red',
    obsolete: 'gray',
    investigating: 'orange',
    resolved: 'green',
    critical: 'red',
    major: 'orange',
    minor: 'yellow',
    high: 'orange',
    medium: 'yellow',
    low: 'gray',
    available: 'green',
    'low stock': 'red',
    'low-stock': 'red',
    reserved: 'blue',
    quarantine: 'orange',
    'out of stock': 'red',
    'out-of-stock': 'red',
    passed: 'green',
    rework: 'orange',
    ready: 'green',
    loading: 'yellow',
    in_transit: 'blue',
    'qc-pending': 'yellow',
    'on-hold': 'red',
    'under-review': 'purple',
    implemented: 'green',
  }
  return map[status.toLowerCase()] ?? 'gray'
}

export function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
