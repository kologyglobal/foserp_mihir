import { cn } from '../../utils/cn'

const toneClass = {
  success: 'dyn-chip-success',
  warning: 'dyn-chip-warning',
  critical: 'dyn-chip-critical',
  info: 'dyn-chip-info',
  neutral: 'dyn-chip-neutral',
  live: 'dyn-chip-live',
  pending: 'dyn-chip-pending',
} as const

export function DynamicsStatusChip({
  label,
  tone = 'neutral',
}: {
  label: string
  tone?: keyof typeof toneClass
}) {
  return (
    <span
      className={cn('dyn-status-chip', toneClass[tone] ?? toneClass.neutral)}
      role="status"
      aria-label={label}
    >
      {label}
    </span>
  )
}
