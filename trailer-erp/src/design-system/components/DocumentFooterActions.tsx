import { CheckCircle, Download, Eye, Save, X } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '../../components/erp/ErpButton'
import { cn } from '../../utils/cn'

export interface DocumentFooterActionsProps {
  onCancel: () => void
  cancelLabel?: string
  onSaveDraft?: () => void
  onSave: () => void
  onPreview?: () => void
  onSubmitApproval?: () => void
  onGeneratePdf?: () => void
  onSaveAndClose?: () => void
  isSubmitting?: boolean
  saveDisabled?: boolean
  saveDisabledReason?: string
  showSaveDraft?: boolean
  showSubmitApproval?: boolean
  showGeneratePdf?: boolean
  showSaveAndClose?: boolean
  className?: string
}

/**
 * Standard footer for quotation / document builders (end of form, not sticky).
 * Order: Cancel | Save Draft | Save | Preview | Submit Approval | Generate PDF | Save & Close
 */
export function DocumentFooterActions({
  onCancel,
  cancelLabel = 'Cancel',
  onSaveDraft,
  onSave,
  onPreview,
  onSubmitApproval,
  onGeneratePdf,
  onSaveAndClose,
  isSubmitting,
  saveDisabled,
  saveDisabledReason,
  showSaveDraft = true,
  showSubmitApproval = true,
  showGeneratePdf = true,
  showSaveAndClose = true,
  className,
}: DocumentFooterActionsProps) {
  return (
    <footer className={cn('quo-editor-footer', className)}>
      <ErpButton type="button" variant="ghost" icon={X} onClick={onCancel}>
        {cancelLabel}
      </ErpButton>
      <ErpButtonGroup className="quo-editor-footer__right">
        {showSaveDraft && onSaveDraft ? (
          <ErpButton type="button" variant="secondary" onClick={onSaveDraft} disabled={isSubmitting}>
            Save Draft
          </ErpButton>
        ) : null}
        <ErpButton
          type="button"
          variant="primary"
          icon={Save}
          onClick={onSave}
          disabled={saveDisabled || isSubmitting}
          disabledReason={saveDisabledReason}
        >
          {isSubmitting ? 'Saving…' : 'Save'}
        </ErpButton>
        {onPreview ? (
          <ErpButton type="button" variant="secondary" icon={Eye} onClick={onPreview}>
            Preview
          </ErpButton>
        ) : null}
        {showSubmitApproval && onSubmitApproval ? (
          <ErpButton type="button" variant="secondary" icon={CheckCircle} onClick={onSubmitApproval}>
            Submit Approval
          </ErpButton>
        ) : null}
        {showGeneratePdf && onGeneratePdf ? (
          <ErpButton type="button" variant="secondary" icon={Download} onClick={onGeneratePdf}>
            Generate PDF
          </ErpButton>
        ) : null}
        {showSaveAndClose && onSaveAndClose ? (
          <ErpButton type="button" variant="secondary" onClick={onSaveAndClose} disabled={isSubmitting}>
            Save &amp; Close
          </ErpButton>
        ) : null}
      </ErpButtonGroup>
    </footer>
  )
}
