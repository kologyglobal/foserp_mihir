import { useState } from 'react'
import { AccountDrawerShell } from '@/components/accounting/coa/AccountDrawerShell'
import type { AccountingVoucher } from '@/types/vouchers'
import { VOUCHER_LIFECYCLE_LABELS } from '@/types/vouchers'
import { VoucherStatusBadge } from './VoucherBadges'

export function VoucherApprovalDrawer({
  open,
  onClose,
  voucher,
  canApprove,
  canReject,
  canSendBack,
  onApprove,
  onReject,
  onSendBack,
  busy,
}: {
  open: boolean
  onClose: () => void
  voucher: AccountingVoucher | null
  canApprove: boolean
  canReject: boolean
  canSendBack: boolean
  onApprove: (comment?: string) => void
  onReject: (reason: string) => void
  onSendBack: (reason: string) => void
  busy?: boolean
}) {
  const [comment, setComment] = useState('')
  const [mode, setMode] = useState<'approve' | 'reject' | 'send_back'>('approve')

  if (!voucher) return null

  return (
    <AccountDrawerShell
      open={open}
      onClose={onClose}
      title="Approval & activity"
      subtitle={voucher.voucherNumber}
      widthClassName="max-w-lg"
      footer={
        voucher.status === 'pending_approval' ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {canApprove ? (
                <button
                  type="button"
                  className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
                  disabled={busy}
                  onClick={() => {
                    setMode('approve')
                    onApprove(comment || undefined)
                  }}
                >
                  Approve
                </button>
              ) : null}
              {canSendBack ? (
                <button
                  type="button"
                  className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]"
                  disabled={busy || !comment.trim()}
                  onClick={() => {
                    setMode('send_back')
                    onSendBack(comment)
                  }}
                >
                  Send back
                </button>
              ) : null}
              {canReject ? (
                <button
                  type="button"
                  className="erp-btn erp-btn-ghost h-9 px-3 text-[13px] text-red-700"
                  disabled={busy || !comment.trim()}
                  onClick={() => {
                    setMode('reject')
                    onReject(comment)
                  }}
                >
                  Reject
                </button>
              ) : null}
            </div>
            <p className="text-[11px] text-erp-muted">
              {mode === 'approve'
                ? 'Comment optional for approve.'
                : 'Reason required for reject / send back.'}
            </p>
          </div>
        ) : (
          <p className="text-[12px] text-erp-muted">Current status: {VOUCHER_LIFECYCLE_LABELS[voucher.status]}</p>
        )
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <VoucherStatusBadge status={voucher.status} />
        <span className="text-[12px] text-erp-muted">{voucher.narration}</span>
      </div>
      {voucher.status === 'pending_approval' ? (
        <label className="mb-4 block text-[12px] font-medium text-erp-text">
          Comment / reason
          <textarea
            className="mt-1 w-full rounded-md border border-erp-border px-3 py-2 text-[13px]"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional for approve; required for reject / send back"
          />
        </label>
      ) : null}
      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Approval trail</h3>
      <ul className="space-y-2">
        {voucher.approvalTrail.length === 0 ? (
          <li className="text-[13px] text-erp-muted">No approval events yet.</li>
        ) : (
          voucher.approvalTrail.map((e) => (
            <li key={e.id} className="rounded border border-erp-border px-3 py-2 text-[13px]">
              <div className="flex justify-between gap-2">
                <span className="font-medium capitalize">{e.action.replace('_', ' ')}</span>
                <span className="tabular-nums text-[11px] text-erp-muted">{e.at.slice(0, 16).replace('T', ' ')}</span>
              </div>
              <p className="text-erp-muted">{e.by}</p>
              {e.comment ? <p className="mt-1 text-[12px]">{e.comment}</p> : null}
            </li>
          ))
        )}
      </ul>
    </AccountDrawerShell>
  )
}
