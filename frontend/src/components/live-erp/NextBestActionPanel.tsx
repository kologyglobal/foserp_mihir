import { Link } from 'react-router-dom'
import { ArrowRight, Zap } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { NextBestAction } from './types'

type Props = {
  title?: string
  actions: NextBestAction[]
  className?: string
  compact?: boolean
}

export function NextBestActionPanel({ title = 'Next Actions', actions, className, compact = false }: Props) {
  if (actions.length === 0) return null

  return (
    <div className={cn('rounded-lg border border-erp-border bg-white shadow-erp', className)}>
      <div className="flex items-center gap-2 border-b border-erp-border px-4 py-2.5">
        <Zap className="h-4 w-4 text-erp-primary" aria-hidden />
        <h3 className="text-sm font-semibold text-erp-text">{title}</h3>
      </div>
      <ul className={cn('divide-y divide-erp-border', compact ? 'p-0' : '')}>
        {actions.slice(0, compact ? 4 : 8).map((action, idx) => {
          const content = (
            <>
              <span className="font-medium">{action.label}</span>
              {action.description && (
                <span className="mt-0.5 block text-xs text-erp-muted">{action.description}</span>
              )}
            </>
          )
          const className = cn(
            'flex items-center justify-between gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-erp-surface-alt',
            idx === 0 && action.priority !== 'secondary' && 'bg-erp-primary-soft/30',
          )
          if (action.href) {
            return (
              <li key={action.id}>
                <Link to={action.href} className={className}>
                  {content}
                  <ArrowRight className="h-4 w-4 shrink-0 text-erp-muted" />
                </Link>
              </li>
            )
          }
          return (
            <li key={action.id}>
              <button type="button" onClick={action.onClick} className={cn(className, 'w-full text-left')}>
                {content}
                <ArrowRight className="h-4 w-4 shrink-0 text-erp-muted" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
