import { CheckCircle, Clock, FileCheck, Send, AlertTriangle } from 'lucide-react'
import { Button } from '../ui/Button'
import { StatusBadge } from '../ui/StatusBadge'
import type { RoutingHeader } from '../../types/routing'
import { ROUTING_ELIGIBLE_STATUSES } from '../../types/routing'

interface RoutingApprovalBarProps {
  routing: RoutingHeader
  hasInactiveWorkCenters: boolean
  onSubmit: () => void
  onApprove: () => void
  onRelease: () => void
}

export function RoutingApprovalBar({
  routing,
  hasInactiveWorkCenters,
  onSubmit,
  onApprove,
  onRelease,
}: RoutingApprovalBarProps) {
  const productionReady = ROUTING_ELIGIBLE_STATUSES.includes(routing.status)

  return (
    <div className="rounded-md border border-erp-border bg-erp-surface p-4 shadow-erp">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <StatusBadge status={routing.status} />
          <div>
            <p className="text-sm font-medium text-erp-text">
              Revision {routing.revision}
              {productionReady && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-erp-success">
                  <CheckCircle className="h-3.5 w-3.5" /> Production Eligible
                </span>
              )}
              {!productionReady && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-erp-warning">
                  <Clock className="h-3.5 w-3.5" /> Not available for production
                </span>
              )}
            </p>
            {routing.submittedAt && (
              <p className="text-xs text-erp-muted">
                Submitted {new Date(routing.submittedAt).toLocaleDateString('en-IN')} by {routing.submittedBy}
              </p>
            )}
            {routing.approvedAt && (
              <p className="text-xs text-erp-muted">
                Approved {new Date(routing.approvedAt).toLocaleDateString('en-IN')} by {routing.approvedBy}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasInactiveWorkCenters && (
            <span className="flex items-center gap-1 rounded-sm bg-red-50 px-2 py-1 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5" /> Inactive work centers
            </span>
          )}
          {routing.status === 'draft' && (
            <Button size="sm" onClick={onSubmit} disabled={hasInactiveWorkCenters}>
              <Send className="h-4 w-4" /> Submit for Approval
            </Button>
          )}
          {routing.status === 'submitted' && (
            <Button size="sm" variant="success" onClick={onApprove} disabled={hasInactiveWorkCenters}>
              <FileCheck className="h-4 w-4" /> Approve Routing
            </Button>
          )}
          {routing.status === 'approved' && (
            <Button size="sm" variant="secondary" onClick={onRelease}>
              Release Routing
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
