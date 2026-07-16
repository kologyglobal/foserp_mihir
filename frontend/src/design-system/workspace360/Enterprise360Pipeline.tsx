import { Check, X } from 'lucide-react'
import { cn } from '../../utils/cn'
import { formatDate } from '../../utils/dates/format'
import type { Enterprise360PipelineStage } from './types'
import type { ReactNode } from 'react'

export function Enterprise360Pipeline({
  title = 'Sales Stage',
  currentStageLabel,
  recordStatusLabel,
  recordStatusKey = 'Status',
  funnelStatusKey = 'Sales stage',
  statusNote,
  stages,
  variant = 'card',
  tone = 'default',
  actions,
}: {
  title?: string
  /** Funnel step label (e.g. Qualified) */
  currentStageLabel?: string
  /** Exact CRM record status (e.g. Requirement Collected) */
  recordStatusLabel?: string
  /** Label for record status row (e.g. Lead status / Deal status) */
  recordStatusKey?: string
  /** Label for funnel row when it differs from record status */
  funnelStatusKey?: string
  /** Explains when funnel stage and record status differ */
  statusNote?: string | null
  stages: Enterprise360PipelineStage[]
  /** `stepper` = horizontal stage tracker. `compact` kept as alias. `card` = richer with dates. */
  variant?: 'card' | 'compact' | 'stepper'
  tone?: 'default' | 'lost'
  actions?: ReactNode
}) {
  const activeStage = stages.find((stage) => stage.isCurrent)
  const funnelLabel = currentStageLabel ?? activeStage?.label
  const recordStatus = recordStatusLabel?.trim() || funnelLabel
  const isLost = tone === 'lost' || stages.some((s) => s.isLost)
  const useStepper = variant === 'stepper' || variant === 'compact'
  const showFunnelRow = Boolean(funnelLabel && recordStatus && funnelLabel !== recordStatus)

  return (
    <section
      className={cn(
        'ent-360-pipeline',
        useStepper && 'ent-360-pipeline--stepper',
        variant === 'compact' && 'ent-360-pipeline--compact',
        isLost && 'ent-360-pipeline--lost',
      )}
      aria-label={title}
    >
      <div className="ent-360-pipeline__head">
        <div className="ent-360-pipeline__head-main">
          <p className="ent-360-pipeline__title">{title}</p>
          <div className="ent-360-pipeline__status-block" aria-live="polite">
            {recordStatus ? (
              <p className="ent-360-pipeline__status-line">
                <span className="ent-360-pipeline__status-key">{recordStatusKey}</span>
                <span
                  className={cn(
                    'ent-360-pipeline__status-value',
                    isLost && 'ent-360-pipeline__status-value--lost',
                  )}
                >
                  {recordStatus}
                </span>
              </p>
            ) : null}
            {showFunnelRow ? (
              <p className="ent-360-pipeline__status-line ent-360-pipeline__status-line--funnel">
                <span className="ent-360-pipeline__status-key">{funnelStatusKey}</span>
                <span className="ent-360-pipeline__status-value">{funnelLabel}</span>
              </p>
            ) : null}
            {statusNote ? (
              <p className="ent-360-pipeline__status-note">{statusNote}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="ent-360-pipeline__actions">{actions}</div> : null}
      </div>

      <ol className="ent-360-pipeline__stepper-track">
        {stages.map((stage, index) => {
          const lost = Boolean(stage.isLost || (isLost && stage.isCurrent))
          const completed = Boolean(stage.isPast && !lost)
          const current = Boolean(stage.isCurrent)
          const upcoming = !completed && !current && !lost

          return (
            <li
              key={stage.id}
              className={cn(
                'ent-360-pipeline__step',
                completed && 'ent-360-pipeline__step--completed',
                current && 'ent-360-pipeline__step--current',
                upcoming && 'ent-360-pipeline__step--upcoming',
                lost && 'ent-360-pipeline__step--lost',
              )}
              aria-current={current ? 'step' : undefined}
            >
              {index > 0 ? (
                <span
                  className={cn(
                    'ent-360-pipeline__step-line',
                    (stages[index - 1]?.isPast || stages[index - 1]?.isCurrent)
                      && !stages[index - 1]?.isLost
                      && 'ent-360-pipeline__step-line--filled',
                    (stages[index - 1]?.isLost || (lost && current)) && 'ent-360-pipeline__step-line--lost',
                  )}
                  aria-hidden
                />
              ) : null}
              <span className="ent-360-pipeline__step-node" aria-hidden>
                {completed ? <Check className="ent-360-pipeline__step-check" strokeWidth={2.5} /> : null}
                {lost && current ? <X className="ent-360-pipeline__step-lost-icon" strokeWidth={2.5} /> : null}
              </span>
              <span className="ent-360-pipeline__step-label">{stage.label}</span>
              {!useStepper && stage.completedAt ? (
                <span className="ent-360-pipeline__step-date">{formatDate(stage.completedAt)}</span>
              ) : null}
              {!useStepper && current && !stage.completedAt && !lost ? (
                <span className="ent-360-pipeline__step-date ent-360-pipeline__step-date--current">
                  In progress
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
