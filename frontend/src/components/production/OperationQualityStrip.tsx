import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle, ClipboardCheck, RotateCcw } from 'lucide-react'
import type { WorkOrderProductionOperation } from '../../types/workorder'
import type { QcInspection, ReworkOrder } from '../../types/quality'
import { OPEN_REWORK_STATUSES } from '../../types/quality'
import { Badge } from '../ui/Badge'

interface OperationQualityStripProps {
  workOrderId: string
  operation: WorkOrderProductionOperation
  inspections: QcInspection[]
  reworks: ReworkOrder[]
}

export function OperationQualityStrip({
  workOrderId,
  operation,
  inspections,
  reworks,
}: OperationQualityStripProps) {
  const opInspections = inspections
    .filter((i) => i.productionOperationId === operation.id && i.workOrderId === workOrderId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const pendingInspection = opInspections.find((i) => i.status === 'pending')
  const latestDecision = opInspections.find((i) => i.status !== 'pending')
  const activeRework = reworks.find(
    (r) =>
      r.sourceOperationId === operation.id &&
      r.workOrderId === workOrderId &&
      OPEN_REWORK_STATUSES.includes(r.status),
  )
  const closedRework = reworks.find(
    (r) =>
      r.sourceOperationId === operation.id &&
      r.workOrderId === workOrderId &&
      (r.status === 'reinspected' || r.status === 'closed'),
  )

  if (operation.status === 'completed' && !closedRework && !latestDecision) {
    return null
  }

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-[13px]">
      <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-amber-900">
        <ClipboardCheck className="h-4 w-4" />
        Quality Closure
      </p>

      {operation.status === 'qc_hold' && pendingInspection && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-amber-800">
            {pendingInspection.isReinspection ? 'Re-inspection required' : 'QC inspection pending'} —{' '}
            {pendingInspection.inspectionType}
          </span>
          <Link to={`/quality/inspections/${pendingInspection.id}`}>
            <Badge color="yellow">{pendingInspection.inspectionNo} · Inspect</Badge>
          </Link>
        </div>
      )}

      {operation.status === 'qc_hold' && !pendingInspection && latestDecision?.status === 'rework' && (
        <p className="text-amber-800">Rework recorded — awaiting re-inspection queue</p>
      )}

      {activeRework && (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-purple-900">
            <RotateCcw className="h-3.5 w-3.5" />
            Rework {activeRework.reworkNo} — {activeRework.status.replace('_', ' ')}
            {activeRework.assignedTeam ? ` · ${activeRework.assignedTeam}` : ''}
          </span>
          <Link to="/quality/rework" className="text-xs font-medium text-purple-800 hover:underline">
            Rework Workbench →
          </Link>
        </div>
      )}

      {operation.status === 'in_progress' && latestDecision?.status === 'rework' && activeRework && (
        <p className="mt-1 text-purple-800">
          Shop floor rework in progress — complete rework in Quality before re-inspection.
        </p>
      )}

      {operation.status === 'completed' && closedRework && (
        <p className="mt-1 flex items-center gap-1.5 text-emerald-800">
          <CheckCircle className="h-3.5 w-3.5" />
          Rework loop closed — {closedRework.reworkNo} re-inspected and released
        </p>
      )}

      {operation.status === 'completed' && latestDecision?.status === 'pass' && !pendingInspection && (
        <p className="mt-1 flex items-center gap-1.5 text-emerald-800">
          <CheckCircle className="h-3.5 w-3.5" />
          QC PASS — {latestDecision.inspectionNo}
          {latestDecision.isReinspection ? ' (after rework)' : ''}
        </p>
      )}

      {latestDecision?.status === 'reject' && (
        <p className="mt-1 flex items-center gap-1.5 text-red-800">
          <AlertTriangle className="h-3.5 w-3.5" />
          REJECT — NCR required.
          {latestDecision.ncrId && (
            <Link to={`/quality/ncr/${latestDecision.ncrId}`} className="font-medium hover:underline">
              View NCR
            </Link>
          )}
        </p>
      )}
    </div>
  )
}
