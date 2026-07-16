import { cn } from '../../utils/cn'

const toneClass = {
  live: 'saas-status-live',
  success: 'saas-status-success',
  warning: 'saas-status-warning',
  danger: 'saas-status-danger',
  info: 'saas-status-info',
  neutral: 'bg-[var(--saas-bg-subtle)] text-[var(--saas-muted)]',
} as const

export function SaaSStatusBadge({
  label,
  tone = 'neutral',
  dot = false,
  className,
}: {
  label: string
  tone?: keyof typeof toneClass
  dot?: boolean
  className?: string
}) {
  return (
    <span className={cn('saas-status-badge', toneClass[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {label}
    </span>
  )
}
