import type { ReactNode } from 'react'
import { Save, X } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from './ErpButton'
import { ErpFormFooter } from './ErpFormFooter'
import { systemConfirm } from '@/utils/systemConfirm'

export interface FormActionBarProps {
  onSave: () => void
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
  hint?: ReactNode
  /** Stick to the bottom of the viewport (form footer chrome) */
  sticky?: boolean
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
  hint,
  sticky = false,
  className,
  extraActions,
}: FormActionBarProps) {
  const saveDisabled = disabled || busy

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

  const actions = (
    <ErpButtonGroup>
      <ErpButton
        type="button"
        variant="primary"
        icon={Save}
        disabled={saveDisabled}
        disabledReason={disabledReason}
        onClick={onSave}
      >
        {busy ? 'Saving…' : saveLabel}
      </ErpButton>
      {onSaveAndNew ? (
        <ErpButton
          type="button"
          variant="secondary"
          icon={Save}
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
          icon={X}
          disabled={saveDisabled}
          disabledReason={disabledReason}
          onClick={onSaveAndClose}
        >
          {saveAndCloseLabel}
        </ErpButton>
      ) : null}
      {extraActions}
      <ErpButton type="button" variant="ghost" icon={X} disabled={busy} onClick={() => void handleCancel()}>
        {cancelLabel}
      </ErpButton>
    </ErpButtonGroup>
  )

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
