import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErpButton } from '@/components/erp/ErpButton'
import { Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  approveJournal,
  getApprovalRequest,
  rejectJournal,
  sendBackJournal,
} from '@/services/bridges/approvalApiBridge'
import type { ApprovalRequest } from '@/types/approvals'
import { useFinancePermissions } from '@/utils/permissions/finance'
import { notify } from '@/store/toastStore'
import { JournalsWorkspaceShell } from './JournalsWorkspaceShell'

export function ApprovalDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useFinancePermissions()
  const [request, setRequest] = useState<ApprovalRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState('')
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      setRequest(await getApprovalRequest(id))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load approval')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (perms.canApproveVoucher) void load()
  }, [load, perms.canApproveVoucher])

  const runApprove = async () => {
    if (!request) return
    setActing(true)
    try {
      await approveJournal(request.documentId)
      notify.success('Journal approved')
      navigate(`/accounting/entries/journals/${request.documentId}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Approve failed')
    } finally {
      setActing(false)
    }
  }

  const runSendBack = async () => {
    if (!request || !comments.trim()) {
      notify.error('Comments are required when sending back')
      return
    }
    setActing(true)
    try {
      await sendBackJournal(request.documentId, comments.trim())
      notify.success('Journal sent back to maker')
      navigate(`/accounting/entries/journals/${request.documentId}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Send back failed')
    } finally {
      setActing(false)
    }
  }

  const runReject = async () => {
    if (!request || !comments.trim()) {
      notify.error('Comments are required when rejecting')
      return
    }
    setActing(true)
    try {
      await rejectJournal(request.documentId, comments.trim())
      notify.success('Journal rejected')
      navigate(`/accounting/entries/journals/${request.documentId}`)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Reject failed')
    } finally {
      setActing(false)
    }
  }

  if (!perms.canApproveVoucher) {
    return (
      <JournalsWorkspaceShell title="Approval" activeTab="approvals">
        <p className="text-[13px] text-erp-muted">You do not have permission to review approvals.</p>
      </JournalsWorkspaceShell>
    )
  }

  if (loading || !request) {
    return (
      <JournalsWorkspaceShell title="Approval" activeTab="approvals">
        {loading ? <LoadingState variant="form" /> : <p className="text-[13px] text-erp-muted">Approval not found.</p>}
      </JournalsWorkspaceShell>
    )
  }

  const actions = request.allowedActions

  return (
    <JournalsWorkspaceShell
      title={request.documentNumberSnapshot ?? 'Journal approval'}
      description={`Cycle ${request.cycleNumber} · Level ${request.currentLevel} of ${request.totalLevels} · ${request.status.replace(/_/g, ' ')}`}
      activeTab="approvals"
      actions={
        <div className="flex flex-wrap gap-2">
          {actions?.approve ? (
            <ErpButton variant="primary" disabled={acting} onClick={() => void runApprove()}>
              Approve
            </ErpButton>
          ) : null}
          {actions?.sendBack ? (
            <ErpButton variant="secondary" disabled={acting} onClick={() => void runSendBack()}>
              Send back
            </ErpButton>
          ) : null}
          {actions?.reject ? (
            <ErpButton variant="secondary" disabled={acting} onClick={() => void runReject()}>
              Reject
            </ErpButton>
          ) : null}
        </div>
      }
    >
      <div className="mb-4 grid gap-3 md:grid-cols-3 text-[12px]">
        <div>
          <span className="text-erp-muted">Amount</span>
          <div className="font-medium tabular-nums">{request.amountBasis}</div>
        </div>
        <div>
          <span className="text-erp-muted">Document</span>
          <div className="font-medium">{request.documentType}</div>
        </div>
        <div>
          <span className="text-erp-muted">Requested</span>
          <div className="font-medium">{new Date(request.requestedAt).toLocaleString()}</div>
        </div>
      </div>

      <div className="mb-4 rounded border border-erp-border p-3 text-[12px]">
        <div className="mb-2 font-medium">Approval steps</div>
        <ul className="space-y-2">
          {(request.steps ?? []).map((step) => (
            <li key={step.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-erp-border/60 pb-2">
              <span>
                Level {step.level} — {step.status.replace(/_/g, ' ')}
              </span>
              {step.comments ? <span className="text-erp-muted">{step.comments}</span> : null}
            </li>
          ))}
        </ul>
      </div>

      {(actions?.sendBack || actions?.reject) && request.status === 'PENDING' ? (
        <div className="mb-4">
          <label className="mb-1 block text-[12px] font-medium">Comments (required for send back / reject)</label>
          <Textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Reason for send back or rejection" />
        </div>
      ) : null}

      <Link className="text-[12px] text-sky-700 hover:underline" to={`/accounting/entries/journals/${request.documentId}`}>
        Open journal →
      </Link>
    </JournalsWorkspaceShell>
  )
}
