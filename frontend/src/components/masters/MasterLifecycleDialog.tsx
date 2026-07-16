import { ErpButton, ErpButtonGroup } from '../erp/ErpButton'

export type MasterLifecycleAction = 'delete' | 'deactivate' | 'activate'

interface MasterLifecycleDialogProps {
  open: boolean
  action: MasterLifecycleAction
  recordLabel: string
  error?: string | null
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const TITLES: Record<MasterLifecycleAction, string> = {
  delete: 'Delete master record',
  deactivate: 'Deactivate master record',
  activate: 'Activate master record',
}

const MESSAGES: Record<MasterLifecycleAction, string> = {
  delete: 'This will soft-delete the record. It will no longer appear in lists or lookups.',
  deactivate: 'The record will be hidden from new-entry dropdowns but remains in historical data.',
  activate: 'The record will become available again in lists and lookups.',
}

export function MasterLifecycleDialog({
  open,
  action,
  recordLabel,
  error,
  pending,
  onConfirm,
  onCancel,
}: MasterLifecycleDialogProps) {
  if (!open) return null

  return (
    <div className="erp-modal-backdrop" role="dialog" aria-modal="true">
      <div className="erp-modal-panel max-w-md">
        <h2 className="text-[16px] font-semibold text-erp-text">{TITLES[action]}</h2>
        <p className="mt-2 text-[13px] text-erp-muted">
          {MESSAGES[action]} Record: <strong>{recordLabel}</strong>
        </p>
        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{error}</p>
        ) : null}
        <ErpButtonGroup className="mt-5 justify-end">
          <ErpButton type="button" variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </ErpButton>
          <ErpButton
            type="button"
            variant={action === 'delete' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? 'Please wait…' : action === 'delete' ? 'Delete' : action === 'deactivate' ? 'Deactivate' : 'Activate'}
          </ErpButton>
        </ErpButtonGroup>
      </div>
    </div>
  )
}
