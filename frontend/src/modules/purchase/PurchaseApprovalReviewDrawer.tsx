import { useEffect, useState } from 'react'
import { CheckCircle, CornerDownLeft, Forward, XCircle } from 'lucide-react'
import { CrmDrawerShell } from '@/components/crm/CrmDrawerShell'
import { ErpButton } from '@/components/erp/ErpButton'
import { Select, Textarea } from '@/components/forms/Inputs'
import { Badge } from '@/components/ui/Badge'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  approvePurchaseDocument,
  delegatePurchaseApproval,
  getPurchaseApprovalReview,
  PURCHASE_APPROVAL_ROLE_LABELS,
  PURCHASE_APPROVAL_ROLES,
  PurchaseServiceError,
  rejectPurchaseDocument,
  sendBackPurchaseDocument,
} from '@/services/purchase'
import type {
  PurchaseApprovalReviewDetail,
  PurchaseApprovalRole,
} from '@/types/purchaseDomain'
import { actorForApprovalRole } from '@/utils/purchaseApprovalMatrix'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'

type DrawerMode = 'review' | 'history'

function delegateOptionLabel(role: PurchaseApprovalRole): string {
  const actor = actorForApprovalRole(role)
  return `${actor.name} — ${PURCHASE_APPROVAL_ROLE_LABELS[role]}`
}

