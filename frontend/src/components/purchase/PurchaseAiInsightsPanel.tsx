import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface PurchaseAiOverviewRow {
  label: string
  value: ReactNode
  highlight?: boolean
}

export interface PurchaseAiSuggestion {
  id: string
  label: string
  icon: LucideIcon
  onClick?: () => void
  disabled?: boolean
  primary?: boolean
}

export function PurchaseAiInsightsShell({
  title = 'Purchase Insights',
  subtitle = 'AI suggested next actions for this screen.',
  children,
  className,
  embedded = false,
}: {
  title?: string
  subtitle?: string
  children: ReactNode
  className?: string
  /** When true, omit outer card chrome (already inside ErpFactBoxPanel). */
  embedded?: boolean
}) {
  return (
    <div
      className={cn(
        'purchase-ai-panel',
        embedded ? 'purchase-ai-panel--embedded' : 'purchase-ai-panel--card',
        className,
      )}
    >
      <header className="purchase-ai-panel__head">
        <span className="purchase-ai-panel__badge" aria-hidden>
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="purchase-ai-panel__title">{title}</p>
          {subtitle ? <p className="purchase-ai-panel__subtitle">{subtitle}</p> : null}
        </div>
      </header>
      <div className="purchase-ai-panel__body">{children}</div>
    </div>
  )
}

export function PurchaseAiOverviewBlock({
  title = 'Overview',
  rows,
}: {
  title?: string
  rows: PurchaseAiOverviewRow[]
}) {
  if (!rows.length) return null
  return (
    <section className="purchase-ai-panel__section" aria-label={title}>
      <p className="purchase-ai-panel__section-title">{title}</p>
      <dl className="purchase-ai-panel__metrics">
        {rows.map((row) => (
          <div
            key={row.label}
            className={cn(
              'purchase-ai-panel__metric',
              row.highlight && 'purchase-ai-panel__metric--highlight',
            )}
          >
            <dt>{row.label}</dt>
            <dd>{row.value ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function PurchaseAiSuggestionsBlock({
  title = 'Suggested actions',
  suggestions,
}: {
  title?: string
  suggestions: PurchaseAiSuggestion[]
}) {
  if (!suggestions.length) return null
  return (
    <section className="purchase-ai-panel__section" aria-label={title}>
      <p className="purchase-ai-panel__section-title">{title}</p>
      <div className="purchase-ai-panel__suggestions">
        {suggestions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.id}
              type="button"
              className={cn(
                'purchase-ai-panel__suggestion',
                action.primary && 'purchase-ai-panel__suggestion--primary',
              )}
              onClick={action.onClick}
              disabled={action.disabled}
            >
              <span className="purchase-ai-panel__suggestion-icon" aria-hidden>
                <Icon className="h-4 w-4" />
              </span>
              <span className="purchase-ai-panel__suggestion-label">{action.label}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
