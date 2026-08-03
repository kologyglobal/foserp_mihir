import { CrmDeleteConfirmModal } from './CrmDeleteConfirmModal'

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
  leadLabel,
  blockReason,
  onCancel,
  onConfirm,
  isDeleting,
}: DeleteLeadModalProps) {
  return (
    <CrmDeleteConfirmModal
      open={open}
      title="Delete Lead?"
      description="This action will remove the lead from active records. You can keep history for audit."
      detail={leadLabel || null}
      blockReason={blockReason}
      confirmLabel="Delete Lead"
      onCancel={onCancel}
      onConfirm={onConfirm}
      isDeleting={isDeleting}
    />
  )
}
