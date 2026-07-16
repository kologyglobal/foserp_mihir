import { cn } from '../../utils/cn'
import { resolveEnterpriseStatusTone } from './statusTokens'

export function EnterpriseStatusChip({
  label,
  status,
  className,
}: {
  label: string
  /** Raw status key for tone mapping; defaults to label */
  status?: string
  className?: string
}) {
  const tone = resolveEnterpriseStatusTone(status ?? label)
  return (
    <span className={cn('ent-status-chip', `ent-status-chip--${tone}`, className)}>
      {label}
    </span>
  )
}
