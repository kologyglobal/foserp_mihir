import { ArrowRight, Handshake, PenLine } from 'lucide-react'
import { cn } from '@/utils/cn'

export type QuotationCreateMode = 'opportunity' | 'direct'

type QuotationCreateModeChooserProps = {
  onSelect: (mode: QuotationCreateMode) => void
  onCancel: () => void
}

const OPTIONS: Array<{
  mode: QuotationCreateMode
  title: string
  subtitle: string
  icon: typeof Handshake
  recommended?: boolean
}> = [
  {
    mode: 'opportunity',
    title: 'From opportunity',
    subtitle: 'Pull customer and product lines from an open deal.',
    icon: Handshake,
    recommended: true,
  },
  {
    mode: 'direct',
    title: 'Direct quotation',
    subtitle: 'Select a client and enter lines yourself.',
    icon: PenLine,
  },
]

/**
 * First step for blank New Quotation — choose create path before the form opens.
 */
export function QuotationCreateModeChooser({
  onSelect,
  onCancel,
}: QuotationCreateModeChooserProps) {
  return (
    <div className="quote-create-chooser" role="dialog" aria-labelledby="quote-create-chooser-title">
      <div className="quote-create-chooser__panel">
        <header className="quote-create-chooser__header">
          <h1 id="quote-create-chooser-title" className="quote-create-chooser__title">
            Create quotation
          </h1>
          <p className="quote-create-chooser__lead">
            Choose how you want to start. You can change this before saving.
          </p>
        </header>

        <div className="quote-create-chooser__grid">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.mode}
                type="button"
                className={cn(
                  'quote-create-chooser__card',
                  opt.recommended && 'quote-create-chooser__card--recommended',
                )}
                onClick={() => onSelect(opt.mode)}
              >
                <span className="quote-create-chooser__icon" aria-hidden>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="quote-create-chooser__copy">
                  <span className="quote-create-chooser__card-title">
                    {opt.title}
                    {opt.recommended ? (
                      <span className="quote-create-chooser__pill">Recommended</span>
                    ) : null}
                  </span>
                  <span className="quote-create-chooser__card-sub">{opt.subtitle}</span>
                </span>
                <ArrowRight className="quote-create-chooser__arrow h-4 w-4" aria-hidden />
              </button>
            )
          })}
        </div>

        <div className="quote-create-chooser__footer">
          <button type="button" className="erp-btn erp-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
