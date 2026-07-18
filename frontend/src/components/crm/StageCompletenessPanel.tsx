import type { StageRequirementField } from '@/config/crmStageRequirements'
import { cn } from '@/utils/cn'

export type StageCompletenessPanelProps = {
  percent: number
  requiredCount: number
  completedCount: number
  missingFields: StageRequirementField[]
  /** Optional stage name shown next to the heading (e.g. "Qualified"). */
  stageLabel?: string
  className?: string
}

/**
 * Field-based stage gate progress for Lead / Opportunity 360.
 * Completeness is mandatory fields only — stage notes are separate.
 */
export function StageCompletenessPanel({
  percent,
  requiredCount,
  completedCount,
  missingFields,
  stageLabel,
  className,
}: StageCompletenessPanelProps) {
  const complete = missingFields.length === 0
  const clamped = Math.max(0, Math.min(100, percent))

  return (
    <section
      className={cn(
        'stage-completeness',
        complete ? 'stage-completeness--ok' : 'stage-completeness--warn',
        className,
      )}
      aria-label="Stage completeness"
    >
      <div className="stage-completeness__head">
        <p className="stage-completeness__title">
          Stage completeness
          {stageLabel ? <span className="stage-completeness__stage"> · {stageLabel}</span> : null}
          {': '}
          <strong>{clamped}%</strong>
        </p>
        <p className="stage-completeness__meta">
          {completedCount} of {requiredCount} mandatory items completed
        </p>
      </div>

      <div
        className="stage-completeness__bar"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Stage completeness ${clamped} percent`}
      >
        <div className="stage-completeness__bar-fill" style={{ width: `${clamped}%` }} />
      </div>

      {!complete ? (
        <div className="stage-completeness__missing">
          <p className="stage-completeness__missing-title">Missing:</p>
          <ul className="stage-completeness__missing-list">
            {missingFields.map((item) => (
              <li key={item.field}>{item.label}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
