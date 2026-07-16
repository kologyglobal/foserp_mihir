import type { LucideIcon } from 'lucide-react'
import { Lightbulb, Sparkles } from 'lucide-react'
import { cn } from '../../utils/cn'

export type CrmSmartChipTone = 'info' | 'success' | 'warning' | 'critical' | 'neutral'
export type CrmSmartSignalTone = 'ok' | 'warn'

export interface CrmSmartChip {
  label: string
  tone: CrmSmartChipTone
}

export interface CrmSmartSignal {
  id: string
  label: string
  tone: CrmSmartSignalTone
}

export interface CrmSmartKeyDetail {
  label: string
  value: string
  muted?: boolean
}

export interface CrmSmartNextAction {
  id: string
  title: string
  description: string
  ctaLabel: string
}

export interface CrmSmartQuickAction {
  id: string
  label: string
  icon?: LucideIcon
  onClick: () => void
  disabled?: boolean
}

export interface CrmSmartScoreFactor {
  label: string
  ok: boolean
  detail?: string
}

export interface CrmSmartScoreCard {
  id: string
  label: string
  percent: number
  tooltip: string
  factors?: CrmSmartScoreFactor[]
}

export interface CrmSmartOverviewPanelProps {
  /** Accessible name for the aside */
  ariaLabel?: string
  title: string
  chips?: CrmSmartChip[]
  meta?: string[]
  savedLabel?: string
  /** Progress section label, default Completeness */
  progressLabel?: string
  progressPercent: number
  /** Tooltip for the primary progress metric */
  progressTooltip?: string
  /**
   * Factor groups for an expandable “Why this score” disclosure.
   * Does not render competing score cards — primary metric stays `progressPercent`.
   */
  scoreCards?: CrmSmartScoreCard[]
  signals: CrmSmartSignal[]
  nextAction: CrmSmartNextAction
  onNextAction: () => void
  quickActions?: CrmSmartQuickAction[]
  keyDetails?: CrmSmartKeyDetail[]
  aiInsight?: string | null
  /** Extra block under key details (e.g. convert card) */
  footer?: React.ReactNode
  /**
   * `lean` = Health → Missing → Next Action (+ optional context line).
   * Hides header status, key details, and secondary actions unless explicitly needed.
   */
  variant?: 'full' | 'lean'
  /** Compact footer line in lean mode, e.g. "Qualified · Rajesh Patel" */
  contextLine?: string
  /** Optional value line under progress in lean mode, e.g. deal value */
  valueLine?: string
}

function readinessTone(percent: number): 'high' | 'mid' | 'low' {
  if (percent >= 80) return 'high'
  if (percent >= 50) return 'mid'
  return 'low'
}

