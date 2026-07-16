import { useState } from 'react'
import { Compass, X } from 'lucide-react'
import { cn } from '../../utils/cn'

interface ErpPageGuideProps {
  purpose: string
  nextStep?: string
  className?: string
}

/** Visible page purpose + recommended next action for real users */
export function ErpPageGuide({ purpose, nextStep, className }: ErpPageGuideProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div
      className={cn(
        'erp-page-guide relative flex gap-2.5 rounded-lg border border-erp-primary/15 bg-erp-primary-soft/50 px-3.5 py-2.5 pr-9 text-[13px] leading-snug text-erp-text',
        className,
      )}
      role="note"
      aria-label="Page guide"
    >
      <Compass className="mt-0.5 h-4 w-4 shrink-0 text-erp-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p>
          <span className="font-semibold text-erp-primary">Purpose:</span> {purpose}
        </p>
        {nextStep ? (
          <p className="mt-1 text-erp-muted">
            <span className="font-semibold text-erp-text">Next step:</span> {nextStep}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className="absolute right-1.5 top-1.5 rounded p-1 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5" aria-hidden strokeWidth={2.25} />
      </button>
    </div>
  )
}
