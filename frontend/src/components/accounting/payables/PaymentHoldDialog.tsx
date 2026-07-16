import { useEffect, useState } from 'react'
import { PayableConfirmModal } from './PayableDrawerShell'
import { notify } from '@/store/toastStore'
import type { PayableVendorStatus } from '@/types/payables'

export type PaymentHoldReason =
  | 'Open Dispute'
  | 'Bank Details Unverified'
  | 'Quality Issue'
  | 'Management Decision'
  | 'Compliance Issue'
  | 'Duplicate Invoice'
  | 'Other'

export const PAYMENT_HOLD_REASONS: PaymentHoldReason[] = [
  'Open Dispute',
  'Bank Details Unverified',
  'Quality Issue',
  'Management Decision',
  'Compliance Issue',
  'Duplicate Invoice',
  'Other',
]

const inputCls =
  'mt-1 h-9 w-full rounded-md border border-erp-border bg-white px-2.5 text-[13px] text-erp-text'
const labelCls = 'block text-[12px] font-medium text-erp-text'

export function PaymentHoldDialog({
  open,
  onClose,
  vendorId,
  vendorName,
  vendorStatus,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  vendorId: string
  vendorName: string
  vendorStatus: PayableVendorStatus
  onSaved?: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const isOnHold = vendorStatus === 'On Hold'
  const [holdReason, setHoldReason] = useState<PaymentHoldReason>('Open Dispute')
  const [effectiveDate, setEffectiveDate] = useState(today)
  const [reviewDate, setReviewDate] = useState('')
  const [releaseReason, setReleaseReason] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setHoldReason('Open Dispute')
    setEffectiveDate(today)
    setReviewDate('')
    setReleaseReason('')
    setValidUntil('')
    setInternalNote('')
  }, [open, today])

  const handleConfirm = async () => {
    if (!vendorId) return
    setBusy(true)
    try {
      if (isOnHold) {
        if (!releaseReason.trim()) {
          notify.error('Release reason is required.')
          return
        }
        notify.success(`Payment hold released for ${vendorName} (demo).`)
      } else {
        notify.success(`${vendorName} placed on payment hold (demo).`)
      }
      onSaved?.()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <PayableConfirmModal
      open={open}
      onClose={onClose}
      title={isOnHold ? 'Release payment hold' : 'Place vendor on payment hold'}
      description={`${vendorName} · Current status: ${vendorStatus}`}
      confirmLabel={busy ? 'Saving…' : isOnHold ? 'Release hold' : 'Place on hold'}
      onConfirm={() => void handleConfirm()}
    >
      <div className="mt-4 space-y-3">
        {isOnHold ? (
          <>
            <label className={labelCls}>
              Release reason
              <input
                type="text"
                className={inputCls}
                value={releaseReason}
                onChange={(e) => setReleaseReason(e.target.value)}
                placeholder="Dispute resolved, bank verified…"
              />
            </label>
            <label className={labelCls}>
              Valid until
              <input
                type="date"
                className={inputCls}
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            <label className={labelCls}>
              Hold reason
              <select
                className={inputCls}
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value as PaymentHoldReason)}
              >
                {PAYMENT_HOLD_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              Effective date
              <input
                type="date"
                className={inputCls}
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </label>
            <label className={labelCls}>
              Review date
              <input
                type="date"
                className={inputCls}
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
              />
            </label>
          </>
        )}
        <label className={labelCls}>
          Internal note
          <textarea
            className="mt-1 w-full rounded-md border border-erp-border px-2.5 py-2 text-[13px]"
            rows={2}
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
          />
        </label>
        <p className="text-[11px] text-erp-muted">Demo only — no payment blocks or GL updates are applied.</p>
      </div>
    </PayableConfirmModal>
  )
}
