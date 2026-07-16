import { CheckCircle, Clock, Shield } from 'lucide-react'
import { Badge } from '../ui/Badge'
import type { ApprovalDocumentType } from '../../types/approvalMatrix'
import { getEntityApprovalSummary, canUserApproveStep, getCurrentStep } from '../../utils/approvalEngine'
import { useApprovalRequestCount } from '../../hooks/useStableStoreData'
import { useApprovalStore } from '../../store/approvalStore'
import { getSessionUser } from '../../utils/permissions'
import { formatDate } from '../../utils/dates/format'
type Props = {
  documentType: ApprovalDocumentType
  entityId: string
  compact?: boolean
}

export function ApprovalChainPanel({ documentType, entityId, compact = false }: Props) {
  const approvers = useApprovalStore((s) => s.approvers)
  useApprovalRequestCount(documentType, entityId)
  const user = getSessionUser()
  const { request, pendingLabel } = getEntityApprovalSummary(documentType, entityId)

  if (!request || request.steps.length === 0) {
    if (compact) return null
    return (
      <div className="rounded-lg border border-dashed border-erp-border bg-erp-surface-alt/30 p-3 text-sm text-erp-muted">
        No matrix approval required — standard permission applies.
      </div>
    )
  }

  const current = getCurrentStep(request)
  const canApprove = current ? canUserApproveStep(user, current, approvers) : false

  return (
    <div className="rounded-lg border border-erp-border bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-erp-text">
          <Shield className="h-4 w-4 text-erp-accent" />
          Approval Workflow
        </h3>
        {request.status === 'approved' ? (
          <Badge color="green">Complete</Badge>
        ) : pendingLabel ? (
          <Badge color="yellow">Pending: {pendingLabel}</Badge>
        ) : null}
      </div>
      <ol className="space-y-2">
        {request.steps.map((step, idx) => {
          const done = step.status === 'approved'
          const active = request.status === 'pending' && idx === request.currentStepIndex
          return (
            <li
              key={`${step.ruleId}-${step.sequence}`}
              className={`flex items-start gap-3 rounded-md border px-3 py-2 text-sm ${
                active ? 'border-amber-200 bg-amber-50' : 'border-erp-border bg-erp-surface-alt/20'
              }`}
            >
              {done ? (
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <Clock className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-amber-600' : 'text-erp-muted'}`} />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{step.approverLabel}</p>
                <p className="text-xs text-erp-muted">{step.ruleLabel}</p>
                {done && step.approvedAt && (
                  <p className="text-xs text-erp-muted">
                    {step.approvedByName} · {formatDate(step.approvedAt.slice(0, 10))}
                  </p>
                )}
              </div>
              {active && canApprove && <Badge color="blue">Your approval</Badge>}
            </li>
          )
        })}
      </ol>
      {request.status === 'pending' && !canApprove && pendingLabel && (
        <p className="mt-3 text-xs text-amber-700">
          You cannot approve this step. Waiting for {pendingLabel}.
        </p>
      )}
    </div>
  )
}

/** Force re-render when requests change */
export function useApprovalRequestRevision(documentType: ApprovalDocumentType, entityId: string): number {
  return useApprovalRequestCount(documentType, entityId)
}