/** Shared AI-style right rail: overview, next action, key details, quick actions. */
export function CrmSmartOverviewPanel({
  ariaLabel = 'Smart overview',
  title,
  chips = [],
  meta = [],
  savedLabel,
  progressLabel = 'Completeness',
  progressPercent,
  progressTooltip,
  scoreCards,
  signals,
  nextAction,
  onNextAction,
  quickActions = [],
  keyDetails = [],
  aiInsight,
  footer,
  variant = 'full',
  contextLine,
  valueLine,
}: CrmSmartOverviewPanelProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(progressPercent)))
  const lean = variant === 'lean'
  const tone = readinessTone(clamped)
  const visibleSignals = lean
    ? signals.filter((s) => s.tone === 'warn').slice(0, 2)
    : signals.filter((s) => s.tone === 'warn').slice(0, 3)
  const showActionDescription = Boolean(nextAction.description?.trim())
  const showAi = !lean && Boolean(aiInsight?.trim())
  const showKeys = !lean && keyDetails.length > 0
  const showQuick = !lean && quickActions.length > 0
  const leanContext = contextLine
    ?? (lean && meta.length > 0
      ? meta.map((m) => m.replace(/^(Stage|Owner):\s*/i, '')).join(' · ')
      : undefined)
  const titleMatchesCta = nextAction.title.trim().toLowerCase() === nextAction.ctaLabel.trim().toLowerCase()
  const factorGroups = (scoreCards ?? []).filter((card) => (card.factors?.length ?? 0) > 0)

  return (
    <aside className={cn('crm-smart-overview', lean && 'crm-smart-overview--lean')} aria-label={ariaLabel}>
      {!lean ? (
        <header className="crm-smart-overview__header">
          <h2 className="crm-smart-overview__title">{title}</h2>
          {chips.length > 0 ? (
            <div className="crm-smart-overview__chips">
              {chips.map((chip) => (
                <span
                  key={chip.label}
                  className={cn('crm-smart-overview__chip', `crm-smart-overview__chip--${chip.tone}`)}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          ) : null}
          {meta.length > 0 ? (
            <p className="crm-smart-overview__meta">
              {meta.map((item, i) => (
                <span key={`${item}-${i}`}>
                  {i > 0 ? <span className="crm-smart-overview__dot" aria-hidden> · </span> : null}
                  {item.replace(/^(Status|Pipeline):\s*/i, '')}
                </span>
              ))}
            </p>
          ) : null}
          {savedLabel ? <p className="crm-smart-overview__saved">{savedLabel}</p> : null}
        </header>
      ) : (
        <span className="sr-only">{title}</span>
      )}

      <section
        className={cn(
          'crm-smart-overview__section crm-smart-overview__section--health',
          !lean && 'crm-smart-overview__section--card',
        )}
        aria-labelledby="crm-smart-overview-progress"
      >
        <div className="crm-smart-overview__qual-row">
          <h3
            id="crm-smart-overview-progress"
            className="crm-smart-overview__section-title crm-smart-overview__section-title--inline"
            title={progressTooltip}
          >
            {progressLabel}
          </h3>
          <strong
            className={cn('crm-smart-overview__pct', `crm-smart-overview__pct--${tone}`)}
            aria-label={`${progressLabel} ${clamped}%`}
          >
            {clamped}%
          </strong>
        </div>
        {progressTooltip && (!lean || factorGroups.length === 0) ? (
          <p className="crm-smart-overview__score-tooltip">{progressTooltip}</p>
        ) : null}
        <div
          className={cn('crm-smart-overview__bar', `crm-smart-overview__bar--${tone}`)}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${progressLabel} ${clamped}%`}
        >
          <div className="crm-smart-overview__bar-fill" style={{ width: `${clamped}%` }} />
        </div>
        {factorGroups.length > 0 ? (
          <details className="crm-smart-overview__why">
            <summary className="crm-smart-overview__why-summary">Why this score</summary>
            <div className="crm-smart-overview__factor-groups">
              {factorGroups.map((card) => {
                const pct = Math.max(0, Math.min(100, Math.round(card.percent)))
                return (
                  <div key={card.id} className="crm-smart-overview__factor-group">
                    <div className="crm-smart-overview__factor-group-head" title={card.tooltip}>
                      <span className="crm-smart-overview__factor-group-label">{card.label}</span>
                      <strong className={cn('crm-smart-overview__pct', `crm-smart-overview__pct--${readinessTone(pct)}`)}>
                        {pct}%
                      </strong>
                    </div>
                    {card.tooltip ? (
                      <p className="crm-smart-overview__score-tooltip">{card.tooltip}</p>
                    ) : null}
                    <ul className="crm-smart-overview__factors">
                      {card.factors!.map((f) => (
                        <li
                          key={`${card.id}-${f.label}`}
                          className={cn(
                            'crm-smart-overview__factor',
                            f.ok ? 'crm-smart-overview__factor--ok' : 'crm-smart-overview__factor--warn',
                          )}
                          title={f.detail}
                        >
                          <span aria-hidden>{f.ok ? '✓' : '○'}</span>
                          <span>
                            <span className="crm-smart-overview__factor-label">{f.label}</span>
                            {f.detail ? (
                              <span className="crm-smart-overview__factor-detail">{f.detail}</span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </details>
        ) : null}
        {lean && valueLine ? (
          <p className="crm-smart-overview__value-line">{valueLine}</p>
        ) : null}
        {visibleSignals.length > 0 ? (
          <ul className="crm-smart-overview__signals">
            {visibleSignals.map((signal) => (
              <li
                key={signal.id}
                className={cn(
                  'crm-smart-overview__signal',
                  signal.tone === 'ok' ? 'crm-smart-overview__signal--ok' : 'crm-smart-overview__signal--warn',
                )}
              >
                <span aria-hidden>{signal.tone === 'ok' ? '✓' : '⚠'}</span>
                {signal.label}
              </li>
            ))}
          </ul>
        ) : lean ? (
          <p className="crm-smart-overview__all-clear">No critical gaps</p>
        ) : clamped >= 100 ? (
          <p className="crm-smart-overview__all-clear">Profile complete</p>
        ) : null}
      </section>

      <section
        className={cn(
          'crm-smart-overview__section crm-smart-overview__section--action',
          !lean && 'crm-smart-overview__section--nba-card',
        )}
        aria-labelledby="crm-smart-nba"
      >
        <h3 id="crm-smart-nba" className="crm-smart-overview__section-title">
          <Sparkles className="crm-smart-overview__spark-icon" aria-hidden />
          Next best action
        </h3>
        {!lean || !titleMatchesCta ? (
          <p className="crm-smart-overview__action-title">{nextAction.title}</p>
        ) : null}
        {showActionDescription ? (
          <p className="crm-smart-overview__action-desc">{nextAction.description}</p>
        ) : null}
        <button type="button" className="crm-smart-overview__cta" onClick={onNextAction}>
          {nextAction.ctaLabel}
        </button>

        {showQuick ? (
          <div className="crm-smart-overview__quick-actions" role="group" aria-label="Quick actions">
            {quickActions.slice(0, 4).map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.id}
                  type="button"
                  className="crm-smart-overview__cta-secondary"
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
                  <span>{action.label}</span>
                </button>
              )
            })}
          </div>
        ) : null}
      </section>

      {showKeys ? (
        <section className="crm-smart-overview__section crm-smart-overview__section--keys" aria-labelledby="crm-smart-keys">
          <h3 id="crm-smart-keys" className="crm-smart-overview__section-title">Key details</h3>
          <dl className="crm-smart-overview__keys">
            {keyDetails.map((row) => (
              <div key={row.label} className="crm-smart-overview__key-row">
                <dt>{row.label}</dt>
                <dd className={cn(row.muted && 'crm-smart-overview__key-muted')}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {showAi ? (
        <section className="crm-smart-overview__section crm-smart-overview__section--ai" aria-labelledby="crm-smart-ai">
          <h3 id="crm-smart-ai" className="crm-smart-overview__section-title">
            <Lightbulb className="crm-smart-overview__spark-icon" aria-hidden />
            Insight
          </h3>
          <p className="crm-smart-overview__ai-text">{aiInsight}</p>
        </section>
      ) : null}

      {leanContext ? (
        <p className="crm-smart-overview__context">{leanContext}</p>
      ) : null}

      {footer ? <div className="crm-smart-overview__footer">{footer}</div> : null}
    </aside>
  )
}
