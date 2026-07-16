import { CheckCircle, Clock, FileCheck, Send, AlertTriangle } from 'lucide-react'
import { Button } from '../ui/Button'
import { StatusBadge } from '../ui/StatusBadge'
import type { BomHeader } from '../../types/bom'
import { MRP_ELIGIBLE_STATUSES } from '../../types/bom'
import { ApprovalChainPanel } from '../approval/ApprovalChainPanel'

interface BomApprovalBarProps {
  bom: BomHeader
  hasInactiveItems: boolean
  onSubmit: () => void
  onApprove: () => void
  onRelease: () => void
}

export function BomApprovalBar({
  bom,
  hasInactiveItems,
  onSubmit,
  onApprove,
  onRelease,
}: BomApprovalBarProps) {
  const mrpReady = MRP_ELIGIBLE_STATUSES.includes(bom.status)

  return (
    <div className="space-y-3">
    <div className="rounded-lg border border-erp-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <StatusBadge status={bom.status} />
          <div>
            <p className="text-sm font-medium text-slate-800">
              Revision {bom.revision}
              {mrpReady && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle className="h-3.5 w-3.5" /> MRP Eligible
                </span>
              )}
              {!mrpReady && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-600">
                  <Clock className="h-3.5 w-3.5" /> Not available for MRP
                </span>
              )}
            </p>
            {bom.submittedAt && (
              <p className="text-xs text-slate-500">
                Submitted {new Date(bom.submittedAt).toLocaleDateString('en-IN')} by {bom.submittedBy}
              </p>
            )}
            {bom.approvedAt && (
              <p className="text-xs text-slate-500">
                Approved {new Date(bom.approvedAt).toLocaleDateString('en-IN')} by {bom.approvedBy}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {hasInactiveItems && (
            <span className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5" /> Inactive items present
            </span>
          )}
          {bom.status === 'draft' && (
            <Button size="sm" onClick={onSubmit} disabled={hasInactiveItems}>
              <Send className="h-4 w-4" /> Submit for Approval
            </Button>
          )}
          {bom.status === 'submitted' && (
            <Button size="sm" variant="success" onClick={onApprove} disabled={hasInactiveItems}>
              <FileCheck className="h-4 w-4" /> Approve BOM
            </Button>
          )}
          {bom.status === 'approved' && (
            <Button size="sm" variant="secondary" onClick={onRelease}>
              Release BOM
            </Button>
          )}
        </div>
      </div>
    </div>
    {(bom.status === 'submitted' || bom.status === 'draft') && (
      <ApprovalChainPanel documentType="bom_revision" entityId={bom.id} />
    )}
    </div>
  )
}
