import { AlertTriangle } from 'lucide-react'
import { ErpButton } from '../erp/ErpButton'
import { CrmDrawerShell } from './CrmDrawerShell'

interface CrmDeleteConfirmModalProps {
  open: boolean
  title: string
  description?: string
  /** Optional entity label shown under the description (e.g. lead name). */
  detail?: string | null
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
  detail,
  blockReason,
  confirmLabel = 'Delete',
  onCancel,
  onConfirm,
  isDeleting,
}: CrmDeleteConfirmModalProps) {
  return (
    <CrmDrawerShell
      open={open}
      placement="modal"
      size="sm"
      accent={blockReason ? 'warning' : 'danger'}
      icon={AlertTriangle}
      title={title}
      subtitle={blockReason ? 'This action is blocked' : 'This cannot be undone from the list'}
      onClose={onCancel}
      closeDisabled={Boolean(isDeleting)}
      footer={
        <div className="crm-popup-footer__actions">
          <ErpButton type="button" variant="secondary" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </ErpButton>
          {!blockReason ? (
            <ErpButton type="button" variant="primary" onClick={onConfirm} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : confirmLabel}
            </ErpButton>
          ) : null}
        </div>
      }
    >
      <p className="text-[13px] leading-relaxed text-erp-text">
        {blockReason ?? description}
      </p>
      {!blockReason && detail ? (
        <div className="crm-popup-context-pill mt-3" title={detail}>
          <span>{detail}</span>
        </div>
      ) : null}
    </CrmDrawerShell>
  )
}
