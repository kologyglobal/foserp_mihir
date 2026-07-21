import { useEffect, useId, useRef } from 'react'
import { ErpButton, ErpButtonGroup } from '../erp/ErpButton'

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
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) onCancel()
    }
    window.addEventListener('keydown', onKey)
    requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('button')?.focus()
    })
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onCancel, isDeleting])

  if (!open) return null

  return (
    <div
      className="erp-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onCancel()
      }}
    >
      <div
        ref={panelRef}
        className="erp-modal-panel max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="text-[16px] font-semibold text-erp-text">
          {title}
        </h2>
        <p className="mt-2 text-[13px] text-erp-muted">
          {blockReason ?? description}
        </p>
        {!blockReason && detail ? (
          <p className="mt-1 text-[13px] font-medium text-erp-text">{detail}</p>
        ) : null}
        <ErpButtonGroup className="mt-5 justify-end">
          <ErpButton type="button" variant="secondary" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </ErpButton>
          {!blockReason ? (
            <ErpButton type="button" variant="primary" onClick={onConfirm} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : confirmLabel}
            </ErpButton>
          ) : null}
        </ErpButtonGroup>
      </div>
    </div>
  )
}
