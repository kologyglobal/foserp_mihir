import { cn } from '../../utils/cn'

type Props = {
  message: string
  variant?: 'neutral' | 'warning' | 'danger' | 'success'
  className?: string
}

const VARIANT: Record<NonNullable<Props['variant']>, string> = {
  neutral: 'text-erp-muted',
  warning: 'text-erp-warning',
  danger: 'text-erp-danger',
  success: 'text-erp-success',
}

/** Operational status language — replaces generic "Pending" labels in live contexts. */
export function LiveStatusLabel({ message, variant = 'neutral', className }: Props) {
  return <span className={cn('text-sm font-medium', VARIANT[variant], className)}>{message}</span>
}