export function PurchaseApprovalReviewDrawer({
  open,
  approvalId,
  mode = 'review',
  onClose,
  onChanged,
}: {
  open: boolean
  approvalId: string | null
  mode?: DrawerMode
  onClose: () => void
  onChanged: () => void
}) {
  const [detail, setDetail] = useState<PurchaseApprovalReviewDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [delegateRole, setDelegateRole] = useState<PurchaseApprovalRole>('purchase_head')

  useEffect(() => {
    if (!open || !approvalId) {
      setDetail(null)
      setComment('')
      return
    }
    let cancelled = false
    setLoading(true)
    void getPurchaseApprovalReview(approvalId)
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch((err) => {
        notify.error(err instanceof PurchaseServiceError ? err.message : 'Failed to load approval')
        onClose()
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, approvalId, onClose])

  const canAct = detail?.row.status === 'pending' && detail.row.canAct && mode === 'review'

  const runAction = async (kind: 'approve' | 'reject' | 'send_back' | 'delegate') => {
    if (!detail) return
    if ((kind === 'reject' || kind === 'send_back') && !comment.trim()) {
      notify.error('Comments are mandatory for reject and send-back')
      return
    }
    setBusy(true)
    try {
      const { documentType, documentId, approvalId: id } = {
        documentType: detail.row.documentType,
        documentId: detail.row.documentId,
        approvalId: detail.row.approvalId,
      }
      if (kind === 'approve') {
        await approvePurchaseDocument(documentType, documentId, comment.trim() || 'Approved')
        notify.success('Approved')
      } else if (kind === 'reject') {
        await rejectPurchaseDocument(documentType, documentId, comment.trim())
        notify.success('Rejected')
      } else if (kind === 'send_back') {
        await sendBackPurchaseDocument(documentType, documentId, comment.trim())
        notify.success('Sent back for correction')
      } else {
        await delegatePurchaseApproval(id, delegateRole, comment.trim())
        notify.success(`Delegated to ${delegateOptionLabel(delegateRole)}`)
      }
      onChanged()
      onClose()
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <CrmDrawerShell
      open={open}
      onClose={onClose}
      eyebrow="Purchase"
      title={mode === 'history' ? 'Approval History' : 'Approval Review'}
      subtitle={detail ? `${detail.row.documentTypeLabel} · ${detail.row.documentNumber}` : undefined}
      width="lg"
      footer={
        canAct ? (
          <div className="flex flex-wrap gap-2">
            <ErpButton
              type="button"
              variant="success"
              icon={CheckCircle}
              disabled={busy}
              onClick={() => void runAction('approve')}
            >
              Approve
            </ErpButton>
            <ErpButton
              type="button"
              variant="danger"
              icon={XCircle}
              disabled={busy}
              onClick={() => void runAction('reject')}
            >
              Reject
            </ErpButton>
            <ErpButton
              type="button"
              variant="secondary"
              icon={CornerDownLeft}
              disabled={busy}
              onClick={() => void runAction('send_back')}
            >
              Send Back
            </ErpButton>
          </div>
        ) : null
      }
    >
      {loading || !detail ? (
        <LoadingState variant="form" rows={6} />
      ) : (
        <div className="space-y-5 text-[13px]">
          <section className="rounded-md border border-erp-border p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
              Document summary
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <span className="text-erp-muted">Requester</span>
                <p className="font-medium">{detail.row.requestedBy}</p>
              </div>
              <div>
                <span className="text-erp-muted">Department</span>
                <p className="font-medium">{detail.row.department || '—'}</p>
              </div>
              <div>
                <span className="text-erp-muted">Location</span>
                <p className="font-medium">{detail.row.locationName}</p>
              </div>
              <div>
                <span className="text-erp-muted">Amount</span>
                <p className="font-medium">{formatCurrency(detail.row.amount)}</p>
              </div>
              <div>
                <span className="text-erp-muted">Priority</span>
                <p className="font-medium">{detail.row.priorityLabel}</p>
              </div>
              <div>
                <span className="text-erp-muted">Approval level</span>
                <p className="font-medium">{detail.row.approvalLevelLabel}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-erp-muted">Required chain</span>
                <p className="font-medium">
                  {detail.chainRoles.map((r) => PURCHASE_APPROVAL_ROLE_LABELS[r]).join(' → ')}
                </p>
              </div>
              {detail.purpose ? (
                <div className="sm:col-span-2">
                  <span className="text-erp-muted">Purpose</span>
                  <p className="font-medium">{detail.purpose}</p>
                </div>
              ) : null}
            </div>
          </section>

          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
              Requisition / PO lines
            </p>
            <div className="overflow-x-auto rounded-md border border-erp-border">
              <table className="erp-table text-[12px]">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Code</th>
                    <th>Description</th>
                    <th className="num">Qty</th>
                    <th>UOM</th>
                    <th className="num">Rate</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((l) => (
                    <tr key={l.lineNo}>
                      <td>{l.lineNo}</td>
                      <td className="font-mono">{l.itemCode}</td>
                      <td>{l.itemName}</td>
                      <td className="num">{l.quantity}</td>
                      <td>{l.uom}</td>
                      <td className="num">{formatCurrency(l.rate)}</td>
                      <td className="num">{formatCurrency(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-md border border-dashed border-erp-border bg-erp-surface-alt/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
              Available budget (placeholder)
            </p>
            <p className="mt-1 text-lg font-semibold text-erp-text">
              {formatCurrency(detail.availableBudgetPlaceholderInr)}
            </p>
            <p className="mt-1 text-[12px] text-erp-muted">
              Configure placeholder in Purchase Setup — live budget check deferred.
            </p>
          </section>

          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
              Previous approvals
            </p>
            {detail.previousApprovals.length === 0 ? (
              <p className="text-erp-muted">No prior approval activity.</p>
            ) : (
              <ul className="divide-y divide-erp-border rounded-md border border-erp-border">
                {detail.previousApprovals.map((h) => (
                  <li key={h.id} className="px-3 py-2">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium capitalize">{h.action.replace(/_/g, ' ')}</span>
                      <span className="text-erp-muted">{formatDate(h.actedAt.slice(0, 10))}</span>
                    </div>
                    <p className="text-erp-muted">
                      {h.actorName}
                      {h.remarks ? ` · ${h.remarks}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
              Requester remarks
            </p>
            <p>{detail.requesterRemarks || '—'}</p>
          </section>

          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
              Attachments
            </p>
            {detail.attachments.length === 0 ? (
              <p className="text-erp-muted">No attachments.</p>
            ) : (
              <ul className="space-y-1">
                {detail.attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <Badge color="blue">{a.mimeType.split('/')[1] ?? 'file'}</Badge>
                    <span>{a.fileName}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canAct ? (
            <>
              <section>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                  Approval comment
                </label>
                <Textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Required for Reject and Send Back"
                />
              </section>
              <section className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                    Delegate to
                  </label>
                  <Select
                    native
                    value={delegateRole}
                    onChange={(e) => setDelegateRole(e.target.value as PurchaseApprovalRole)}
                    aria-label="Delegate to approver"
                  >
                    {PURCHASE_APPROVAL_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {delegateOptionLabel(role)}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1 text-[11px] text-erp-muted">
                    Approvers from Purchase Setup matrix (demo users).
                  </p>
                </div>
                <ErpButton
                  type="button"
                  variant="outline"
                  icon={Forward}
                  disabled={busy}
                  onClick={() => void runAction('delegate')}
                >
                  Delegate
                </ErpButton>
              </section>
            </>
          ) : null}
        </div>
      )}
    </CrmDrawerShell>
  )
}
