import { useState } from 'react'
import { Modal } from '@/design-system/components/Modal'
import { ErpButton } from '@/components/erp/ErpButton'
import { notify } from '@/store/toastStore'
import { receiveTransfer } from '../api/treasury-transfer.api'
import type { TreasuryTransferDto } from '../api/treasury-transfer.types'
import { formatAccountLabel, formatTransferAmount } from '../utils/format'
import { useIdempotencyKey } from '../utils/idempotency'

export function ReceiveTransferModal({
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
  const getKey = useIdempotencyKey(transfer ? `receive-${transfer.id}-${transfer.updatedAt}` : 'receive-none')

  if (!transfer) return null

  const confirm = async () => {
    setBusy(true)
    try {
      const updated = await receiveTransfer(transfer.id, { expectedUpdatedAt: transfer.updatedAt, idempotencyKey: getKey() })
      notify.success(`${updated.transferNumber ?? updated.draftReference} received — transfer completed`)
      onSuccess(updated)
      onClose()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Receive failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Receive transfer"
      description="Confirms funds have landed in the destination account and completes this transfer."
      closeDisabled={busy}
      footer={
        <div className="flex justify-end gap-2">
          <ErpButton variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </ErpButton>
          <ErpButton onClick={() => void confirm()} loading={busy}>
            Confirm receipt
          </ErpButton>
        </div>
      }
    >
      <div className="space-y-2 text-[13px]">
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
    </Modal>
  )
}
