import { useEffect, useState } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { ErpButton } from '@/components/erp/ErpButton'
import { LoadingState } from '@/design-system/components/LoadingState'
import { notify } from '@/store/toastStore'
import { fetchTransferReversalPreview, reverseTransfer } from '../api/treasury-transfer.api'
import type { TransferReversalPreviewDto, TreasuryTransferDto } from '../api/treasury-transfer.types'
import { formatAccountLabel, formatTransferAmount, todayIsoDate } from '../utils/format'
import { useIdempotencyKey } from '../utils/idempotency'
import { TransferAccountingPreviewPanel } from './TransferAccountingPreviewPanel'

export function ReverseTransferModal({
  open,
  transfer,
  onClose,
  onSuccess,
}: {
  open: boolean
  transfer: TreasuryTransferDto | null
  onClose: () => void
  onSuccess: (updated: TreasuryTransferDto) => void
}) {
  const [busy, setBusy] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [preview, setPreview] = useState<TransferReversalPreviewDto | null>(null)
  const [reversalDate, setReversalDate] = useState(todayIsoDate())
  const [reason, setReason] = useState('')
  const getKey = useIdempotencyKey(transfer ? `reverse-${transfer.id}-${transfer.updatedAt}` : 'reverse-none')

  useEffect(() => {
    if (!open || !transfer) return
    setPreview(null)
    setReversalDate(todayIsoDate())
    setReason('')
    setLoadingPreview(true)
    fetchTransferReversalPreview(transfer.id)
      .then(setPreview)
      .catch((e) => notify.error(e instanceof Error ? e.message : 'Failed to load reversal preview'))
      .finally(() => setLoadingPreview(false))
  }, [open, transfer])

  if (!transfer) return null

  const confirm = async () => {
    if (!reason.trim()) {
      notify.error('Reversal reason is required')
      return
    }
    setBusy(true)
    try {
      const updated = await reverseTransfer(transfer.id, {
        expectedUpdatedAt: transfer.updatedAt,
        reversalDate,
        reason: reason.trim(),
        idempotencyKey: getKey(),
      })
      notify.success(`${updated.transferNumber ?? updated.draftReference} reversed`)
      onSuccess(updated)
      onClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Reversal failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reverse transfer"
      description="Posts an offsetting reversal for both legs of this completed transfer. This cannot be undone."
      size="lg"
      closeDisabled={busy}
      footer={
        <div className="flex justify-end gap-2">
          <ErpButton variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </ErpButton>
          <ErpButton variant="danger" onClick={() => void confirm()} loading={busy} disabled={!reason.trim()}>
            Confirm reversal
          </ErpButton>
        </div>
      }
    >
      <div className="space-y-3 text-[13px]">
        <div className="grid gap-2 sm:grid-cols-2">
          <p>
            <span className="text-erp-muted">From:</span> {formatAccountLabel(transfer.sourceAccount)}
          </p>
          <p>
            <span className="text-erp-muted">To:</span> {formatAccountLabel(transfer.destinationAccount)}
          </p>
          <p>
            <span className="text-erp-muted">Amount:</span>{' '}
            <span className="font-semibold tabular-nums">{formatTransferAmount(transfer.transferAmount)}</span>
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Reversal date</label>
            <input
              type="date"
              className="erp-input text-[13px]"
              value={reversalDate}
              onChange={(e) => setReversalDate(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Reason (required)</label>
            <input
              className="erp-input text-[13px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
              placeholder="Why is this transfer being reversed?"
            />
          </div>
        </div>

        {loadingPreview ? (
          <LoadingState variant="form" />
        ) : (
          <TransferAccountingPreviewPanel
            preview={
              preview
                ? { postingMode: preview.postingMode, sourceLines: preview.sourceLines, destinationLines: preview.destinationLines, warnings: preview.warnings }
                : null
            }
          />
        )}
      </div>
    </Modal>
  )
}
