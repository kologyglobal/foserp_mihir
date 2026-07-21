import { ArrowRight, FileText, PenLine } from 'lucide-react'
import { cn } from '@/utils/cn'

export type SalesOrderCreateMode = 'quotation' | 'direct'

type SalesOrderCreateModeChooserProps = {
  fromCrm?: boolean
  onSelect: (mode: SalesOrderCreateMode) => void
  onCancel: () => void
}

const OPTIONS: Array<{
  mode: SalesOrderCreateMode
  title: string
  subtitle: string
  points: string[]
  icon: typeof FileText
  recommended?: boolean
}> = [
  {
    mode: 'quotation',
    title: 'From quotation',
    subtitle: 'Convert an approved quotation into a sales order.',
    points: [
      'Customer, lines, and terms auto-fill',
      'Best when the deal already has a quote',
      'Keeps quote → order traceability',
    ],
    icon: FileText,
    recommended: true,
  },
  {
    mode: 'direct',
    title: 'Direct sales order',
    subtitle: 'Build the order from scratch without a quotation.',
    points: [
      'Pick customer and products yourself',
      'Use for rush or repeat orders',
      'Requires a short direct-SO reason',
    ],
    icon: PenLine,
  },
]

/**
 * First step for blank New Sales Order — choose create path before the form opens.
 */
export function SalesOrderCreateModeChooser({
  fromCrm = false,
  onSelect,
  onCancel,
}: SalesOrderCreateModeChooserProps) {
  return (
    <div className="so-create-chooser" role="dialog" aria-labelledby="so-create-chooser-title">
      <div className="so-create-chooser__panel">
        <header className="so-create-chooser__header">
          <p className="so-create-chooser__eyebrow">
            {fromCrm ? 'CRM · Sales order' : 'Sales · New order'}
          </p>
          <h1 id="so-create-chooser-title" className="so-create-chooser__title">
            How do you want to create this order?
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
