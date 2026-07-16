import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { buildNextBusinessActions } from '../../services/nextActionEngine'
import { cn } from '../../utils/cn'

const severityBorder = {
  critical: 'border-l-erp-danger',
  high: 'border-l-erp-warning',
  medium: 'border-l-erp-primary',
  low: 'border-l-erp-border-strong',
} as const

export function NextActionPanel({ limit = 6, title = 'Today needs attention' }: { limit?: number; title?: string }) {
  const navigate = useNavigate()
  const actions = useMemo(() => buildNextBusinessActions(limit), [limit])

  if (actions.length === 0) return null

  return (
    <section className="erp-saas-panel">
      <div className="erp-saas-panel-header">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-erp-primary" />
          <h2 className="erp-saas-panel-title">{title}</h2>
        </div>
        <span className="erp-type-micro rounded-full bg-erp-primary-soft px-2 py-0.5 text-erp-primary">
          {actions.length} action{actions.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => navigate(a.route)}
            className={cn(
              'erp-saas-action-card group text-left',
              severityBorder[a.severity] ?? severityBorder.medium,
            )}
          >
            <p className="erp-type-body-strong">{a.title}</p>
            <p className="erp-type-caption mt-1 line-clamp-2">{a.reason}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              {a.valueImpact && (
                <span className="erp-type-micro font-semibold text-erp-primary tabular-nums">
                  {a.valueImpact}
                </span>
              )}
              <span className="ml-auto inline-flex items-center gap-1 erp-type-micro font-semibold text-erp-primary opacity-0 transition-opacity group-hover:opacity-100">
                {a.actionLabel} <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
