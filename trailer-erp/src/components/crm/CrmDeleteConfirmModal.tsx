import { ErpButton, ErpButtonGroup } from '../erp/ErpButton'

interface CrmDeleteConfirmModalProps {
  open: boolean
  title: string
  description?: string
  blockReason?: string | null
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
  isDeleting?: boolean
}

export function CrmDeleteConfirmModal({
  open,
  title,
  description = 'This record will be removed from active lists. Historical references may remain for audit.',
  blockReason,
  confirmLabel = 'Delete',
  onCancel,
  onConfirm,
  isDeleting,
}: CrmDeleteConfirmModalProps) {
  if (!open) return null

  return (
    <div className="erp-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="crm-delete-title">
      <div className="erp-modal-panel max-w-md">
        <h2 id="crm-delete-title" className="text-[16px] font-semibold text-erp-text">
          {title}
        </h2>
        <p className="mt-2 text-[13px] text-erp-muted">
          {blockReason ?? description}
        </p>
        <ErpButtonGroup className="mt-5 justify-end">
          <ErpButton type="button" variant="secondary" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </ErpButton>
          {!blockReason ? (
            <ErpButton type="button" variant="primary" onClick={onConfirm} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : confirmLabel}
            </ErpButton>
          ) : null}
        </ErpButtonGroup>
      </div>
    </div>
  )
}
