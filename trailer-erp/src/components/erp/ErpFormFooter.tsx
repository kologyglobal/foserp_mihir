import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, X } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from './ErpButton'
import { cn } from '../../utils/cn'

interface ErpFormFooterProps {
  onSubmit?: () => void
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
  className?: string
}

/** Form action bar at end of form — Save always visible (non-sticky by default) */
export function ErpFormFooter({
  submitLabel = 'Save',
  cancelTo,
  onCancel,
  cancelLabel = 'Cancel',
  isSubmitting,
  submitDisabled,
  submitDisabledReason,
  hint,
  actions,
  sticky = false,
  className,
}: ErpFormFooterProps) {
  const navigate = useNavigate()

  return (
    <div
      className={cn(
        'erp-form-footer flex flex-wrap items-center justify-between gap-3 border border-erp-border bg-erp-surface/95 px-4 py-3 shadow-[var(--erp-shadow-card)] backdrop-blur-sm',
        sticky && 'erp-form-footer-sticky',
        className,
      )}
    >
      {hint ? <div className="min-w-0 flex-1 text-[12px] text-erp-muted">{hint}</div> : <div className="flex-1" />}
      <ErpButtonGroup>
        {actions ?? (
          <>
            <ErpButton
              type="submit"
              variant="primary"
              icon={Save}
              disabled={submitDisabled || isSubmitting}
              disabledReason={submitDisabledReason}
            >
              {isSubmitting ? 'Saving…' : submitLabel}
            </ErpButton>
            {cancelTo ? (
              <ErpButton
                type="button"
                variant="ghost"
                icon={X}
                onClick={() => navigate(cancelTo)}
              >
                {cancelLabel}
              </ErpButton>
            ) : onCancel ? (
              <ErpButton type="button" variant="ghost" icon={X} onClick={onCancel}>
                {cancelLabel}
              </ErpButton>
            ) : null}
          </>
        )}
      </ErpButtonGroup>
    </div>
  )
}
