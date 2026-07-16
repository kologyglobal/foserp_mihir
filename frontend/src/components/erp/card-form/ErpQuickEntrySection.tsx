import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Zap } from 'lucide-react'
import { cn } from '../../../utils/cn'
import { ErpCardSection } from './ErpCardSection'

export interface ErpQuickEntrySectionProps {
  id?: string
  title?: string
  subtitle?: string
  icon?: LucideIcon
  children: ReactNode
  columns?: 1 | 2 | 3
  className?: string
  collapsible?: boolean
  defaultOpen?: boolean
}

/**
 * Standard Quick Entry FastTab — mandatory + high-frequency fields only.
 * Always uses the shared 3-column dense grid by default.
 */
export function ErpQuickEntrySection({
  id = 'form-section-quick',
  title = 'Quick Entry',
  subtitle = 'Capture the essentials — expand additional information only when needed.',
  icon = Zap,
  children,
  columns = 3,
  className,
  collapsible = true,
  defaultOpen = true,
}: ErpQuickEntrySectionProps) {
  return (
    <ErpCardSection
      id={id}
      title={title}
      subtitle={subtitle}
      icon={icon}
      columns={columns}
      collapsible={collapsible}
      defaultOpen={defaultOpen}
      className={cn('erp-quick-entry', className)}
      badge={<span className="erp-additional-info-toggle__badge">Core</span>}
    >
      {children}
    </ErpCardSection>
  )
}
