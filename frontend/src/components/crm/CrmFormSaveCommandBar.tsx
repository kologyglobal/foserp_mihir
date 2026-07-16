import { Save, X } from 'lucide-react'
import { ErpCardCommandBar } from '../erp/card-form/ErpCardCommandBar'
import type { ErpCardCommandAction } from '../erp/card-form/types'

export interface CrmFormSaveCommandBarProps {
  onSave: () => void
  onSaveAndNew?: () => void
  onSaveAndClose?: () => void
  onCancel: () => void
  /** Primary button label. Default: Save */
  saveLabel?: string
  isSubmitting?: boolean
  /** Extra home actions after the save quartet (e.g. View 360) */
  extraHomeActions?: ErpCardCommandAction[]
  moreActions?: ErpCardCommandAction[]
  className?: string
}

/**
 * Standard CRM create/edit header actions — matches New Lead:
 * Save · Save & New · Save & Close · Cancel
 */
export function CrmFormSaveCommandBar({
  onSave,
  onSaveAndNew,
  onSaveAndClose,
  onCancel,
  saveLabel = 'Save',
  isSubmitting = false,
  extraHomeActions,
  moreActions,
  className,
}: CrmFormSaveCommandBarProps) {
  const homeActions: ErpCardCommandAction[] = [
    {
      id: 'save',
      label: isSubmitting ? 'Saving…' : saveLabel,
      icon: Save,
      primary: true,
      disabled: isSubmitting,
      onClick: onSave,
    },
    ...(onSaveAndNew
      ? [{
          id: 'save-new',
          label: 'Save & New',
          icon: Save,
          disabled: isSubmitting,
          onClick: onSaveAndNew,
        } satisfies ErpCardCommandAction]
      : []),
    ...(onSaveAndClose
      ? [{
          id: 'save-close',
          label: 'Save & Close',
          icon: X,
          disabled: isSubmitting,
          onClick: onSaveAndClose,
        } satisfies ErpCardCommandAction]
      : []),
    {
      id: 'cancel',
      label: 'Cancel',
      icon: X,
      onClick: onCancel,
    },
    ...(extraHomeActions ?? []),
  ]

  return (
    <ErpCardCommandBar
      inline
      className={className}
      homeActions={homeActions}
      moreActions={moreActions}
    />
  )
}
