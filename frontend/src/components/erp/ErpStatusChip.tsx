import { DynamicsStatusChip } from '../dynamics/DynamicsStatusChip'
import { cn } from '../../utils/cn'

const toneMap = {
  success: 'success',
  warning: 'warning',
  critical: 'critical',
  info: 'info',
  neutral: 'neutral',
  live: 'live',
  pending: 'pending',
} as const

export type ErpStatusChipTone = keyof typeof toneMap

export function ErpStatusChip({
  label,
  tone = 'neutral',
  className,
}: {
  label: string
  tone?: ErpStatusChipTone
  className?: string
}) {
  return (
    <span className={cn('erp-status-chip-wrap', className)}>
      <DynamicsStatusChip label={label} tone={toneMap[tone] ?? 'neutral'} />
    </span>
  )
}
