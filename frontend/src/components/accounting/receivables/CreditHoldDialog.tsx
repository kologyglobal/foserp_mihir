import { useEffect, useState } from 'react'
import { ReceivableConfirmModal } from './ReceivableDrawerShell'
import { notify } from '@/store/toastStore'
import {
  placeCustomerOnHoldDemo,
  releaseCustomerHoldDemo,
  ReceivablesServiceError,
} from '@/services/accounting/receivablesService'
import { CREDIT_HOLD_REASONS, type CreditHoldReason, type CustomerCreditStatus } from '@/types/receivables'

const inputCls =
  'mt-1 h-9 w-full rounded-md border border-erp-border bg-white px-2.5 text-[13px] text-erp-text'
const labelCls = 'block text-[12px] font-medium text-erp-text'

export function CreditHoldDialog({
  open,
  onClose,
  customerId,
  customerName,
  creditStatus,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  customerId: string
  customerName: string
  creditStatus: CustomerCreditStatus
  onSaved?: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const isOnHold = creditStatus === 'Credit Hold'
  const [holdReason, setHoldReason] = useState<CreditHoldReason>('Over Credit Limit')
  const [effectiveDate, setEffectiveDate] = useState(today)
  const [reviewDate, setReviewDate] = useState('')
  const [releaseReason, setReleaseReason] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setHoldReason('Over Credit Limit')
    setEffectiveDate(today)
    setReviewDate('')
    setReleaseReason('')
    setValidUntil('')
    setInternalNote('')
  }, [open, today])

  const handleConfirm = async () => {
    if (!customerId) return
    setBusy(true)
    try {
      if (isOnHold) {
        if (!releaseReason.trim()) {
          notify.error('Release reason is required.')
          return
        }
        await releaseCustomerHoldDemo({
          customerId,
          releaseReason: releaseReason.trim(),
          validUntil: validUntil || today,
          approvedBy: 'Demo approver',
          internalNote: internalNote.trim(),
        })
        notify.success(`Credit hold released for ${customerName} (demo).`)
      } else {
        await placeCustomerOnHoldDemo({
          customerId,
          holdReason,
          effectiveDate,
          reviewDate: reviewDate || today,
          internalNote: internalNote.trim() || holdReason,
        })
        notify.success(`${customerName} placed on credit hold (demo).`)
      }
      onSaved?.()
      onClose()
    } catch (e) {
      notify.error(e instanceof ReceivablesServiceError ? e.message : 'Credit hold action failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ReceivableConfirmModal
      open={open}
      onClose={onClose}
      title={isOnHold ? 'Release credit hold' : 'Place customer on credit hold'}
      description={`${customerName} · Current status: ${creditStatus}`}
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
                placeholder="Management approval, payment received…"
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
                onChange={(e) => setHoldReason(e.target.value as CreditHoldReason)}
              >
                {CREDIT_HOLD_REASONS.map((r) => (
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
        <p className="text-[11px] text-erp-muted">Demo only — no sales order blocks or GL updates are applied.</p>
      </div>
    </ReceivableConfirmModal>
  )
}
