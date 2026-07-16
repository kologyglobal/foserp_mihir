import { type ReactNode } from 'react'
import { Sparkles, X } from 'lucide-react'
import { cn } from '../../../utils/cn'

interface ErpFactBoxPaneProps {
  children: ReactNode
  label?: string
  className?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Modern AI-assisted details pane chrome — open state controlled by parent layout */
export function ErpFactBoxPane({
  children,
  label = 'Details',
  className,
  open,
  onOpenChange,
}: ErpFactBoxPaneProps) {
  if (!open) {
    return null
  }

  return (
    <div className={cn('erp-factbox-pane', className)}>
      <div className="erp-factbox-pane__chrome">
        <div className="erp-factbox-pane__chrome-glow" aria-hidden />
        <div className="erp-factbox-pane__heading">
          <span className="erp-factbox-pane__glyph" aria-hidden>
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
          </span>
          <span className="erp-factbox-pane__heading-text">
            <span className="erp-factbox-pane__eyebrow">Smart context</span>
            <span className="erp-factbox-pane__title">{label}</span>
          </span>
        </div>
        <button
          type="button"
          className="erp-factbox-pane__close"
          onClick={() => onOpenChange(false)}
          aria-label={`Close ${label} pane`}
          title="Close"
        >
          <X className="h-3.5 w-3.5" aria-hidden strokeWidth={2.25} />
        </button>
      </div>
      <div className="erp-factbox-pane__body">{children}</div>
    </div>
  )
}
