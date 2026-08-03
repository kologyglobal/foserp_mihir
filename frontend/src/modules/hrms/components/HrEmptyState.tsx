import type { LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

interface HrEmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  primaryAction?: { label: string; onClick: () => void }
}

/** HRMS empty-state wrapper — always requires an icon, matching the design-system EmptyState contract. */
export function HrEmptyState({ icon, title, description, primaryAction }: HrEmptyStateProps) {
  const action = primaryAction ? (
    <button type="button" className="erp-btn erp-btn--primary" onClick={primaryAction.onClick}>
      {primaryAction.label}
    </button>
  ) : undefined
  return <EmptyState icon={icon} title={title} description={description} action={action} />
}
