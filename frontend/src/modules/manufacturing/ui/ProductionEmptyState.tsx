import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { EmptyState } from '@/components/ui/EmptyState'

/** Production empty state — wraps shared EmptyState (no custom chrome). */
export function ProductionEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return <EmptyState icon={icon} title={title} description={description} action={action} className={className} />
}
