import { ErpButton, ErpButtonGroup } from '../erp/ErpButton'

interface DeleteLeadModalProps {
  open: boolean
  leadLabel: string
  blockReason?: string | null
  onCancel: () => void
  onConfirm: () => void
  isDeleting?: boolean
}

export function DeleteLeadModal({
  open,
  blockReason,
  onCancel,
  onConfirm,
  isDeleting,
}: DeleteLeadModalProps) {
  if (!open) return null

  return (
    <div className="erp-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-lead-title">
      <div className="erp-modal-panel max-w-md">
        <h2 id="delete-lead-title" className="text-[16px] font-semibold text-erp-text">
          Delete Lead?
        </h2>
        <p className="mt-2 text-[13px] text-erp-muted">
          {blockReason ?? 'This action will remove the lead from active records. You can keep history for audit.'}
        </p>
        <ErpButtonGroup className="mt-5 justify-end">
          <ErpButton type="button" variant="secondary" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </ErpButton>
          {!blockReason ? (
            <ErpButton type="button" variant="primary" onClick={onConfirm} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete Lead'}
            </ErpButton>
          ) : null}
        </ErpButtonGroup>
      </div>
    </div>
  )
}
