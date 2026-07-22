import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { useCrmStore } from '../../store/crmStore'
import { resolveStoreAction } from '../../store/storeAction'
import { notify } from '../../store/toastStore'
import { APPROVAL_AMOUNT_THRESHOLD, DISCOUNT_APPROVAL_THRESHOLD } from '../../types/crm'
import { LiveStatusBadge } from '../premium/LiveStatusBadge'
import { quotationStatusLabel, quotationStatusTone } from './QuotationCrmCard'
import { cn } from '../../utils/cn'
import { systemConfirm, systemPrompt } from '../../utils/systemConfirm'
import { canCrmPermission } from '../../utils/permissions/crm'
import { ErpButton } from '../erp/ErpButton'

interface QuotationApprovalPanelProps {
  documentId: string
}

export function QuotationApprovalPanel({ documentId }: QuotationApprovalPanelProps) {
  const doc = useCrmStore((s) => s.getQuotationDocument(documentId))
  const approve = useCrmStore((s) => s.approveQuotationDocument)
  const reject = useCrmStore((s) => s.rejectQuotationDocument)
  const [busy, setBusy] = useState(false)
  const canApprovePerm = canCrmPermission('crm.quotation.approve')

  if (!doc) return null

  const maxDiscount = doc.priceLines.reduce((m, l) => Math.max(m, l.discountPct), 0)
  const needsDirector = doc.totalAmount > APPROVAL_AMOUNT_THRESHOLD
  const needsDiscountApproval = maxDiscount > DISCOUNT_APPROVAL_THRESHOLD

  async function handleApprove() {
    if (!canApprovePerm || busy) return
    setBusy(true)
    try {
      const r = await resolveStoreAction(approve(documentId, 'Approved by manager'))
      if (!r.ok) {
        notify.error(r.error ?? 'Could not approve quotation')
        return
      }
      notify.success('Quotation approved')
    } finally {
      setBusy(false)
    }
  }

  async function handleReject() {
    if (!canApprovePerm || busy) return
    const ok = await systemConfirm({
      title: 'Reject quotation?',
      description: 'This quotation will be marked rejected. You can create a revision afterward.',
      confirmLabel: 'Continue',
      cancelLabel: 'Cancel',
      variant: 'danger',
    })
    if (!ok) return
    const remarks = await systemPrompt({
      title: 'Rejection remarks',
      fieldLabel: 'Remarks',
      placeholder: 'Why is this quotation being rejected?',
      confirmLabel: 'Reject',
      variant: 'danger',
      required: true,
    })
    if (!remarks) return
    setBusy(true)
    try {
      const r = await resolveStoreAction(reject(documentId, remarks))
      if (!r.ok) {
        notify.error(r.error ?? 'Could not reject quotation')
        return
      }
      notify.success('Quotation rejected')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-erp-border bg-erp-surface p-4 shadow-[var(--erp-shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Current status</p>
          <LiveStatusBadge label={quotationStatusLabel(doc.status)} tone={quotationStatusTone(doc.status)} pulse={false} />
        </div>

        {(needsDirector || needsDiscountApproval) && doc.status === 'pending_approval' ? (
          <div className="mt-3 space-y-2">
            {needsDirector ? (
              <div className="flex items-start gap-2 rounded-lg border border-erp-warning/30 bg-erp-warning-soft/30 px-3 py-2 text-[12px] text-erp-warning-fg">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Director approval required — total above ₹50L threshold
              </div>
            ) : null}
            {needsDiscountApproval ? (
              <div className="flex items-start gap-2 rounded-lg border border-erp-warning/30 bg-erp-warning-soft/30 px-3 py-2 text-[12px] text-erp-warning-fg">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Discount approval required — max {maxDiscount}% exceeds {DISCOUNT_APPROVAL_THRESHOLD}%
              </div>
            ) : null}
          </div>
        ) : null}

        {doc.status === 'pending_approval' ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <ErpButton
              type="button"
              variant="primary"
              icon={CheckCircle}
              className="flex-1 sm:flex-none"
              disabled={!canApprovePerm || busy}
              disabledReason={!canApprovePerm ? 'Requires crm.quotation.approve' : undefined}
              onClick={() => void handleApprove()}
            >
              {busy ? 'Working…' : 'Approve'}
            </ErpButton>
            <ErpButton
              type="button"
              variant="danger"
              icon={XCircle}
              className="flex-1 sm:flex-none"
              disabled={!canApprovePerm || busy}
              disabledReason={!canApprovePerm ? 'Requires crm.quotation.approve' : undefined}
              onClick={() => void handleReject()}
            >
              Reject
            </ErpButton>
          </div>
        ) : null}

        {doc.approvedByName ? (
          <p className="mt-3 text-[12px] text-erp-muted">Approved by {doc.approvedByName}</p>
        ) : null}
      </div>

      {(doc.approvalHistory?.length ?? 0) > 0 ? (
        <div className="rounded-xl border border-erp-border bg-erp-surface p-4 shadow-[var(--erp-shadow-card)]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Approval history</p>
          <ul className="mt-3 space-y-3">
            {doc.approvalHistory.map((h) => (
              <li key={h.id} className="flex gap-3 border-b border-erp-border/60 pb-3 last:border-0 last:pb-0">
                <div
                  className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                    h.action === 'approved' ? 'bg-erp-success-soft text-erp-success' : 'bg-erp-danger-soft text-erp-danger',
                  )}
                >
                  {h.action === 'approved' ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold capitalize text-erp-text">{h.action} by {h.byName}</p>
                  <p className="text-[11px] text-erp-muted">{new Date(h.at).toLocaleString('en-IN')}</p>
                  {h.remarks ? <p className="mt-1 text-[12px] text-erp-muted">{h.remarks}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="py-6 text-center text-[13px] text-erp-muted">No approval actions recorded yet.</p>
      )}
    </div>
  )
}
