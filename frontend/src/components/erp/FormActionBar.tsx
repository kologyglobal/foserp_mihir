import { useRef, type ReactNode } from 'react'
import { ErpButton, ErpButtonGroup } from './ErpButton'
import { ErpFormFooter } from './ErpFormFooter'
import { systemConfirm } from '@/utils/systemConfirm'
import {
  runFormActionSingleFlight,
  type FormActionSingleFlightGate,
} from './formActionSingleFlight'

export interface FormActionBarProps {
  onSave: () => void | Promise<unknown>
  onSaveAndNew?: () => void
  onSaveAndClose?: () => void
  onCancel: () => void
  /** Disables save actions while a save is in flight */
  busy?: boolean
  /** Disables Save (and related save variants) */
  disabled?: boolean
  disabledReason?: string
  /**
   * When true, Cancel prompts to discard unsaved changes before calling `onCancel`.
   * Callers should `resetDirty()` inside `onCancel` so navigation guards do not re-prompt.
   */
  dirty?: boolean
  saveLabel?: string
  saveAndNewLabel?: string
  saveAndCloseLabel?: string
  cancelLabel?: string
  /** Render Cancel before Save. Purchase document create/edit forms use this order. */
  cancelFirst?: boolean
  hint?: ReactNode
  /** Stick to the bottom of the viewport (form footer chrome) */
  sticky?: boolean
  /** Render only the responsive action group when a drawer/modal already supplies footer chrome. */
  embedded?: boolean
  className?: string
  /** Extra buttons between save variants and Cancel */
  extraActions?: ReactNode
}

/**
 * Standard Dynamics/ERP form actions — render once (header or footer, not both).
 * Save · Save & New · Save & Close · Cancel
 */
export function FormActionBar({
  onSave,
  onSaveAndNew,
  onSaveAndClose,
  onCancel,
  busy = false,
  disabled = false,
  disabledReason,
  dirty = false,
  saveLabel = 'Save',
  saveAndNewLabel = 'Save & New',
  saveAndCloseLabel = 'Save & Close',
  cancelLabel = 'Cancel',
  cancelFirst = false,
  hint,
  sticky = false,
  embedded = false,
  className,
  extraActions,
}: FormActionBarProps) {
  const saveDisabled = disabled || busy
  const saveGate = useRef<FormActionSingleFlightGate>({ locked: false })

  function handleSave() {
    if (saveDisabled) return
    void runFormActionSingleFlight(saveGate.current, onSave)
  }

  async function handleCancel() {
    if (dirty) {
      const leave = await systemConfirm({
        title: 'Discard changes?',
        description: 'You have unsaved changes. Discard them and leave this page?',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        variant: 'danger',
      })
      if (!leave) return
    }
    onCancel()
  }

  const cancelAction = (
    <ErpButton
      type="button"
      variant="secondary"
      className="min-w-0 flex-1 sm:flex-none"
      disabled={busy}
      onClick={() => void handleCancel()}
    >
      {cancelLabel}
    </ErpButton>
  )

  const saveAction = (
    <ErpButton
      type="button"
      variant="primary"
      className="min-w-0 flex-1 sm:flex-none"
      disabled={saveDisabled}
      disabledReason={disabledReason}
      onClick={handleSave}
    >
      {busy ? 'Saving…' : saveLabel}
    </ErpButton>
  )

  const actions = (
    <ErpButtonGroup className="w-full sm:w-auto">
      {cancelFirst ? cancelAction : saveAction}
      {onSaveAndNew ? (
        <ErpButton
          type="button"
          variant="secondary"
          disabled={saveDisabled}
          disabledReason={disabledReason}
          onClick={onSaveAndNew}
        >
          {saveAndNewLabel}
        </ErpButton>
      ) : null}
      {onSaveAndClose ? (
        <ErpButton
          type="button"
          variant="outline"
          disabled={saveDisabled}
          disabledReason={disabledReason}
          onClick={onSaveAndClose}
        >
          {saveAndCloseLabel}
        </ErpButton>
      ) : null}
      {extraActions}
      {cancelFirst ? saveAction : cancelAction}
    </ErpButtonGroup>
  )

  if (embedded) return actions

  return (
    <ErpFormFooter
      sticky={sticky}
      hint={hint}
      actions={actions}
      isSubmitting={busy}
      submitDisabled={disabled}
      submitDisabledReason={disabledReason}
      className={className}
    />
  )
}
