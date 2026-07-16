import { cn } from '../../utils/cn'
import { formatStatus } from '../ui/Badge'

export type StatusDotTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

const dotClass: Record<StatusDotTone, string> = {
  success: 'bg-erp-success-solid',
  warning: 'bg-erp-warning-solid',
  danger: 'bg-erp-danger-solid',
  info: 'bg-erp-info-solid',
  neutral: 'bg-erp-muted',
}

const labelClass: Record<StatusDotTone, string> = {
  success: 'text-erp-success-fg',
  warning: 'text-erp-warning-fg',
  danger: 'text-erp-danger-fg',
  info: 'text-erp-info-fg',
  neutral: 'text-erp-muted',
}

interface StatusDotProps {
  label: string
  tone?: StatusDotTone
  className?: string
}

/** Dense table status — colored dot + label (DataTable spec) */
export function StatusDot({ label, tone = 'neutral', className }: StatusDotProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[13px] font-medium', labelClass[tone], className)}>
      <span className={cn('h-2 w-2 shrink-0 rounded-full', dotClass[tone])} aria-hidden />
      {formatStatus(label)}
    </span>
  )
}

export function statusToneFromLabel(status: string): StatusDotTone {
  const s = status.toLowerCase()
  if (['posted', 'dispatched', 'delivered', 'completed', 'closed', 'paid', 'passed', 'approved', 'received', 'green', 'ready'].some((k) => s.includes(k))) return 'success'
  if (['pending', 'submitted', 'partial', 'qc', 'loading', 'yellow', 'amber', 'warning'].some((k) => s.includes(k))) return 'warning'
  if (['overdue', 'rejected', 'failed', 'cancelled', 'critical', 'red', 'danger'].some((k) => s.includes(k))) return 'danger'
  if (['open', 'sent', 'confirmed', 'in_progress', 'in-transit', 'blue'].some((k) => s.includes(k))) return 'info'
  if (['draft', 'planned', 'gray', 'inactive'].some((k) => s.includes(k))) return 'neutral'
  return 'neutral'
}
