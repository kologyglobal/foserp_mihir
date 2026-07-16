import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { SalesOrder } from '../../types/mrp'
import type { WorkOrder } from '../../types/workorder'
import type { QcInspection } from '../../types/quality'
import {
  buildSalesExecutionStages,
  sumActiveOrderBook,
  type SalesExecutionStageId,
} from '../../utils/salesDashboardMetrics'
import { formatMetricCurrency } from '../../utils/workspaceMetrics'
import { DynamicsStatusChip } from '../dynamics/DynamicsStatusChip'
import { cn } from '../../utils/cn'

interface SalesExecutionPipelineBoardProps {
  salesOrders: SalesOrder[]
  workOrders: WorkOrder[]
  inspections: QcInspection[]
  className?: string
}

const ACTIVE_STAGE_IDS: SalesExecutionStageId[] = [
  'draft',
  'confirmed',
  'in_production',
  'dispatch_ready',
  'dispatched',
]

export function SalesExecutionPipelineBoard({
  salesOrders,
  workOrders,
  inspections,
  className,
}: SalesExecutionPipelineBoardProps) {
  const navigate = useNavigate()
  const stages = useMemo(
    () => buildSalesExecutionStages(salesOrders, workOrders, inspections),
    [salesOrders, workOrders, inspections],
  )
  const orderBook = useMemo(() => sumActiveOrderBook(salesOrders), [salesOrders])
  const activeCount = stages
    .filter((s) => ACTIVE_STAGE_IDS.includes(s.id))
    .reduce((n, s) => n + s.count, 0)
  const invoicedStage = stages.find((s) => s.id === 'invoiced')

  return (
    <section className={cn('crm-pipeline-board sales-execution-board', className)}>
      <div className="crm-pipeline-board-header">
        <div className="crm-pipeline-board-intro">
          <h2 className="crm-section-title">Order execution pipeline</h2>
          <p className="crm-section-subtitle">
            Confirmed order book through production, dispatch, and billing — click a stage to drill in.
          </p>
        </div>
        <div className="crm-pipeline-board-summary">
          <div className="crm-pipeline-summary-stat">
            <span className="crm-kpi-label">Active order book</span>
            <span className="crm-pipeline-summary-value">{formatMetricCurrency(orderBook)}</span>
          </div>
          <div className="crm-pipeline-summary-stat">
            <span className="crm-kpi-label">Open orders</span>
            <span className="crm-pipeline-summary-value crm-pipeline-summary-value-accent">
              {activeCount}
            </span>
          </div>
        </div>
      </div>

      <div className="crm-pipeline-stage-scroll" role="list">
        {stages
          .filter((s) => ACTIVE_STAGE_IDS.includes(s.id))
          .map((stage) => (
            <button
              key={stage.id}
              type="button"
              role="listitem"
              className="crm-pipeline-stage-card sales-execution-stage-card"
              onClick={() => navigate(stage.href)}
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

              <span className="sales-execution-stage-cta">
                Open <ArrowRight className="h-3 w-3" aria-hidden />
              </span>
            </button>
          ))}
      </div>

      {invoicedStage && invoicedStage.count > 0 && (
        <div className="crm-pipeline-footer">
          <div className="crm-pipeline-footer-stats">
            <button
              type="button"
              className="crm-pipeline-footer-pill crm-pipeline-footer-pill-won"
              onClick={() => navigate('/invoices/register')}
            >
              <span className="crm-pipeline-footer-pill-title">Invoiced &amp; closed</span>
              <span className="crm-pipeline-footer-pill-meta">
                {invoicedStage.count} orders · {formatMetricCurrency(invoicedStage.value)}
              </span>
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
