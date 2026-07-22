import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import type { ProductionAssignment } from '@/types/manufacturingPhase2b'
import { t } from '../i18n/operatorStrings'
import { assignmentStatusMeta } from '../ui'
import { operatorCardClass } from './operatorCss'
import { OperatorTaskActions } from './OperatorTaskActions'

function qtyBalance(assigned: string, completed: string): number {
  return Math.max(0, Number(assigned) - Number(completed))
}

interface OperatorTaskCardProps {
  assignment: ProductionAssignment
  productLabel: string
  busy?: boolean
  onAccept: () => void
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onComplete: () => void
  onReportProblem: () => void
}

/** Mobile-first operator task card — WO, product, stage, quantities, machine, instructions. */
export function OperatorTaskCard({
  assignment,
  productLabel,
  busy,
  onAccept,
  onStart,
  onPause,
  onResume,
  onComplete,
  onReportProblem,
}: OperatorTaskCardProps) {
  const woNo = assignment.productionOrder?.orderNumber ?? 'Work Order'
  const stageLabel = assignment.stage?.name ?? 'Stage'
  const opLabel = assignment.operation?.name
  const machineLabel = assignment.machine ? `${assignment.machine.code ?? ''} ${assignment.machine.name}`.trim() : '—'
  const balance = qtyBalance(assignment.assignedQuantity, assignment.completedQuantity)
  const statusMeta = assignmentStatusMeta(assignment.status)

  return (
    <article className={operatorCardClass} aria-label={`${woNo} — ${productLabel}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-erp-muted">{t('task.workOrder')}</p>
          <p className="font-mono text-lg font-semibold text-erp-primary">{woNo}</p>
        </div>
        <DynamicsStatusChip label={statusMeta.label} tone={statusMeta.tone} />
      </header>

      <dl className="mt-3 grid gap-2.5 text-[13px] sm:grid-cols-2">
        <div>
          <dt className="text-[11px] text-erp-muted">{t('task.product')}</dt>
          <dd className="font-medium text-erp-text">{productLabel}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-erp-muted">{t('task.stage')}</dt>
          <dd className="font-medium text-erp-text">
            {stageLabel}
            {opLabel ? ` · ${opLabel}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-erp-muted">{t('task.target')}</dt>
          <dd className="tabular-nums font-semibold">{assignment.assignedQuantity}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-erp-muted">{t('task.completed')}</dt>
          <dd className="tabular-nums font-semibold">{assignment.completedQuantity}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-erp-muted">{t('task.balance')}</dt>
          <dd className="tabular-nums font-semibold text-erp-primary">{balance}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-erp-muted">{t('task.machine')}</dt>
          <dd>{machineLabel}</dd>
        </div>
      </dl>

      <div className="mt-3 rounded-lg border border-erp-border/80 bg-erp-surface-alt/40 px-3 py-2.5">
        <p className="text-[11px] font-medium text-erp-muted">{t('task.workInstructions')}</p>
        <p className="mt-0.5 text-[13px] text-erp-text whitespace-pre-wrap">
          {assignment.workInstruction?.trim() || t('task.noInstructions')}
        </p>
      </div>

      <div className="mt-4">
        <OperatorTaskActions
          assignment={assignment}
          busy={busy}
          onAccept={onAccept}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          onComplete={onComplete}
          onReportProblem={onReportProblem}
        />
      </div>
    </article>
  )
}
