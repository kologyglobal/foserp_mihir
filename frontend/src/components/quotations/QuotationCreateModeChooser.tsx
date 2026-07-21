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
  points: string[]
  icon: typeof Handshake
  recommended?: boolean
}> = [
  {
    mode: 'opportunity',
    title: 'From opportunity',
    subtitle: 'Link an open deal — customer and lines flow from the opportunity.',
    points: [
      'Customer, product lines, and owner auto-fill',
      'Best when the deal is already in pipeline',
      'Keeps opportunity → quotation traceability',
    ],
    icon: Handshake,
    recommended: true,
  },
  {
    mode: 'direct',
    subtitle: 'Quote a client without a deal — sales order can also be created directly later.',
    title: 'Direct (select client)',
    points: [
      'Pick the client / company yourself',
      'Use for quick or ad-hoc quotations',
      'No opportunity link required',
    ],
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
    <div className="so-create-chooser" role="dialog" aria-labelledby="quote-create-chooser-title">
      <div className="so-create-chooser__panel">
        <header className="so-create-chooser__header">
          <p className="so-create-chooser__eyebrow">CRM · Quotation</p>
          <h1 id="quote-create-chooser-title" className="so-create-chooser__title">
            How do you want to create this quotation?
          </h1>
          <p className="so-create-chooser__lead">
            Pick a path to continue. You can change it later before saving.
          </p>
        </header>

        <div className="so-create-chooser__grid">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.mode}
                type="button"
                className={cn(
                  'so-create-chooser__card',
                  opt.recommended && 'so-create-chooser__card--recommended',
                )}
                onClick={() => onSelect(opt.mode)}
              >
                <div className="so-create-chooser__card-top">
                  <span className="so-create-chooser__icon" aria-hidden>
                    <Icon className="h-5 w-5" />
                  </span>
                  {opt.recommended ? (
                    <span className="so-create-chooser__pill">Recommended</span>
                  ) : null}
                </div>
                <h2 className="so-create-chooser__card-title">{opt.title}</h2>
                <p className="so-create-chooser__card-sub">{opt.subtitle}</p>
                <ul className="so-create-chooser__points">
                  {opt.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <span className="so-create-chooser__cta">
                  Continue
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </span>
              </button>
            )
          })}
        </div>

        <div className="so-create-chooser__footer">
          <button type="button" className="so-create-chooser__cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
