import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { SmartEmptyState } from '../../components/premium/SmartEmptyState'
import { Button } from './Button'
import { cn } from '../../utils/cn'

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  primaryAction?: { label: string; onClick: () => void }
  secondaryAction?: { label: string; onClick: () => void }
  helpLink?: { label: string; href: string }
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  helpLink,
  className,
}: EmptyStateProps) {
  const action: ReactNode = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {primaryAction ? (
        <Button variant="primary" size="md" onClick={primaryAction.onClick}>
          {primaryAction.label}
        </Button>
      ) : null}
      {secondaryAction ? (
        <Button variant="outline" size="md" onClick={secondaryAction.onClick}>
          {secondaryAction.label}
        </Button>
      ) : null}
      {helpLink ? (
        <a href={helpLink.href} className="ds-type-caption text-[var(--dyn-primary)] hover:underline">
          {helpLink.label}
        </a>
      ) : null}
    </div>
  )

  return (
    <SmartEmptyState
      icon={icon}
      title={title}
      insight={description}
      action={primaryAction || secondaryAction || helpLink ? action : undefined}
      className={cn(className)}
    />
  )
}
