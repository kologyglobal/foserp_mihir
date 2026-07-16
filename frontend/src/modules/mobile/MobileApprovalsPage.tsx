import { getSessionUser } from '../../utils/permissions'
import { listPendingApprovalsForUser, advanceApprovalStep, rejectApprovalStep } from '../../utils/approvalEngine'
import { APPROVAL_DOCUMENT_LABELS, type ApprovalDocumentType } from '../../types/approvalMatrix'
import { MobilePageTitle, MobileApprovalCard } from '../../components/mobile'
import { mobileCanApprove } from '../../utils/mobilePermissions'
import { useState } from 'react'

export function MobileApprovalsPage() {
  const user = getSessionUser()
  const pending = listPendingApprovalsForUser(user)
  const canAct = mobileCanApprove()
  const [msg, setMsg] = useState('')

  return (
    <>
      <MobilePageTitle title="Approvals" subtitle={`${pending.length} pending`} />
      {!canAct && (
        <div className="mob-card text-sm text-[#605e5c] mb-3">View only — your role cannot approve documents.</div>
      )}
      {pending.map((req) => {
        const step = req.steps[req.currentStepIndex]
        return (
          <MobileApprovalCard
            key={req.id}
            title={APPROVAL_DOCUMENT_LABELS[req.documentType as ApprovalDocumentType]}
            docNo={req.entityLabel}
            requestedBy={req.submittedByName ?? '—'}
            reason={step?.ruleLabel}
            canAct={canAct}
            onApprove={() => {
              const r = advanceApprovalStep(req.documentType, req.entityId, user)
              setMsg(r.ok ? 'Approved' : r.error ?? 'Failed')
            }}
            onReject={(remarks) => {
              const r = rejectApprovalStep(req.documentType, req.entityId, user, remarks)
              setMsg(r.ok ? 'Rejected' : r.error ?? 'Failed')
            }}
          />
        )
      })}
      {pending.length === 0 && <div className="mob-card text-center text-[#605e5c]">No pending approvals</div>}
      {msg && <div className="mob-card text-sm mt-2">{msg}</div>}
    </>
  )
}
