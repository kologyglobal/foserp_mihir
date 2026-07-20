import type { LucideIcon } from 'lucide-react'
import { ArrowRight, CircleAlert, Lightbulb, Sparkles } from 'lucide-react'
import { cn } from '../../utils/cn'
import { focusAndHighlightField } from '../../utils/formValidation'

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
  /**
   * Form field key (`data-field` / `data-nba-target`) to scroll, focus, and highlight
   * when the primary CTA is clicked. Omit for navigate/save/drawer actions.
   */
  focusField?: string
  /** Optional section id for pages that expand/scroll before focusing. */
  sectionId?: string
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
  /** Progress section label, default Record Health */
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
   * `lean` = Record Health → Priority Insight → Recommended Next Step (+ secondary actions).
   * Hides dense header chips / key details unless explicitly needed.
   */
  variant?: 'full' | 'lean'
  /** Compact footer line in lean mode, e.g. "Qualified · Rajesh Patel" */
  contextLine?: string
  /** Optional value line under progress in lean mode, e.g. deal value */
  valueLine?: string
  /**
   * When false, hide gap warn chips (pristine create forms).
   * Next best action still shows. Default true.
   */
  showGapSignals?: boolean
}

function readinessTone(percent: number): 'high' | 'mid' | 'low' {
  if (percent >= 80) return 'high'
  if (percent >= 50) return 'mid'
  return 'low'
}

function normalizeCompare(value: string): string {
  return value.trim().toLowerCase().replace(/[.!]+$/g, '')
}

