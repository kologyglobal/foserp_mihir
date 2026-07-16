import { Link } from 'react-router-dom'
import { Lock, ArrowRight } from 'lucide-react'
import {
  PURCHASE_WORKFLOW_STEPS,
  purchaseWorkflowCoverageLabel,
  type PurchaseWorkflowCoverage,
  type PurchaseWorkflowStep,
} from '../../config/purchaseWorkflow'
import type { PurchaseProcessNextAction } from '../../utils/purchaseStatusLabels'
import { cn } from '../../utils/cn'

function coverageClass(c: PurchaseWorkflowCoverage): string {
  if (c === 'exists') return 'purchase-process-map__step--exists'
  if (c === 'partial') return 'purchase-process-map__step--partial'
  return 'purchase-process-map__step--deferred'
}

/** Full process strip for the Purchase module dashboard. */
export function PurchaseProcessMap({
  highlightStep,
  className,
}: {
  highlightStep?: number
  className?: string
}) {
  return (
    <section className={cn('purchase-process-map', className)} aria-label="Procurement process">
      <header className="purchase-process-map__header">
        <div>
          <h2 className="purchase-process-map__title">Procurement process</h2>
          <p className="purchase-process-map__subtitle">
            Canonical lifecycle from demand through payment. Available stages open demo screens; Planned steps are deferred
            (inventory / quality / finance backends).
          </p>
        </div>
        <ul className="purchase-process-map__legend" aria-hidden>
          <li><span className="purchase-process-map__dot purchase-process-map__dot--exists" /> Available</li>
          <li><span className="purchase-process-map__dot purchase-process-map__dot--partial" /> Partial</li>
          <li><span className="purchase-process-map__dot purchase-process-map__dot--deferred" /> Planned</li>
        </ul>
      </header>
      <ol className="purchase-process-map__track">
        {PURCHASE_WORKFLOW_STEPS.map((step) => (
          <ProcessStepCell key={step.step} step={step} active={highlightStep === step.step} />
        ))}
      </ol>
    </section>
  )
}

function ProcessStepCell({ step, active }: { step: PurchaseWorkflowStep; active?: boolean }) {
  const coverage = purchaseWorkflowCoverageLabel(step.coverage)
  const inner = (
    <>
      <span className="purchase-process-map__num">{step.step}</span>
      <span className="purchase-process-map__label">{step.shortLabel}</span>
      <span className="purchase-process-map__coverage">
        {step.coverage === 'deferred' ? <Lock className="h-3 w-3" aria-hidden /> : null}
        {coverage}
      </span>
    </>
  )

  const className = cn(
    'purchase-process-map__step',
    coverageClass(step.coverage),
    active && 'purchase-process-map__step--active',
  )

  if (step.href && step.coverage !== 'deferred') {
    return (
      <li>
        <Link
          to={step.href}
          className={className}
          title={step.note ? `${step.label} — ${step.note}` : step.label}
        >
          {inner}
        </Link>
      </li>
    )
  }

  return (
    <li>
      <div
        className={cn(className, 'purchase-process-map__step--disabled')}
        title={step.note ? `${step.label} — ${step.note}` : `${step.label} (Planned)`}
        aria-disabled="true"
      >
        {inner}
      </div>
    </li>
  )
}

/** Compact stage chip + next actions for document 360 pages. */
export function PurchaseProcessStagePanel({
  currentStep,
  statusLabel,
  nextActions,
  className,
}: {
  currentStep: number
  statusLabel: string
  nextActions: PurchaseProcessNextAction[]
  className?: string
}) {
  const step = PURCHASE_WORKFLOW_STEPS.find((s) => s.step === currentStep)
  const primary = nextActions[0]
  const rest = nextActions.slice(1, 3)

  return (
    <aside className={cn('purchase-process-stage', className)}>
      <div className="purchase-process-stage__current">
        <span className="purchase-process-stage__eyebrow">Procurement stage</span>
        <p className="purchase-process-stage__title">
          {step ? (
            <>
              <span className="purchase-process-stage__num">{step.step}</span>
              {step.label}
            </>
          ) : (
            statusLabel
          )}
        </p>
        <p className="purchase-process-stage__status">Document status: {statusLabel}</p>
      </div>
      {primary ? (
        <div className="purchase-process-stage__next">
          <span className="purchase-process-stage__eyebrow">Next in process</span>
          {primary.planned || !primary.href ? (
            <p className="purchase-process-stage__planned">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              {primary.label}
              {primary.hint ? <span className="purchase-process-stage__hint">{primary.hint}</span> : null}
            </p>
          ) : (
            <Link to={primary.href} className="purchase-process-stage__cta">
              {primary.label}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
          {rest.length > 0 ? (
            <ul className="purchase-process-stage__more">
              {rest.map((a) => (
                <li key={`${a.step}-${a.label}`}>
                  {a.href && !a.planned ? (
                    <Link to={a.href}>{a.label}</Link>
                  ) : (
                    <span className="text-erp-muted">{a.label}{a.planned ? ' · Planned' : ''}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}
