import { cn } from '../../utils/cn'

export interface EnterpriseFormMetric {
  label: string
  value: string
  accent?: 'blue' | 'green' | 'amber' | 'violet' | 'slate'
  hint?: string
  highlight?: boolean
}

export function EnterpriseFormMetrics({
  metrics,
  className,
}: {
  metrics: EnterpriseFormMetric[]
  className?: string
}) {
  if (!metrics.length) return null

  return (
    <div className={cn('dyn-form-metrics', className)} role="group" aria-label="Form metrics">
      {metrics.map((m) => (
        <div key={m.label} className={cn('dyn-form-metrics__item', m.accent && `dyn-form-metrics__item--${m.accent}`)}>
          <span className="dyn-form-metrics__label">{m.label}</span>
          <span className="dyn-form-metrics__value">{m.value}</span>
          {m.hint ? <span className="dyn-form-metrics__hint">{m.hint}</span> : null}
        </div>
      ))}
    </div>
  )
}
