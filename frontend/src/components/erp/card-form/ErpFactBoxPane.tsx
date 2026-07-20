import { type ReactNode } from 'react'
import { Sparkles, X } from 'lucide-react'
import { cn } from '../../../utils/cn'

interface ErpFactBoxPaneProps {
  children: ReactNode
  label?: string
  /** Secondary line under the title — matches Purchase AI Insights tone */
  subtitle?: string
  className?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DEFAULT_SUBTITLE = 'AI-assisted record guidance'

/** Smart Context details pane — Approval Insights card chrome across modules */
export function ErpFactBoxPane({
  children,
  label = 'Smart Context',
  subtitle = DEFAULT_SUBTITLE,
  className,
  open,
  onOpenChange,
}: ErpFactBoxPaneProps) {
  if (!open) {
    return null
  }

  return (
    <div className={cn('erp-factbox-pane', className)}>
      <header className="erp-factbox-pane__chrome">
        <span className="erp-factbox-pane__glyph" aria-hidden>
          <Sparkles className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <div className="erp-factbox-pane__heading-text">
          <span className="erp-factbox-pane__title">{label}</span>
          {subtitle ? <span className="erp-factbox-pane__subtitle">{subtitle}</span> : null}
        </div>
        <button
          type="button"
          className="erp-factbox-pane__close"
          onClick={() => onOpenChange(false)}
          aria-label={`Hide ${label}`}
          title="Hide smart context"
        >
          <X className="h-3.5 w-3.5" aria-hidden strokeWidth={2.25} />
        </button>
      </header>
      <div className="erp-factbox-pane__body">{children}</div>
    </div>
  )
}
