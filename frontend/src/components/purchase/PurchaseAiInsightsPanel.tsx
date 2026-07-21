import { useCallback, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Sparkles, X } from 'lucide-react'
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
  variant = 'card',
  onClose,
}: {
  title?: string
  subtitle?: string
  children: ReactNode
  className?: string
  /** When true, omit outer card chrome (already inside ErpFactBoxPanel). */
  embedded?: boolean
  /** `register` = list-page band above the table (collapsible header like CRM cards). */
  variant?: 'card' | 'register'
  /** When set, shows a close/collapse control in the header. */
  onClose?: () => void
}) {
  const isRegister = variant === 'register' && !embedded

  return (
    <div
      className={cn(
        'purchase-ai-panel',
        embedded ? 'purchase-ai-panel--embedded' : isRegister ? 'purchase-ai-panel--register' : 'purchase-ai-panel--card',
        className,
      )}
    >
      <header className="purchase-ai-panel__head">
        <span className="purchase-ai-panel__badge" aria-hidden>
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="purchase-ai-panel__title">{title}</p>
          {subtitle ? <p className="purchase-ai-panel__subtitle">{subtitle}</p> : null}
        </div>
        {onClose ? (
          <button
            type="button"
            className={cn(
              'purchase-ai-panel__close',
              isRegister && 'purchase-ai-panel__close--collapse',
            )}
            onClick={onClose}
            aria-label={isRegister ? `Collapse ${title}` : `Hide ${title}`}
            title={isRegister ? 'Collapse insights' : 'Hide insights'}
          >
            <X className="h-3.5 w-3.5" aria-hidden strokeWidth={2.25} />
          </button>
        ) : null}
      </header>
      <div className="purchase-ai-panel__body">{children}</div>
    </div>
  )
}

export function PurchaseAiInsightsRestoreButton({
  label = 'Purchase Insights',
  onClick,
  className,
  pressed,
}: {
  label?: string
  onClick: () => void
  className?: string
  /** When true, button acts as a toggle that can hide insights. */
  pressed?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        'erp-factbox-pane__ai-toggle purchase-ai-panel__restore',
        pressed && 'purchase-ai-panel__restore--on',
        className,
      )}
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={pressed ? `Hide ${label}` : `Show ${label}`}
      title={pressed ? `Hide ${label}` : `Show ${label}`}
    >
      <Sparkles className="h-4 w-4" aria-hidden />
    </button>
  )
}

export const PURCHASE_AI_INSIGHTS_COLLAPSED_KEY = 'purchase.ai-insights.collapsed'

export function readPurchaseAiInsightsOpen(storageKey = PURCHASE_AI_INSIGHTS_COLLAPSED_KEY): boolean {
  if (typeof window === 'undefined') return true
  try {
    const collapsed = localStorage.getItem(storageKey)
    if (collapsed === '1') return false
    if (collapsed === '0') return true
  } catch {
    /* ignore */
  }
  return true
}

export function usePurchaseAiInsightsOpen(storageKey = PURCHASE_AI_INSIGHTS_COLLAPSED_KEY) {
  const [open, setOpenState] = useState(() => readPurchaseAiInsightsOpen(storageKey))

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next)
      try {
        localStorage.setItem(storageKey, next ? '0' : '1')
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  )

  return [open, setOpen] as const
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
