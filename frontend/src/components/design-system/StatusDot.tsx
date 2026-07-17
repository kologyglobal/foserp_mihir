import { cn } from '../../utils/cn'
import { formatStatus } from '../ui/Badge'
import { statusToneFromLabel, type StatusTone } from '../../utils/statusTone'

export type StatusDotTone = StatusTone
export { statusToneFromLabel }

/** Soft pill backgrounds — same semantic colors everywhere statuses appear. */
const chipClass: Record<StatusDotTone, string> = {
  success: 'erp-badge-soft-success',
  warning: 'erp-badge-soft-warning',
  danger: 'erp-badge-soft-danger',
  info: 'erp-badge-soft-info',
  neutral: 'erp-badge-soft-neutral',
}

interface StatusDotProps {
  label: string
  tone?: StatusDotTone
  className?: string
}

/** Dense table status — soft colored chip (shared status palette). */
export function StatusDot({ label, tone = 'neutral', className }: StatusDotProps) {
  return (
    <span
      className={cn(
        'ent-status-chip inline-flex items-center !normal-case tracking-normal',
        chipClass[tone],
        className,
      )}
    >
      {formatStatus(label)}
    </span>
  )
}
