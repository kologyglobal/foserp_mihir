import type { ReactNode } from 'react'
import { ErpFormFooter } from '../../components/erp/ErpFormFooter'

export interface FooterActionsProps {
  submitLabel?: string
  cancelTo?: string
  onCancel?: () => void
  cancelLabel?: string
  isSubmitting?: boolean
  submitDisabled?: boolean
  submitDisabledReason?: string
  hint?: ReactNode
  actions?: ReactNode
  sticky?: boolean
  showSaveDraft?: boolean
  onSaveDraft?: () => void
  showSaveAndNew?: boolean
  onSaveAndNew?: () => void
  showSaveAndClose?: boolean
  onSaveAndClose?: () => void
}

/** Universal form footer at end of form — navy Save, consistent sizing */
export function FooterActions({
  showSaveDraft,
  onSaveDraft,
  showSaveAndNew,
  onSaveAndNew,
  showSaveAndClose,
  onSaveAndClose,
  actions,
  ...props
}: FooterActionsProps) {
  const extraActions = (
    <>
      {showSaveDraft && onSaveDraft ? (
        <button type="button" className="ds-type-button text-[var(--dyn-text-secondary)] hover:text-[var(--dyn-text)]" onClick={onSaveDraft}>
          Save Draft
        </button>
      ) : null}
      {showSaveAndNew && onSaveAndNew ? (
        <button type="button" className="ds-type-button text-[var(--dyn-text-secondary)] hover:text-[var(--dyn-text)]" onClick={onSaveAndNew}>
          Save &amp; New
        </button>
      ) : null}
      {showSaveAndClose && onSaveAndClose ? (
        <button type="button" className="ds-type-button text-[var(--dyn-text-secondary)] hover:text-[var(--dyn-text)]" onClick={onSaveAndClose}>
          Save &amp; Close
        </button>
      ) : null}
      {actions}
    </>
  )

  return <ErpFormFooter {...props} actions={extraActions} />
}
