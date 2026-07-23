import { useCallback, useEffect, useState } from 'react'
import { isApiMode } from '@/config/apiConfig'
import {
  approvePurchaseDocument,
  getPurchaseApprovalQueue,
  rejectPurchaseDocument,
} from '@/services/purchase/purchaseApiFacade'
import type { PurchaseApprovalQueueRow } from '@/types/purchaseDomain'
import { gateService } from '@/modules/gate/api/gateService'
import type { GateApproval } from '@/modules/gate/types/gate.types'
import { getSessionUser } from '../../utils/permissions'
import { listPendingApprovalsForUser, advanceApprovalStep, rejectApprovalStep } from '../../utils/approvalEngine'
import { APPROVAL_DOCUMENT_LABELS, type ApprovalDocumentType } from '../../types/approvalMatrix'
import { MobilePageTitle, MobileApprovalCard } from '../../components/mobile'
import { mobileCanApprove } from '../../utils/mobilePermissions'

export function MobileApprovalsPage() {
  const user = getSessionUser()
  const canAct = mobileCanApprove()
  const demoPending = listPendingApprovalsForUser(user)
  const [purchaseRows, setPurchaseRows] = useState<PurchaseApprovalQueueRow[]>([])
  const [gateRows, setGateRows] = useState<GateApproval[]>([])
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!isApiMode()) return
    setLoading(true)
    setMsg('')
    try {
      const [purchase, gate] = await Promise.all([
        getPurchaseApprovalQueue('pending_mine'),
        gateService.getGateApprovals({ status: 'pending' }).catch(() => [] as GateApproval[]),
      ])
      setPurchaseRows(purchase)
      setGateRows(gate)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not load approvals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!isApiMode()) {
    return (
      <>
        <MobilePageTitle title="Approvals" subtitle={`${demoPending.length} pending (demo)`} />
        {!canAct && (
          <div className="mob-card text-sm text-[#605e5c] mb-3">View only — your role cannot approve documents.</div>
        )}
        {demoPending.map((req) => {
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
        {demoPending.length === 0 && <div className="mob-card text-center text-[#605e5c]">No pending approvals</div>}
        {msg && <div className="mob-card text-sm mt-2">{msg}</div>}
      </>
    )
  }

  const total = purchaseRows.length + gateRows.length

  return (
    <>
      <MobilePageTitle title="Approvals" subtitle={loading ? 'Loading…' : `${total} pending`} />
      {!canAct && (
        <div className="mob-card text-sm text-[#605e5c] mb-3">View only — your role cannot approve documents.</div>
      )}

      {purchaseRows.map((row) => (
        <MobileApprovalCard
          key={row.approvalId}
          title={row.documentTypeLabel}
          docNo={row.documentNumber}
          requestedBy={row.requestedBy}
          reason={`${row.approvalLevelLabel} · ${row.amount}`}
          canAct={canAct && row.canAct}
          onApprove={() => {
            void approvePurchaseDocument(row.documentType, row.documentId, 'Approved from mobile')
              .then(() => {
                setMsg(`Approved ${row.documentNumber}`)
                return load()
              })
              .catch((err) => setMsg(err instanceof Error ? err.message : 'Approve failed'))
          }}
          onReject={(remarks) => {
            void rejectPurchaseDocument(row.documentType, row.documentId, remarks || 'Rejected from mobile')
              .then(() => {
                setMsg(`Rejected ${row.documentNumber}`)
                return load()
              })
              .catch((err) => setMsg(err instanceof Error ? err.message : 'Reject failed'))
          }}
        />
      ))}

      {gateRows.map((row) => (
        <MobileApprovalCard
          key={row.id}
          title="Gate approval"
          docNo={row.requestNumber}
          requestedBy={row.requestedBy}
          reason={row.subject || row.reason}
          canAct={canAct}
          onApprove={() => {
            void gateService
              .approveGateRequest(row.id, 'Approved from mobile')
              .then(() => {
                setMsg('Gate request approved')
                return load()
              })
              .catch((err) => setMsg(err instanceof Error ? err.message : 'Approve failed'))
          }}
          onReject={(remarks) => {
            void gateService
              .rejectGateRequest(row.id, remarks || 'Rejected from mobile')
              .then(() => {
                setMsg('Gate request rejected')
                return load()
              })
              .catch((err) => setMsg(err instanceof Error ? err.message : 'Reject failed'))
          }}
        />
      ))}

      {total === 0 && !loading && <div className="mob-card text-center text-[#605e5c]">No pending approvals</div>}
      {msg && <div className="mob-card text-sm mt-2">{msg}</div>}
    </>
  )
}