/** Shared AI-style right rail: health, insight, next step, secondary actions. */
export function CrmSmartOverviewPanel({
  ariaLabel = 'Smart overview',
  title,
  chips = [],
  meta = [],
  savedLabel,
  progressLabel = 'Record Health',
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
  showGapSignals = true,
}: CrmSmartOverviewPanelProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(progressPercent)))
  const lean = variant === 'lean'
  const tone = readinessTone(clamped)

  function handleNextActionClick() {
    onNextAction()
    if (nextAction.focusField) {
      focusAndHighlightField(nextAction.focusField, { delayMs: 140 })
    }
  }

  const gatedSignals = showGapSignals ? signals : []
  const warnSignals = gatedSignals.filter((s) => s.tone === 'warn')
  const visibleSignals = lean ? warnSignals.slice(0, 2) : warnSignals.slice(0, 3)
  const attentionCount = warnSignals.length

  const actionDescription = nextAction.description?.trim() ?? ''
  const actionTitle = nextAction.title?.trim() ?? ''
  const ctaLabel = nextAction.ctaLabel?.trim() || 'Continue'

  /** Prefer a gap signal for Priority Insight so NBA copy is not repeated. */
  const priorityInsight = (() => {
    const topSignal = visibleSignals[0]?.label?.trim()
    if (topSignal) return topSignal
    if (!showGapSignals) return null
    if (actionTitle && normalizeCompare(actionTitle) !== normalizeCompare(ctaLabel)) {
      return actionTitle
    }
    return null
  })()

  const recommendationCopy = (() => {
    if (actionDescription) return actionDescription
    if (actionTitle && normalizeCompare(actionTitle) !== normalizeCompare(ctaLabel)) {
      return actionTitle
    }
    return `Use “${ctaLabel}” to move this record forward.`
  })()

  const attentionLabel = (() => {
    if (clamped >= 100 && attentionCount === 0) return 'Ready — no critical gaps'
    if (!showGapSignals && attentionCount === 0) {
      return clamped < 40 ? 'Getting started' : 'Keep filling required fields'
    }
    if (attentionCount === 0) return 'No items need attention'
    if (attentionCount === 1) return '1 item needs attention'
    return `${attentionCount} items need attention`
  })()

  const secondaryActions = quickActions
    .filter((action) => normalizeCompare(action.label) !== normalizeCompare(ctaLabel))
    .slice(0, lean ? 3 : 4)

  const showKeys = !lean && keyDetails.length > 0
  const showAi = !lean && Boolean(aiInsight?.trim())
  const factorGroups = (scoreCards ?? []).filter((card) => (card.factors?.length ?? 0) > 0)
  const footerLine = savedLabel
    ?? (lean
      ? (contextLine ? contextLine : 'Guidance updates as you fill the form')
      : null)

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
        </header>
      ) : (
        <span className="sr-only">{title}</span>
      )}

      <section
        className="crm-smart-overview__section crm-smart-overview__section--health"
        aria-labelledby="crm-smart-overview-progress"
      >
        <h3 id="crm-smart-overview-progress" className="crm-smart-overview__section-title" title={progressTooltip}>
          {progressLabel}
        </h3>

        <div className="crm-smart-overview__health-head">
          <div className="crm-smart-overview__health-metric">
            <strong
              className={cn('crm-smart-overview__pct', `crm-smart-overview__pct--${tone}`)}
              aria-label={`${progressLabel} ${clamped}% complete`}
            >
              {clamped}%
            </strong>
            <span className="crm-smart-overview__health-complete">Complete</span>
          </div>
          {lean && valueLine ? (
            <p className="crm-smart-overview__value-line">{valueLine}</p>
          ) : null}
        </div>

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

        <p className={cn(
          'crm-smart-overview__attention',
          attentionCount > 0 ? 'crm-smart-overview__attention--warn' : 'crm-smart-overview__attention--ok',
        )}
        >
          {attentionLabel}
        </p>

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
      </section>

      {priorityInsight ? (
        <section
          className="crm-smart-overview__section crm-smart-overview__section--insight"
          aria-labelledby="crm-smart-priority"
        >
          <h3 id="crm-smart-priority" className="crm-smart-overview__section-title">
            Priority Insight
          </h3>
          <div className="crm-smart-overview__insight">
            <span className="crm-smart-overview__insight-icon" aria-hidden>
              <CircleAlert className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
            <p className="crm-smart-overview__insight-text">{priorityInsight}</p>
          </div>
          {!lean && visibleSignals.length > 1 ? (
            <ul className="crm-smart-overview__signals">
              {visibleSignals.slice(1).map((signal) => (
                <li key={signal.id} className="crm-smart-overview__signal crm-smart-overview__signal--warn">
                  <span aria-hidden>⚠</span>
                  {signal.label}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section
        className="crm-smart-overview__section crm-smart-overview__section--action"
        aria-labelledby="crm-smart-nba"
      >
        <h3 id="crm-smart-nba" className="crm-smart-overview__section-title">
          <Sparkles className="crm-smart-overview__spark-icon" aria-hidden />
          Recommended Next Step
        </h3>
        <p className="crm-smart-overview__action-desc">{recommendationCopy}</p>
        <button type="button" className="crm-smart-overview__cta" onClick={handleNextActionClick}>
          <span>{ctaLabel}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden strokeWidth={2.25} />
        </button>
      </section>

      {secondaryActions.length > 0 ? (
        <section
          className="crm-smart-overview__section crm-smart-overview__section--secondary"
          aria-labelledby="crm-smart-secondary"
        >
          <h3 id="crm-smart-secondary" className="crm-smart-overview__section-title">
            Secondary actions
          </h3>
          <ul className="crm-smart-overview__secondary-list">
            {secondaryActions.map((action) => {
              const Icon = action.icon
              return (
                <li key={action.id}>
                  <button
                    type="button"
                    className="crm-smart-overview__secondary-link"
                    onClick={action.onClick}
                    disabled={action.disabled}
                  >
                    {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
                    <span>{action.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

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

      {footerLine ? (
        <p className="crm-smart-overview__status">{footerLine}</p>
      ) : null}

      {footer ? <div className="crm-smart-overview__footer">{footer}</div> : null}
    </aside>
  )
}
