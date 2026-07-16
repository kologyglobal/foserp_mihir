import type { SalesExecutionStage, SalesExecutionStageId } from '../../utils/salesDashboardMetrics'
import { formatMetricCurrency } from '../../utils/workspaceMetrics'
import { DynamicsStatusChip } from '../dynamics/DynamicsStatusChip'
import { cn } from '../../utils/cn'

const ACTIVE_STAGES: SalesExecutionStageId[] = [
  'draft',
  'confirmed',
  'in_production',
  'dispatch_ready',
  'dispatched',
]

export function SalesOrderStatusPipeline({
  stages,
  activeStage,
  orderBookValue,
  openOrderCount,
  onStageClick,
}: {
  stages: SalesExecutionStage[]
  activeStage: SalesExecutionStageId | null
  orderBookValue: number
  openOrderCount: number
  onStageClick: (id: SalesExecutionStageId) => void
}) {
  const visible = stages.filter((s) => ACTIVE_STAGES.includes(s.id))
  const invoiced = stages.find((s) => s.id === 'invoiced')

  return (
    <section className="crm-pipeline-board" aria-label="Fulfillment pipeline filter">
      <div className="crm-pipeline-board-header">
        <div className="crm-pipeline-board-intro">
          <h2 className="crm-section-title">Fulfillment pipeline</h2>
          <p className="crm-section-subtitle">
            Click a stage to filter the register — delivery, production, and billing status.
          </p>
        </div>
        <div className="crm-pipeline-board-summary">
          <div className="crm-pipeline-summary-stat">
            <span className="crm-kpi-label">Active order book</span>
            <span className="crm-pipeline-summary-value">{formatMetricCurrency(orderBookValue)}</span>
          </div>
          <div className="crm-pipeline-summary-stat">
            <span className="crm-kpi-label">Open orders</span>
            <span className="crm-pipeline-summary-value crm-pipeline-summary-value-accent">
              {openOrderCount}
            </span>
          </div>
        </div>
      </div>

      <div className="crm-pipeline-stage-scroll" role="list">
        {visible.map((stage) => {
          const active = activeStage === stage.id
          return (
            <button
              key={stage.id}
              type="button"
              role="listitem"
              aria-pressed={active}
              className={cn('crm-pipeline-stage-card', active && 'crm-pipeline-stage-card--active')}
              onClick={() => onStageClick(stage.id)}
              aria-label={`${stage.label}: ${stage.count} orders, ${formatMetricCurrency(stage.value)}`}
            >
              <div className="crm-pipeline-stage-card-head">
                <h3 className="crm-pipeline-stage-name">{stage.shortLabel}</h3>
                {stage.riskCount > 0 ? (
                  <DynamicsStatusChip label={`${stage.riskCount} risk`} tone="warning" />
                ) : stage.count > 0 ? (
                  <DynamicsStatusChip label="Active" tone="info" />
                ) : (
                  <DynamicsStatusChip label="Clear" tone="success" />
                )}
              </div>

              <p className="crm-pipeline-stage-deals">
                <span className="crm-pipeline-stage-deals-count">{stage.count}</span>
                <span className="crm-pipeline-stage-deals-label">orders</span>
              </p>

              <dl className="crm-pipeline-stage-stats">
                <div className="crm-pipeline-stat-row">
                  <dt className="crm-kpi-label">Value</dt>
                  <dd className="crm-pipeline-stat-value">{formatMetricCurrency(stage.value)}</dd>
                </div>
              </dl>
            </button>
          )
        })}
      </div>

      {invoiced && invoiced.count > 0 ? (
        <div className="crm-pipeline-footer">
          <div className="crm-pipeline-footer-stats">
            <button
              type="button"
              className={cn(
                'crm-pipeline-footer-pill crm-pipeline-footer-pill-won',
                activeStage === 'invoiced' && 'crm-pipeline-footer-pill--active',
              )}
              onClick={() => onStageClick('invoiced')}
            >
              <span className="crm-pipeline-footer-pill-title">Invoiced &amp; closed</span>
              <span className="crm-pipeline-footer-pill-meta">
                {invoiced.count} orders · {formatMetricCurrency(invoiced.value)}
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
