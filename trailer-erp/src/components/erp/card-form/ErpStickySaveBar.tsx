import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, X } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '../ErpButton'
import { ErpFormFooter } from '../ErpFormFooter'
import type { ErpCardFormSaveMode } from './types'

export interface ErpStickySaveBarProps {
  cancelTo?: string
  onCancel?: () => void
  cancelLabel?: string
  onSave?: () => void
  onSaveDraft?: () => void
  onSaveAndNew?: () => void
  onSaveAndClose?: () => void
  submitLabel?: string
  isSubmitting?: boolean
  submitDisabled?: boolean
  submitDisabledReason?: string
  hint?: ReactNode
  actions?: ReactNode
  sticky?: boolean
}

/** Standard form save bar at end of form — navy primary Save always visible */
export function ErpStickySaveBar({
  cancelTo,
  onCancel,
  cancelLabel = 'Cancel',
  onSave,
  onSaveDraft,
  onSaveAndNew,
  onSaveAndClose,
  submitLabel = 'Save',
  isSubmitting,
  submitDisabled,
  submitDisabledReason,
  hint,
  actions,
  sticky = false,
}: ErpStickySaveBarProps) {
  const navigate = useNavigate()

  const defaultActions = (
    <ErpButtonGroup>
      {onSave ? (
        <ErpButton
          type="button"
          variant="primary"
          icon={Save}
          disabled={submitDisabled || isSubmitting}
          disabledReason={submitDisabledReason}
          onClick={onSave}
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </ErpButton>
      ) : null}
      {onSaveAndNew ? (
        <ErpButton type="button" variant="secondary" icon={Save} disabled={isSubmitting} onClick={onSaveAndNew}>
          Save &amp; New
        </ErpButton>
      ) : null}
      {onSaveAndClose ? (
        <ErpButton type="button" variant="outline" icon={X} disabled={isSubmitting} onClick={onSaveAndClose}>
          Save &amp; Close
        </ErpButton>
      ) : null}
      {onSaveDraft ? (
        <ErpButton type="button" variant="secondary" disabled={isSubmitting} onClick={onSaveDraft}>
          Save Draft
        </ErpButton>
      ) : null}
      {cancelTo ? (
        <ErpButton type="button" variant="ghost" icon={X} onClick={() => navigate(cancelTo)}>
          {cancelLabel}
        </ErpButton>
      ) : onCancel ? (
        <ErpButton type="button" variant="ghost" icon={X} onClick={onCancel}>
          {cancelLabel}
        </ErpButton>
      ) : null}
    </ErpButtonGroup>
  )

  return (
    <ErpFormFooter
      sticky={sticky}
      hint={hint}
      actions={actions ?? defaultActions}
      isSubmitting={isSubmitting}
      submitDisabled={submitDisabled}
      submitDisabledReason={submitDisabledReason}
    />
  )
}

export type { ErpCardFormSaveMode }
