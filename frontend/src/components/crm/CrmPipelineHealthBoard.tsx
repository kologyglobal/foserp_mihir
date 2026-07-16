import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, TrendingUp } from 'lucide-react'
import type { Opportunity, OpportunityStage } from '../../types/crm'
import { buildPipelineFunnelData, formatCrmCurrency } from '../../utils/crmMetrics'
import { buildStuckOpportunityInsights } from '../../utils/crmStuckAnalysis'
import { CLOSED_STAGES } from '../../utils/crmStageTheme'
import { DynamicsStatusChip } from '../dynamics/DynamicsStatusChip'
import { ErpButton } from '../erp/ErpButton'
import { cn } from '../../utils/cn'

/** Shorter stage labels for narrow pipeline cards */
const STAGE_CARD_LABEL: Partial<Record<OpportunityStage, string>> = {
  requirement_discussion: 'Req. Discussion',
  technical_review: 'Tech Review',
  quotation_prepared: 'Quotation Prep',
}

interface CrmPipelineHealthBoardProps {
  opportunities: Opportunity[]
  className?: string
  onStageClick?: (stageId: OpportunityStage, stageLabel: string) => void
}

function avgAgeDays(cards: Opportunity[]): number {
  if (!cards.length) return 0
  const now = Date.now()
  const total = cards.reduce((s, c) => {
    const d = new Date((c.lastActivityAt ?? c.createdAt).slice(0, 10))
    return s + Math.floor((now - d.getTime()) / 86400000)
  }, 0)
  return Math.round(total / cards.length)
}

function stageCardLabel(stageId: OpportunityStage, label: string): string {
  return STAGE_CARD_LABEL[stageId] ?? label
}

export function CrmPipelineHealthBoard({ opportunities, className, onStageClick }: CrmPipelineHealthBoardProps) {
  const navigate = useNavigate()
  const funnel = useMemo(
    () => buildPipelineFunnelData(opportunities, { includeClosed: true }),
    [opportunities],
  )
  const stuckByStage = useMemo(() => {
    const insights = buildStuckOpportunityInsights(opportunities.filter((o) => o.status === 'open'))
    const map = new Map<OpportunityStage, number>()
    for (const i of insights) {
      map.set(i.opportunity.stage, (map.get(i.opportunity.stage) ?? 0) + 1)
    }
    return map
  }, [opportunities])

  const openStages = funnel.stages.filter((s) => !CLOSED_STAGES.has(s.id) && s.id !== 'on_hold')
  const wonStage = funnel.stages.find((s) => s.id === 'won')
  const lostStage = funnel.stages.find((s) => s.id === 'lost')
  const activeCount = openStages.reduce((s, st) => s + st.count, 0)

  function openStage(stageId: OpportunityStage, label: string) {
    if (onStageClick) onStageClick(stageId, label)
    else navigate(`/crm/opportunities?stage=${stageId}`)
  }

  return (
    <section className={cn('crm-pipeline-board', className)}>
      <div className="crm-pipeline-board-header">
        <div className="crm-pipeline-board-intro">
          <h2 className="crm-section-title">Revenue &amp; pipeline health</h2>
          <p className="crm-section-subtitle">
            Stage value, weighted forecast, and ageing — click any stage to drill into deals.
          </p>
        </div>
        <div className="crm-pipeline-board-summary">
          <div className="crm-pipeline-summary-stat">
            <span className="crm-kpi-label">Open pipeline</span>
            <span className="crm-pipeline-summary-value">{formatCrmCurrency(funnel.openPipeline)}</span>
          </div>
          <div className="crm-pipeline-summary-stat">
            <span className="crm-kpi-label">Weighted forecast</span>
            <span className="crm-pipeline-summary-value crm-pipeline-summary-value-accent">
              {formatCrmCurrency(funnel.weightedPipeline)}
            </span>
          </div>
        </div>
      </div>

      <div className="crm-pipeline-stage-scroll" role="list">
        {openStages.map((stage) => {
          const cards = opportunities.filter((o) => o.stage === stage.id && o.status === 'open')
          const riskCount = stuckByStage.get(stage.id) ?? 0
          const avgAge = avgAgeDays(cards)
          return (
            <button
              key={stage.id}
              type="button"
              role="listitem"
              className="crm-pipeline-stage-card"
              onClick={() => openStage(stage.id, stage.label)}
              aria-label={`${stage.label}: ${stage.count} deals, ${formatCrmCurrency(stage.value)}`}
            >
              <div className="crm-pipeline-stage-card-head">
                <h3 className="crm-pipeline-stage-name">{stageCardLabel(stage.id, stage.label)}</h3>
                {riskCount > 0 ? (
                  <DynamicsStatusChip label={`${riskCount} risk`} tone="warning" />
                ) : (
                  <DynamicsStatusChip label="Active" tone="info" />
                )}
              </div>

              <p className="crm-pipeline-stage-deals">
                <span className="crm-pipeline-stage-deals-count">{stage.count}</span>
                <span className="crm-pipeline-stage-deals-label">deals</span>
              </p>

              <dl className="crm-pipeline-stage-stats">
                <div className="crm-pipeline-stat-row">
                  <dt className="crm-kpi-label">Value</dt>
                  <dd className="crm-pipeline-stat-value">{formatCrmCurrency(stage.value)}</dd>
                </div>
                <div className="crm-pipeline-stat-row">
                  <dt className="crm-kpi-label">Weighted</dt>
                  <dd className="crm-pipeline-stat-value">{formatCrmCurrency(stage.weightedValue)}</dd>
                </div>
                <div className="crm-pipeline-stat-row">
                  <dt className="crm-kpi-label">Avg age</dt>
                  <dd className="crm-pipeline-stat-value">{avgAge}d</dd>
                </div>
              </dl>
            </button>
          )
        })}
      </div>

      <div className="crm-pipeline-footer">
        <div className="crm-pipeline-footer-stats">
          {wonStage ? (
            <button
              type="button"
              className="crm-pipeline-footer-pill crm-pipeline-footer-pill-won"
              onClick={() => openStage('won', 'Won')}
            >
              <span className="crm-pipeline-footer-pill-title">Won</span>
              <span className="crm-pipeline-footer-pill-meta">
                {wonStage.count} deals · {formatCrmCurrency(wonStage.value)}
              </span>
            </button>
          ) : null}
          {lostStage ? (
            <button
              type="button"
              className="crm-pipeline-footer-pill crm-pipeline-footer-pill-lost"
              onClick={() => openStage('lost', 'Lost')}
            >
              <span className="crm-pipeline-footer-pill-title">Lost</span>
              <span className="crm-pipeline-footer-pill-meta">
                {lostStage.count} deals · {formatCrmCurrency(lostStage.value)}
              </span>
            </button>
          ) : null}
          <div className="crm-pipeline-footer-pill crm-pipeline-footer-pill-neutral">
            <TrendingUp className="h-4 w-4 shrink-0 text-erp-primary" aria-hidden />
            <span className="crm-pipeline-footer-pill-meta">
              {activeCount} active · {funnel.wonCount} won · {funnel.lostCount} lost
            </span>
          </div>
        </div>
        <ErpButton
          variant="secondary"
          size="sm"
          icon={ArrowRight}
          onClick={() => navigate('/crm/opportunities')}
        >
          Open pipeline
        </ErpButton>
      </div>
    </section>
  )
}
