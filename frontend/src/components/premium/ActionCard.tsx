import type { LucideIcon } from 'lucide-react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn'

export function ActionCard({
  title,
  description,
  href,
  onClick,
  icon: Icon,
  accent = 'blue',
}: {
  title: string
  description?: string
  href?: string
  onClick?: () => void
  icon?: LucideIcon
  accent?: 'blue' | 'cyan' | 'green' | 'amber'
}) {
  const accentMap = {
    blue: 'border-l-[var(--erp-primary)]',
    cyan: 'border-l-[var(--erp-accent)]',
    green: 'border-l-[var(--erp-success)]',
    amber: 'border-l-[var(--erp-warning)]',
  }
  const className = cn(
    'erp-premium-kpi group flex items-start gap-3 border-l-[3px] p-4 text-left transition-shadow',
    accentMap[accent],
    (href || onClick) && 'cursor-pointer hover:shadow-erp-md',
  )
  const body = (
    <>
      {Icon && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-erp-primary-soft text-erp-primary">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-erp-text">{title}</p>
        {description && <p className="mt-0.5 text-xs text-erp-muted">{description}</p>}
      </div>
      {(href || onClick) && (
        <ArrowRight className="h-4 w-4 shrink-0 text-erp-muted opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </>
  )
  if (href) return <Link to={href} className={className}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={className}>{body}</button>
  return <div className={className}>{body}</div>
}
