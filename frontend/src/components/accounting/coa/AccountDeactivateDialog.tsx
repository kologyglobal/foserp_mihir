import { useEffect, useState } from 'react'
import { AccountConfirmModal } from './AccountDrawerShell'

export function AccountDeactivateDialog({
  open,
  onClose,
  accountName,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  accountName: string
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) setReason('')
  }, [open])

  const trimmed = reason.trim()
  const canConfirm = trimmed.length > 0

  return (
    <AccountConfirmModal
      open={open}
      onClose={onClose}
      title="Deactivate account"
      description={`Deactivate "${accountName}"? Inactive accounts cannot receive new postings.`}
      confirmLabel="Deactivate"
      destructive
      onConfirm={() => {
        if (canConfirm) onConfirm(trimmed)
      }}
    >
      <div className="mt-4 space-y-1.5">
        <label htmlFor="coa-deactivate-reason" className="text-[12px] font-semibold text-erp-text">
          Reason <span className="text-red-600">*</span>
        </label>
        <textarea
          id="coa-deactivate-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="erp-input w-full resize-y text-[13px]"
          placeholder="e.g. Merged into parent group, obsolete classification…"
        />
        {!canConfirm ? (
          <p className="text-[11px] text-erp-muted">A reason is required before deactivating.</p>
        ) : null}
      </div>
    </AccountConfirmModal>
  )
}
